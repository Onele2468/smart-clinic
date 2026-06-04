import { db } from "@workspace/db";
import { clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { parseOperationalAlertsConfig, type OperationalAlertsConfig } from "./operationalAlerts.types";

export async function getOperationalAlertsConfig(clinicId: string): Promise<OperationalAlertsConfig> {
  const [clinic] = await db
    .select({ config: clinicsTable.operationalAlertsConfig })
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId));

  return parseOperationalAlertsConfig(clinic?.config);
}
