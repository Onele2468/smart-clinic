import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { staffAvailabilityTable, usersTable, clinicMembersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, requireClinicMember } from "../lib/auth";

const router: IRouter = Router();

const ALLOWED_ROLES = ["doctor", "nurse"];
const ALLOWED_STATUSES = ["available", "busy", "in_consultation", "offline", "on_break"] as const;
type AvailabilityStatus = typeof ALLOWED_STATUSES[number];

// GET /clinics/:clinicId/staff/availability — list all doctors/nurses with availability
router.get(
  "/clinics/:clinicId/staff/availability",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const roleFilter = req.query.role as string | undefined;
    const statusFilter = req.query.status as string | undefined;

    try {
      // Get all doctors and nurses in this clinic
      const roleConditions = roleFilter && ALLOWED_ROLES.includes(roleFilter)
        ? [roleFilter]
        : ALLOWED_ROLES;

      const members = await db
        .select({
          userId: clinicMembersTable.userId,
          memberRole: clinicMembersTable.role,
          name: usersTable.name,
          staffCode: usersTable.staffCode,
        })
        .from(clinicMembersTable)
        .innerJoin(usersTable, eq(clinicMembersTable.userId, usersTable.id))
        .where(
          and(
            eq(clinicMembersTable.clinicId, clinicId),
            eq(clinicMembersTable.status, "active"),
            inArray(clinicMembersTable.role, roleConditions)
          )
        );

      if (members.length === 0) {
        res.json([]);
        return;
      }

      const userIds = members.map((m) => m.userId);

      // Get current availability for these users in this clinic
      const availability = await db
        .select()
        .from(staffAvailabilityTable)
        .where(
          and(
            eq(staffAvailabilityTable.clinicId, clinicId),
            inArray(staffAvailabilityTable.userId, userIds)
          )
        );

      const availabilityMap = new Map(availability.map((a) => [a.userId, a]));

      const result = members.map((m) => {
        const avail = availabilityMap.get(m.userId);
        return {
          userId: m.userId,
          name: m.name,
          role: m.memberRole,
          staffCode: m.staffCode,
          availabilityStatus: avail?.status ?? "offline",
          availabilityUpdatedAt: avail?.updatedAt ?? null,
        };
      });

      const filtered = statusFilter
        ? result.filter((r) => r.availabilityStatus === statusFilter)
        : result;

      // Sort: available first, then busy/in_consultation, then on_break, then offline
      const ORDER: Record<string, number> = {
        available: 0,
        in_consultation: 1,
        busy: 2,
        on_break: 3,
        offline: 4,
      };
      filtered.sort((a, b) => (ORDER[a.availabilityStatus] ?? 5) - (ORDER[b.availabilityStatus] ?? 5));

      res.json(filtered);
    } catch (err: unknown) {
      req.log.error({ err }, "GET staff availability failed");
      res.status(500).json({ error: "Failed to fetch staff availability." });
    }
  }
);

// PATCH /clinics/:clinicId/staff/availability — update own availability status
router.patch(
  "/clinics/:clinicId/staff/availability",
  requireAuth as any,
  requireClinicMember as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const user = (req as any).user;
    const member = (req as any).clinicMember as { role: string; status: string };

    // Only doctors and nurses can update their own availability
    if (!ALLOWED_ROLES.includes(member.role)) {
      res.status(403).json({ error: "Only doctors and nurses can update availability status." });
      return;
    }

    const { status } = req.body as { status?: string };
    if (!status || !ALLOWED_STATUSES.includes(status as AvailabilityStatus)) {
      res.status(400).json({ error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(", ")}` });
      return;
    }

    try {
      // Upsert availability record
      const existing = await db
        .select({ id: staffAvailabilityTable.id })
        .from(staffAvailabilityTable)
        .where(
          and(
            eq(staffAvailabilityTable.userId, user.userId),
            eq(staffAvailabilityTable.clinicId, clinicId)
          )
        );

      if (existing.length > 0) {
        await db
          .update(staffAvailabilityTable)
          .set({ status, updatedAt: new Date() })
          .where(
            and(
              eq(staffAvailabilityTable.userId, user.userId),
              eq(staffAvailabilityTable.clinicId, clinicId)
            )
          );
      } else {
        await db.insert(staffAvailabilityTable).values({
          userId: user.userId,
          clinicId,
          status,
        });
      }

      // Return updated record
      const [me] = await db
        .select({ name: usersTable.name, staffCode: usersTable.staffCode })
        .from(usersTable)
        .where(eq(usersTable.id, user.userId));

      const [avail] = await db
        .select()
        .from(staffAvailabilityTable)
        .where(
          and(
            eq(staffAvailabilityTable.userId, user.userId),
            eq(staffAvailabilityTable.clinicId, clinicId)
          )
        );

      res.json({
        userId: user.userId,
        name: me?.name ?? "",
        role: member.role,
        staffCode: me?.staffCode ?? null,
        availabilityStatus: avail.status,
        availabilityUpdatedAt: avail.updatedAt,
      });
    } catch (err: unknown) {
      req.log.error({ err }, "PATCH staff availability failed");
      res.status(500).json({ error: "Failed to update availability." });
    }
  }
);

export default router;

/**
 * Helper: auto-update doctor availability based on queue status change.
 * Call this from the queue update handler.
 */
export async function syncDoctorAvailabilityFromQueueStatus(
  clinicId: string,
  doctorId: string | null | undefined,
  newStatus: string
): Promise<void> {
  if (!doctorId) return;
  const statusMap: Record<string, AvailabilityStatus> = {
    doctor_consultation: "in_consultation",
    completed: "available",
    skipped: "available",
  };
  const newAvail = statusMap[newStatus];
  if (!newAvail) return;

  const existing = await db
    .select({ id: staffAvailabilityTable.id })
    .from(staffAvailabilityTable)
    .where(and(eq(staffAvailabilityTable.userId, doctorId), eq(staffAvailabilityTable.clinicId, clinicId)));

  if (existing.length > 0) {
    await db
      .update(staffAvailabilityTable)
      .set({ status: newAvail, updatedAt: new Date() })
      .where(and(eq(staffAvailabilityTable.userId, doctorId), eq(staffAvailabilityTable.clinicId, clinicId)));
  } else {
    await db.insert(staffAvailabilityTable).values({ userId: doctorId, clinicId, status: newAvail });
  }
}
