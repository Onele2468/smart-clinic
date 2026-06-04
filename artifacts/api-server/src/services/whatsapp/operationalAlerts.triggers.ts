import { db } from "@workspace/db";
import { invoicesTable, queueEntriesTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logActivity } from "../../lib/activityLogger";
import { getOperationalAlertsConfig } from "./operationalAlerts.config";
import type { OperationalAlertAction } from "./operationalAlerts.types";

export interface LogOperationalAlertParams {
  clinicId: string;
  userId?: string | null;
  userRole?: string | null;
  module?: string | null;
  actionType: OperationalAlertAction;
  message: string;
  entityId?: string | null;
}

/**
 * Records an operational alert in activity_logs.
 * In-app notifications and WhatsApp are handled by activityLogger after insert.
 */
export function logOperationalAlert(params: LogOperationalAlertParams): void {
  logActivity({
    clinicId: params.clinicId,
    userId: params.userId ?? null,
    userRole: params.userRole ?? null,
    module: params.module ?? "operations",
    actionType: params.actionType,
    type: "operational_alert",
    message: params.message,
    entityId: params.entityId ?? null,
  });
}

/** Fire alert only when value crosses from below threshold to at/above threshold. */
export function crossedThreshold(previous: number, current: number, threshold: number): boolean {
  return previous < threshold && current >= threshold;
}

export async function countWaitingQueue(clinicId: string, todayStart: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(queueEntriesTable)
    .where(
      and(
        eq(queueEntriesTable.clinicId, clinicId),
        eq(queueEntriesTable.status, "waiting"),
        sql`${queueEntriesTable.createdAt} >= ${todayStart.toISOString()}`,
      ),
    );
  return Number(row?.count ?? 0);
}

export async function countTodayQueueEntries(clinicId: string, todayStart: Date): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(queueEntriesTable)
    .where(
      and(
        eq(queueEntriesTable.clinicId, clinicId),
        sql`${queueEntriesTable.createdAt} >= ${todayStart.toISOString()}`,
      ),
    );
  return Number(row?.count ?? 0);
}

export async function countUnpaidInvoices(clinicId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.clinicId, clinicId),
        inArray(invoicesTable.status, ["unpaid", "partial"]),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function maybeLogQueueThresholdAlert(params: {
  clinicId: string;
  userId?: string;
  userRole?: string;
  waitingBefore: number;
  waitingAfter: number;
  entityId: string;
  ticketNumber: string;
}): Promise<void> {
  const config = await getOperationalAlertsConfig(params.clinicId);
  const threshold = config.queueThreshold.threshold ?? 10;
  if (!crossedThreshold(params.waitingBefore, params.waitingAfter, threshold)) return;

  logOperationalAlert({
    clinicId: params.clinicId,
    userId: params.userId,
    userRole: params.userRole,
    module: "queue",
    actionType: "op_alert_queue_threshold",
    message: `Queue threshold exceeded: ${params.waitingAfter} patients waiting (threshold: ${threshold}). Latest ticket: ${params.ticketNumber}.`,
    entityId: params.entityId,
  });
}

export async function maybeLogHighPatientVolumeAlert(params: {
  clinicId: string;
  userId?: string;
  userRole?: string;
  volumeBefore: number;
  volumeAfter: number;
  entityId: string;
}): Promise<void> {
  const config = await getOperationalAlertsConfig(params.clinicId);
  const threshold = config.highPatientVolume.threshold ?? 50;
  if (!crossedThreshold(params.volumeBefore, params.volumeAfter, threshold)) return;

  logOperationalAlert({
    clinicId: params.clinicId,
    userId: params.userId,
    userRole: params.userRole,
    module: "queue",
    actionType: "op_alert_high_patient_volume",
    message: `High patient volume: ${params.volumeAfter} patients in queue today (threshold: ${threshold}).`,
    entityId: params.entityId,
  });
}

export async function maybeLogUnpaidInvoicesAlert(params: {
  clinicId: string;
  userId?: string;
  userRole?: string;
  unpaidBefore: number;
  unpaidAfter: number;
  entityId: string;
}): Promise<void> {
  const config = await getOperationalAlertsConfig(params.clinicId);
  const threshold = config.unpaidInvoices.threshold ?? 5;
  if (!crossedThreshold(params.unpaidBefore, params.unpaidAfter, threshold)) return;

  logOperationalAlert({
    clinicId: params.clinicId,
    userId: params.userId,
    userRole: params.userRole,
    module: "billing",
    actionType: "op_alert_unpaid_invoices",
    message: `Unpaid invoices threshold exceeded: ${params.unpaidAfter} unpaid/partial invoices (threshold: ${threshold}).`,
    entityId: params.entityId,
  });
}
