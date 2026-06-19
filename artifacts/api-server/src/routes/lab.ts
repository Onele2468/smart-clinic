import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  labRequestsTable, labResultsTable, patientsTable, usersTable, clinicMembersTable
} from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole, requireClinicModule } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logOperationalAlert } from "../services/whatsapp/operationalAlerts.triggers";
import { logQueueAudit, notifyStaffWorkflow } from "../services/notifications/workflow-notifications.service";

const router: IRouter = Router();

function generateLabCode(count: number): string {
  return `LR-${String(count).padStart(5, "0")}`;
}

// List lab requests for a patient
router.get(
  "/clinics/:clinicId/patients/:patientId/lab-requests",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;

    const requests = await db
      .select({
        id: labRequestsTable.id,
        clinicId: labRequestsTable.clinicId,
        patientId: labRequestsTable.patientId,
        doctorId: labRequestsTable.doctorId,
        doctorName: usersTable.name,
        requestCode: labRequestsTable.requestCode,
        testName: labRequestsTable.testName,
        testCategory: labRequestsTable.testCategory,
        urgency: labRequestsTable.urgency,
        notes: labRequestsTable.notes,
        status: labRequestsTable.status,
        createdAt: labRequestsTable.createdAt,
      })
      .from(labRequestsTable)
      .leftJoin(usersTable, eq(labRequestsTable.doctorId, usersTable.id))
      .where(and(eq(labRequestsTable.clinicId, clinicId), eq(labRequestsTable.patientId, patientId)))
      .orderBy(sql`${labRequestsTable.createdAt} DESC`);

    // Attach the latest submitted result to each request
    const resultsByRequest = new Map<string, Record<string, unknown>>();
    const requestIds = requests.map(r => r.id);
    if (requestIds.length > 0) {
      const techTable = usersTable;
      const allResults = await db
        .select({
          labRequestId: labResultsTable.labRequestId,
          resultId: labResultsTable.id,
          resultText: labResultsTable.resultText,
          resultNotes: labResultsTable.resultNotes,
          resultStatus: labResultsTable.status,
          technicianId: labResultsTable.technicianId,
          technicianName: techTable.name,
          resultCreatedAt: labResultsTable.createdAt,
        })
        .from(labResultsTable)
        .leftJoin(techTable, eq(labResultsTable.technicianId, techTable.id))
        .where(inArray(labResultsTable.labRequestId, requestIds))
        .orderBy(sql`${labResultsTable.createdAt} DESC`);
      for (const r of allResults) {
        if (!resultsByRequest.has(r.labRequestId)) resultsByRequest.set(r.labRequestId, r);
      }
    }

    res.json(requests.map(r => ({ ...r, result: resultsByRequest.get(r.id) ?? null })));
  }
);

// Lab queue — all pending/in_progress requests for the clinic
router.get(
  "/clinics/:clinicId/lab/queue",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  requireRole("clinic_admin", "lab_technician", "doctor") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const status = req.query.status as string | undefined;

    const doctorAlias = usersTable;
    const requests = await db
      .select({
        id: labRequestsTable.id,
        clinicId: labRequestsTable.clinicId,
        patientId: labRequestsTable.patientId,
        patientName: sql<string>`${patientsTable.firstName} || ' ' || ${patientsTable.lastName}`,
        patientCode: patientsTable.patientCode,
        doctorId: labRequestsTable.doctorId,
        doctorName: usersTable.name,
        requestCode: labRequestsTable.requestCode,
        testName: labRequestsTable.testName,
        testCategory: labRequestsTable.testCategory,
        urgency: labRequestsTable.urgency,
        notes: labRequestsTable.notes,
        status: labRequestsTable.status,
        createdAt: labRequestsTable.createdAt,
      })
      .from(labRequestsTable)
      .innerJoin(patientsTable, eq(labRequestsTable.patientId, patientsTable.id))
      .leftJoin(usersTable, eq(labRequestsTable.doctorId, usersTable.id))
      .where(and(
        eq(labRequestsTable.clinicId, clinicId),
        status ? eq(labRequestsTable.status, status) : inArray(labRequestsTable.status, ["pending", "in_progress"])
      ))
      .orderBy(sql`
        CASE ${labRequestsTable.urgency} WHEN 'stat' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
        ${labRequestsTable.createdAt} ASC
      `);

    res.json(requests);
  }
);

// Create lab request (doctor/admin only)
router.post(
  "/clinics/:clinicId/patients/:patientId/lab-requests",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  requireRole("doctor", "clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const user = (req as any).user;

    const { testName, testCategory, urgency, notes } = req.body;
    if (!testName) {
      res.status(400).json({ error: "testName is required" });
      return;
    }

    const countResult = await db.select({ count: sql<number>`count(*)` }).from(labRequestsTable).where(eq(labRequestsTable.clinicId, clinicId));
    const count = Number(countResult[0]?.count ?? 0) + 1;
    const requestCode = generateLabCode(count);

    const [request] = await db.insert(labRequestsTable).values({
      clinicId,
      patientId,
      doctorId: user.userId,
      requestCode,
      testName,
      testCategory: testCategory ?? "blood",
      urgency: urgency ?? "routine",
      notes: notes ?? null,
      status: "pending",
    }).returning();

    const [patient] = await db.select().from(patientsTable).where(eq(patientsTable.id, patientId));
    const labMessage = `Lab request ${requestCode} (${testName}) created for ${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`;

    logActivity({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "laboratory",
      actionType: "lab_request_created",
      type: "lab_request_created",
      message: labMessage,
      entityId: request.id,
    });

    logOperationalAlert({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "laboratory",
      actionType: "op_alert_lab_request",
      message: labMessage,
      entityId: request.id,
    });
    void Promise.all([
      logQueueAudit({
        clinicId,
        patientId,
        staffId: user.userId,
        oldStatus: "doctor_consultation",
        newStatus: "laboratory",
        notes: "Lab Request Created",
      }),
      notifyStaffWorkflow({
        clinicId,
        roles: ["lab_technician"],
        preferenceKey: "labRequested",
        type: "lab_request",
        title: "New lab request",
        message: labMessage,
        entityId: request.id,
        targetUrl: `/lab?requestId=${request.id}`,
      }),
    ]).catch(() => {});

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
    res.status(201).json({ ...request, doctorName: doctor?.name ?? "" });
  }
);

// Update lab request status (lab tech / admin)
router.patch(
  "/clinics/:clinicId/patients/:patientId/lab-requests/:requestId",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;

    const { status } = req.body;
    if (!status || !["pending", "in_progress", "completed", "cancelled"].includes(status)) {
      res.status(400).json({ error: "status must be pending, in_progress, completed, or cancelled" });
      return;
    }

    const [previousRequest] = await db.select().from(labRequestsTable).where(
      and(eq(labRequestsTable.id, requestId), eq(labRequestsTable.clinicId, clinicId), eq(labRequestsTable.patientId, patientId))
    );
    const [request] = await db.update(labRequestsTable).set({ status }).where(
      and(eq(labRequestsTable.id, requestId), eq(labRequestsTable.clinicId, clinicId), eq(labRequestsTable.patientId, patientId))
    ).returning();

    if (!request) {
      res.status(404).json({ error: "Lab request not found" });
      return;
    }

    const [doctor] = await db.select().from(usersTable).where(eq(usersTable.id, request.doctorId));
    if (status === "in_progress") {
      void logQueueAudit({
        clinicId,
        patientId,
        staffId: (req as any).user?.userId ?? null,
        oldStatus: previousRequest?.status ?? null,
        newStatus: "laboratory",
        notes: "Lab Processing Started",
      }).catch(() => {});
    }
    res.json({ ...request, doctorName: doctor?.name ?? "" });
  }
);

// Get lab results for a request
router.get(
  "/clinics/:clinicId/patients/:patientId/lab-requests/:requestId/results",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;

    const results = await db
      .select({
        id: labResultsTable.id,
        clinicId: labResultsTable.clinicId,
        labRequestId: labResultsTable.labRequestId,
        patientId: labResultsTable.patientId,
        technicianId: labResultsTable.technicianId,
        technicianName: usersTable.name,
        resultText: labResultsTable.resultText,
        resultNotes: labResultsTable.resultNotes,
        status: labResultsTable.status,
        createdAt: labResultsTable.createdAt,
      })
      .from(labResultsTable)
      .leftJoin(usersTable, eq(labResultsTable.technicianId, usersTable.id))
      .where(and(eq(labResultsTable.clinicId, clinicId), eq(labResultsTable.labRequestId, requestId)))
      .orderBy(sql`${labResultsTable.createdAt} DESC`);

    res.json(results);
  }
);

// Submit lab result (lab tech / admin)
router.post(
  "/clinics/:clinicId/patients/:patientId/lab-requests/:requestId/results",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("laboratory") as any,
  requireRole("lab_technician", "clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const patientId = Array.isArray(req.params.patientId) ? req.params.patientId[0] : req.params.patientId;
    const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0] : req.params.requestId;
    const user = (req as any).user;

    const { resultText, resultNotes, status } = req.body;
    if (!resultText) {
      res.status(400).json({ error: "resultText is required" });
      return;
    }

    const [labRequest] = await db
    .select()
    .from(labRequestsTable)
    .where(eq(labRequestsTable.id, requestId));
    const [result] = await db.insert(labResultsTable).values({
      clinicId: String(clinicId),
      labRequestId: String(requestId),
      patientId: String(patientId),
      technicianId: String(user.userId),
      testName: labRequest?.testName ?? "Unknown Test",
      resultSummary: resultNotes ?? resultText.substring(0, 255),
      resultText,
      resultNotes: resultNotes ?? null,
      status: status ?? "final",
    }).returning();

    // Mark the lab request as completed
    await db.update(labRequestsTable).set({ status: "completed" }).where(
      and(eq(labRequestsTable.id, requestId), eq(labRequestsTable.clinicId, clinicId))
    );

    const [tech] = await db.select().from(usersTable).where(eq(usersTable.id, user.userId));
    const [labReq] = await db.select().from(labRequestsTable).where(eq(labRequestsTable.id, requestId));

    logActivity({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "laboratory",
      actionType: "lab_result_submitted",
      type: "lab_result_submitted",
      message: `Lab result submitted for ${labReq?.testName ?? "test"} (${labReq?.requestCode ?? ""})`,
      entityId: result.id,
    });
    void Promise.all([
      logQueueAudit({
        clinicId,
        patientId,
        staffId: user.userId,
        oldStatus: "laboratory",
        newStatus: "doctor_consultation",
        notes: "Lab Result Submitted",
      }),
      notifyStaffWorkflow({
        clinicId,
        roles: ["doctor"],
        userIds: labReq?.doctorId ? [labReq.doctorId] : [],
        preferenceKey: "labResultReady",
        type: "lab_result",
        title: "Lab results ready",
        message: `Lab result ready for ${labReq?.testName ?? "test"} (${labReq?.requestCode ?? ""}).`,
        entityId: result.id,
        targetUrl: `/lab?requestId=${requestId}`,
      }),
    ]).catch(() => {});

    res.status(201).json({ ...result, technicianName: tech?.name ?? "" });
  }
);

export default router;
