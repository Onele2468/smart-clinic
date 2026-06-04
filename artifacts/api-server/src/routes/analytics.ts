import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  patientsTable, queueEntriesTable, appointmentsTable,
  clinicMembersTable, activityLogsTable,
  notificationsTable, prescriptionsTable, labRequestsTable,
  invoicesTable, paymentsTable,
  usersTable, joinRequestsTable, inventoryItemsTable,
} from "@workspace/db";
import { eq, and, sql, ilike } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";

// ── Shared helper: resolve clinicId param ─────────────────────────────────────
function cid(raw: string | string[]): string {
  return Array.isArray(raw) ? raw[0] : raw;
}

const router: IRouter = Router();

router.get("/clinics/:clinicId/analytics/dashboard", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const [
    [totalPatientsResult],
    [activeQueueResult],
    [appointmentsTodayResult],
    [completedTodayResult],
    [activeStaffResult],
    [pendingJoinResult],
    [pendingInvoicesResult],
    [pendingLabResult],
    [pendingRxResult],
    [lowStockResult],
    [revenueTodayResult],
    [monthlyRevenueResult],
    completedEntries,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(patientsTable).where(eq(patientsTable.clinicId, clinicId)),
    db.select({ count: sql<number>`count(*)` }).from(queueEntriesTable)
      .where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.status} IN ('waiting','in_progress','nurse_assessment','doctor_consultation','pharmacy','lab','called')`, sql`${queueEntriesTable.createdAt} >= ${today}`)),
    db.select({ count: sql<number>`count(*)` }).from(appointmentsTable)
      .where(and(eq(appointmentsTable.clinicId, clinicId), sql`DATE(${appointmentsTable.scheduledAt}) = ${todayStr}`)),
    db.select({ count: sql<number>`count(*)` }).from(queueEntriesTable)
      .where(and(eq(queueEntriesTable.clinicId, clinicId), eq(queueEntriesTable.status, "completed"), sql`${queueEntriesTable.createdAt} >= ${today}`)),
    db.select({ count: sql<number>`count(*)` }).from(clinicMembersTable)
      .where(and(eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.status, "active"))),
    db.select({ count: sql<number>`count(*)` }).from(joinRequestsTable)
      .where(and(eq(joinRequestsTable.clinicId, clinicId), eq(joinRequestsTable.status, "pending"))),
    db.select({ count: sql<number>`count(*)` }).from(invoicesTable)
      .where(and(eq(invoicesTable.clinicId, clinicId), sql`${invoicesTable.status} IN ('unpaid', 'partial')`)),
    db.select({ count: sql<number>`count(*)` }).from(labRequestsTable)
      .where(and(eq(labRequestsTable.clinicId, clinicId), sql`${labRequestsTable.status} IN ('pending', 'in_progress')`)),
    db.select({ count: sql<number>`count(*)` }).from(prescriptionsTable)
      .where(and(eq(prescriptionsTable.clinicId, clinicId), eq(prescriptionsTable.status, "active"))),
    db.select({ count: sql<number>`count(*)` }).from(inventoryItemsTable)
      .where(and(eq(inventoryItemsTable.clinicId, clinicId), eq(inventoryItemsTable.isActive, true), sql`${inventoryItemsTable.currentStock} <= ${inventoryItemsTable.minimumStock}`)),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(paymentsTable)
      .where(and(eq(paymentsTable.clinicId, clinicId), sql`${paymentsTable.paidAt} >= ${today}`)),
    db.select({ total: sql<string>`COALESCE(SUM(amount), 0)` }).from(paymentsTable)
      .where(and(eq(paymentsTable.clinicId, clinicId), sql`${paymentsTable.paidAt} >= ${monthStart}`)),
    db.select({ calledAt: queueEntriesTable.calledAt, completedAt: queueEntriesTable.completedAt, createdAt: queueEntriesTable.createdAt })
      .from(queueEntriesTable)
      .where(and(eq(queueEntriesTable.clinicId, clinicId), eq(queueEntriesTable.status, "completed"), sql`${queueEntriesTable.completedAt} IS NOT NULL`)),
  ]);

  const avgWaitMs = completedEntries.length > 0
    ? completedEntries.reduce((sum, e) => {
        const ms = new Date(e.completedAt!).getTime() - new Date(e.createdAt).getTime();
        return sum + Math.max(0, ms); // clamp negatives (bad seed data guard)
      }, 0) / completedEntries.length
    : 0;

  res.json({
    totalPatients: Number(totalPatientsResult?.count ?? 0),
    activeQueue: Number(activeQueueResult?.count ?? 0),
    appointmentsToday: Number(appointmentsTodayResult?.count ?? 0),
    avgWaitMinutes: Math.round(avgWaitMs / 60000),
    activeStaff: Number(activeStaffResult?.count ?? 0),
    completedToday: Number(completedTodayResult?.count ?? 0),
    pendingJoinRequests: Number(pendingJoinResult?.count ?? 0),
    pendingInvoices: Number(pendingInvoicesResult?.count ?? 0),
    pendingLabRequests: Number(pendingLabResult?.count ?? 0),
    pendingPrescriptions: Number(pendingRxResult?.count ?? 0),
    lowStockItems: Number(lowStockResult?.count ?? 0),
    revenueToday: parseFloat(revenueTodayResult?.total ?? "0"),
    monthlyRevenue: parseFloat(monthlyRevenueResult?.total ?? "0"),
  });
});

// GET /clinics/:clinicId/activity-logs — paginated, filtered, admin-only audit trail
router.get("/clinics/:clinicId/activity-logs", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 25)));
  const offset = (page - 1) * limit;

  const moduleFilter = req.query.module as string | undefined;
  const userRoleFilter = req.query.userRole as string | undefined;
  const actionTypeFilter = req.query.actionType as string | undefined;
  const search = req.query.search as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  const conditions: ReturnType<typeof eq>[] = [eq(activityLogsTable.clinicId, clinicId)];
  if (moduleFilter) conditions.push(eq(activityLogsTable.module as any, moduleFilter) as any);
  if (userRoleFilter) conditions.push(eq(activityLogsTable.userRole as any, userRoleFilter) as any);
  if (actionTypeFilter) conditions.push(eq(activityLogsTable.actionType as any, actionTypeFilter) as any);
  if (search) conditions.push(ilike(activityLogsTable.message, `%${search}%`) as any);
  if (dateFrom) conditions.push(sql`${activityLogsTable.createdAt} >= ${new Date(dateFrom)}` as any);
  if (dateTo) {
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    conditions.push(sql`${activityLogsTable.createdAt} <= ${to}` as any);
  }

  const where = and(...conditions);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)` })
    .from(activityLogsTable)
    .where(where);

  const logs = await db
    .select({
      id: activityLogsTable.id,
      clinicId: activityLogsTable.clinicId,
      userId: activityLogsTable.userId,
      userRole: activityLogsTable.userRole,
      module: activityLogsTable.module,
      actionType: activityLogsTable.actionType,
      type: activityLogsTable.type,
      message: activityLogsTable.message,
      entityId: activityLogsTable.entityId,
      createdAt: activityLogsTable.createdAt,
      userName: usersTable.name,
    })
    .from(activityLogsTable)
    .leftJoin(usersTable, eq(activityLogsTable.userId, usersTable.id))
    .where(where)
    .orderBy(sql`${activityLogsTable.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  res.json({
    data: logs,
    total: Number(countResult?.total ?? 0),
    page,
    limit,
  });
});

router.get("/clinics/:clinicId/analytics/activity", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const limit = Math.min(Number(req.query.limit ?? 20), 50);

  const activity = await db.select()
    .from(activityLogsTable)
    .where(eq(activityLogsTable.clinicId, clinicId))
    .orderBy(sql`${activityLogsTable.createdAt} DESC`)
    .limit(limit);

  res.json(activity);
});

router.get("/clinics/:clinicId/analytics/queue-trends", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

  const trends = await db.select({
    date: sql<string>`DATE(${queueEntriesTable.createdAt})::text`,
    count: sql<number>`count(*)`,
    completed: sql<number>`count(*) FILTER (WHERE ${queueEntriesTable.status} = 'completed')`,
  })
    .from(queueEntriesTable)
    .where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= NOW() - INTERVAL '7 days'`))
    .groupBy(sql`DATE(${queueEntriesTable.createdAt})`)
    .orderBy(sql`DATE(${queueEntriesTable.createdAt}) ASC`);

  res.json(trends.map(t => ({ date: t.date, count: Number(t.count), completed: Number(t.completed) })));
});

// ── GET /clinics/:clinicId/analytics/overview ─────────────────────────────────
router.get("/clinics/:clinicId/analytics/overview", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin") as any, async (req, res): Promise<void> => {
  const clinicId = cid(req.params.clinicId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - 6);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 29);

  const [
    [totalPatientsR],
    [newTodayR],
    [newWeekR],
    [queueTotalR],
    [queueCompletedR],
    [apptTotalR],
    [apptCompletedR],
    [revWeekR],
    [revMonthR],
    moduleActivity,
  ] = await Promise.all([
    db.select({ v: sql<number>`count(*)` }).from(patientsTable).where(eq(patientsTable.clinicId, clinicId)),
    db.select({ v: sql<number>`count(*)` }).from(patientsTable).where(and(eq(patientsTable.clinicId, clinicId), sql`${patientsTable.createdAt} >= ${today}`)),
    db.select({ v: sql<number>`count(*)` }).from(patientsTable).where(and(eq(patientsTable.clinicId, clinicId), sql`${patientsTable.createdAt} >= ${weekStart}`)),
    db.select({ v: sql<number>`count(*)` }).from(queueEntriesTable).where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= ${today}`)),
    db.select({ v: sql<number>`count(*)` }).from(queueEntriesTable).where(and(eq(queueEntriesTable.clinicId, clinicId), eq(queueEntriesTable.status, "completed"), sql`${queueEntriesTable.createdAt} >= ${today}`)),
    db.select({ v: sql<number>`count(*)` }).from(appointmentsTable).where(and(eq(appointmentsTable.clinicId, clinicId), sql`DATE(${appointmentsTable.scheduledAt}) = ${today.toISOString().split("T")[0]}`)),
    db.select({ v: sql<number>`count(*)` }).from(appointmentsTable).where(and(eq(appointmentsTable.clinicId, clinicId), sql`DATE(${appointmentsTable.scheduledAt}) = ${today.toISOString().split("T")[0]}`, sql`${appointmentsTable.status} IN ('completed','checked_in')`)),
    db.select({ v: sql<string>`COALESCE(SUM(amount),0)` }).from(paymentsTable).where(and(eq(paymentsTable.clinicId, clinicId), sql`${paymentsTable.paidAt} >= ${weekStart}`)),
    db.select({ v: sql<string>`COALESCE(SUM(amount),0)` }).from(paymentsTable).where(and(eq(paymentsTable.clinicId, clinicId), sql`${paymentsTable.paidAt} >= ${monthStart}`)),
    db.select({ module: activityLogsTable.module, count: sql<number>`count(*)` })
      .from(activityLogsTable)
      .where(and(eq(activityLogsTable.clinicId, clinicId), sql`${activityLogsTable.module} IS NOT NULL`, sql`${activityLogsTable.createdAt} >= ${thirtyDaysAgo}`))
      .groupBy(activityLogsTable.module)
      .orderBy(sql`count(*) DESC`)
      .limit(8),
  ]);

  const qTotal = Number(queueTotalR?.v ?? 0);
  const qDone = Number(queueCompletedR?.v ?? 0);

  res.json({
    totalPatients: Number(totalPatientsR?.v ?? 0),
    newPatientsToday: Number(newTodayR?.v ?? 0),
    newPatientsThisWeek: Number(newWeekR?.v ?? 0),
    queueTotalToday: qTotal,
    queueCompletedToday: qDone,
    completionRate: qTotal > 0 ? Math.round((qDone / qTotal) * 100) : 0,
    appointmentsToday: Number(apptTotalR?.v ?? 0),
    appointmentsCompleted: Number(apptCompletedR?.v ?? 0),
    moduleActivity: moduleActivity.map(m => ({ module: m.module ?? "", count: Number(m.count) })),
    revenueThisWeek: parseFloat(revWeekR?.v ?? "0"),
    revenueThisMonth: parseFloat(revMonthR?.v ?? "0"),
  });
});

// ── GET /clinics/:clinicId/analytics/queue-performance ────────────────────────
router.get("/clinics/:clinicId/analytics/queue-performance", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin") as any, async (req, res): Promise<void> => {
  const clinicId = cid(req.params.clinicId);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 6);

  const [timings, peakHoursRaw, dailyTrend, typeBreakdown, weekTotals] = await Promise.all([
    // Avg stage times over 7 days (completed entries only)
    db.select({
      avgWait:   sql<string>`AVG(EXTRACT(EPOCH FROM (COALESCE(${queueEntriesTable.nurseStartedAt}, ${queueEntriesTable.calledAt}, ${queueEntriesTable.completedAt}) - ${queueEntriesTable.createdAt}))/60)`,
      avgNurse:  sql<string>`AVG(EXTRACT(EPOCH FROM (COALESCE(${queueEntriesTable.doctorStartedAt}, ${queueEntriesTable.completedAt}) - COALESCE(${queueEntriesTable.nurseStartedAt}, ${queueEntriesTable.doctorStartedAt})))/60) FILTER (WHERE ${queueEntriesTable.nurseStartedAt} IS NOT NULL)`,
      avgDoctor: sql<string>`AVG(EXTRACT(EPOCH FROM (${queueEntriesTable.completedAt} - ${queueEntriesTable.doctorStartedAt}))/60) FILTER (WHERE ${queueEntriesTable.doctorStartedAt} IS NOT NULL)`,
      avgTotal:  sql<string>`AVG(EXTRACT(EPOCH FROM (${queueEntriesTable.completedAt} - ${queueEntriesTable.createdAt}))/60)`,
      total:     sql<number>`count(*)`,
    })
      .from(queueEntriesTable)
      .where(and(eq(queueEntriesTable.clinicId, clinicId), eq(queueEntriesTable.status, "completed"), sql`${queueEntriesTable.completedAt} IS NOT NULL`, sql`${queueEntriesTable.createdAt} >= ${sevenDaysAgo}`)),

    // Peak activity hours from activity_logs (7 days)
    db.select({
      hour:  sql<number>`EXTRACT(HOUR FROM ${activityLogsTable.createdAt})::int`,
      count: sql<number>`count(*)`,
    })
      .from(activityLogsTable)
      .where(and(eq(activityLogsTable.clinicId, clinicId), sql`${activityLogsTable.createdAt} >= ${sevenDaysAgo}`))
      .groupBy(sql`EXTRACT(HOUR FROM ${activityLogsTable.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${activityLogsTable.createdAt}) ASC`),

    // Daily queue trend (7 days)
    db.select({
      date:      sql<string>`DATE(${queueEntriesTable.createdAt})::text`,
      count:     sql<number>`count(*)`,
      completed: sql<number>`count(*) FILTER (WHERE ${queueEntriesTable.status} = 'completed')`,
    })
      .from(queueEntriesTable)
      .where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= ${sevenDaysAgo}`))
      .groupBy(sql`DATE(${queueEntriesTable.createdAt})`)
      .orderBy(sql`DATE(${queueEntriesTable.createdAt}) ASC`),

    // Type breakdown today
    db.select({
      type:  queueEntriesTable.type,
      count: sql<number>`count(*)`,
    })
      .from(queueEntriesTable)
      .where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= ${today}`))
      .groupBy(queueEntriesTable.type)
      .orderBy(sql`count(*) DESC`),

    // 7-day totals for completion rate
    db.select({ v: sql<number>`count(*)` }).from(queueEntriesTable).where(and(eq(queueEntriesTable.clinicId, clinicId), sql`${queueEntriesTable.createdAt} >= ${sevenDaysAgo}`)),
  ]);

  const t = timings[0];
  const total7d = Number(weekTotals[0]?.v ?? 0);
  const completed7d = Number(t?.total ?? 0);

  // Stage breakdown for the chart
  const stageBreakdown = [
    { stage: "Wait → Nurse", avgMinutes: Math.round(parseFloat(t?.avgWait ?? "0") * 10) / 10 },
    { stage: "Nurse Assessment", avgMinutes: Math.round(parseFloat(t?.avgNurse ?? "0") * 10) / 10 },
    { stage: "Doctor Consultation", avgMinutes: Math.round(parseFloat(t?.avgDoctor ?? "0") * 10) / 10 },
  ].filter(s => s.avgMinutes > 0);

  res.json({
    avgWaitMinutes: Math.round(parseFloat(t?.avgWait ?? "0") * 10) / 10,
    avgNurseMinutes: Math.round(parseFloat(t?.avgNurse ?? "0") * 10) / 10,
    avgDoctorMinutes: Math.round(parseFloat(t?.avgDoctor ?? "0") * 10) / 10,
    avgTotalMinutes: Math.round(parseFloat(t?.avgTotal ?? "0") * 10) / 10,
    totalCompleted7d: completed7d,
    completionRate7d: total7d > 0 ? Math.round((completed7d / total7d) * 100) : 0,
    dailyTrend: dailyTrend.map(d => ({ date: d.date, count: Number(d.count), completed: Number(d.completed) })),
    peakHours: peakHoursRaw.map(h => ({ hour: Number(h.hour), count: Number(h.count) })),
    stageBreakdown,
    typeBreakdown: typeBreakdown.map(t => ({ type: t.type, count: Number(t.count) })),
  });
});

// ── GET /clinics/:clinicId/analytics/staff-performance ────────────────────────
router.get("/clinics/:clinicId/analytics/staff-performance", requireAuth as any, requireClinicMember as any, requireRole("clinic_admin") as any, async (req, res): Promise<void> => {
  const clinicId = cid(req.params.clinicId);
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); sevenDaysAgo.setHours(0, 0, 0, 0);

  // Doctor performance: consultations (completed queue entries they were assigned to) + prescriptions + lab requests
  const doctors = await db.select({
    userId:          usersTable.id,
    name:            usersTable.name,
    staffCode:       usersTable.staffCode,
    role:            clinicMembersTable.role,
    consultations7d: sql<number>`count(DISTINCT ${queueEntriesTable.id}) FILTER (WHERE ${queueEntriesTable.status} = 'completed' AND ${queueEntriesTable.createdAt} >= ${sevenDaysAgo})`,
    prescriptions7d: sql<number>`count(DISTINCT ${prescriptionsTable.id}) FILTER (WHERE ${prescriptionsTable.createdAt} >= ${sevenDaysAgo})`,
    labRequests7d:   sql<number>`count(DISTINCT ${labRequestsTable.id}) FILTER (WHERE ${labRequestsTable.createdAt} >= ${sevenDaysAgo})`,
  })
    .from(usersTable)
    .innerJoin(clinicMembersTable, and(eq(clinicMembersTable.userId, usersTable.id), eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.role, "doctor"), eq(clinicMembersTable.status, "active")))
    .leftJoin(queueEntriesTable, and(eq(queueEntriesTable.assignedDoctorId, usersTable.id), eq(queueEntriesTable.clinicId, clinicId)))
    .leftJoin(prescriptionsTable, and(eq(prescriptionsTable.doctorId, usersTable.id), eq(prescriptionsTable.clinicId, clinicId)))
    .leftJoin(labRequestsTable, and(eq(labRequestsTable.doctorId, usersTable.id), eq(labRequestsTable.clinicId, clinicId)))
    .groupBy(usersTable.id, usersTable.name, usersTable.staffCode, clinicMembersTable.role)
    .orderBy(sql`count(DISTINCT ${queueEntriesTable.id}) FILTER (WHERE ${queueEntriesTable.status} = 'completed' AND ${queueEntriesTable.createdAt} >= ${sevenDaysAgo}) DESC`);

  // Nurse performance: queue entries they did nurse assessment on
  const nurses = await db.select({
    userId:        usersTable.id,
    name:          usersTable.name,
    staffCode:     usersTable.staffCode,
    role:          clinicMembersTable.role,
    assessments7d: sql<number>`count(DISTINCT ${queueEntriesTable.id}) FILTER (WHERE ${queueEntriesTable.nurseStartedAt} IS NOT NULL AND ${queueEntriesTable.createdAt} >= ${sevenDaysAgo})`,
  })
    .from(usersTable)
    .innerJoin(clinicMembersTable, and(eq(clinicMembersTable.userId, usersTable.id), eq(clinicMembersTable.clinicId, clinicId), eq(clinicMembersTable.role, "nurse"), eq(clinicMembersTable.status, "active")))
    .leftJoin(queueEntriesTable, and(eq(queueEntriesTable.assignedNurseId, usersTable.id), eq(queueEntriesTable.clinicId, clinicId)))
    .groupBy(usersTable.id, usersTable.name, usersTable.staffCode, clinicMembersTable.role)
    .orderBy(sql`count(DISTINCT ${queueEntriesTable.id}) FILTER (WHERE ${queueEntriesTable.nurseStartedAt} IS NOT NULL AND ${queueEntriesTable.createdAt} >= ${sevenDaysAgo}) DESC`);

  res.json({
    doctors: doctors.map(d => ({
      userId: d.userId, name: d.name, staffCode: d.staffCode, role: d.role,
      consultations7d: Number(d.consultations7d), prescriptions7d: Number(d.prescriptions7d),
      labRequests7d: Number(d.labRequests7d), assessments7d: 0,
    })),
    nurses: nurses.map(n => ({
      userId: n.userId, name: n.name, staffCode: n.staffCode, role: n.role,
      consultations7d: 0, prescriptions7d: 0, labRequests7d: 0,
      assessments7d: Number(n.assessments7d),
    })),
    periodDays: 7,
  });
});

// GET /clinics/:clinicId/notifications
router.get("/clinics/:clinicId/notifications", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;

  const items = await db.select()
    .from(notificationsTable)
    .where(and(eq(notificationsTable.clinicId, clinicId), eq(notificationsTable.userId, user.userId)))
    .orderBy(sql`${notificationsTable.createdAt} DESC`)
    .limit(50);

  res.json(items);
});

// PATCH /clinics/:clinicId/notifications/read-all
router.patch("/clinics/:clinicId/notifications/read-all", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;

  await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.clinicId, clinicId), eq(notificationsTable.userId, user.userId), eq(notificationsTable.isRead, false)));

  res.json({ success: true });
});

// PATCH /clinics/:clinicId/notifications/:notificationId/read
router.patch("/clinics/:clinicId/notifications/:notificationId/read", requireAuth as any, requireClinicMember as any, async (req, res): Promise<void> => {
  const notificationId = Array.isArray(req.params.notificationId) ? req.params.notificationId[0] : req.params.notificationId;
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;

  const [notification] = await db.update(notificationsTable)
    .set({ isRead: true })
    .where(and(eq(notificationsTable.id, notificationId), eq(notificationsTable.userId, user.userId), eq(notificationsTable.clinicId, clinicId)))
    .returning();

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }
  res.json(notification);
});

export default router;
