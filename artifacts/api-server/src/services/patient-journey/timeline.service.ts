import { db, patientJourneyTimelineTable } from "@workspace/db";

export async function recordPatientJourneyEvent(params: {
  clinicId: string;
  patientId: string;
  actorUserId?: string | null;
  module: string;
  eventType: string;
  title: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(patientJourneyTimelineTable).values({
    clinicId: params.clinicId,
    patientId: params.patientId,
    actorUserId: params.actorUserId ?? null,
    module: params.module,
    eventType: params.eventType,
    title: params.title,
    description: params.description,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}
