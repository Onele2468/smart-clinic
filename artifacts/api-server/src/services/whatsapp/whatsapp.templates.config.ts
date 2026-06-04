import { db } from "@workspace/db";
import { clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const DEFAULT_TEMPLATE = process.env.WHATSAPP_DEFAULT_TEMPLATE ?? "hello_world";

/** Resolve approved Meta template for an action (clinic override → default outbound → hello_world). */
export async function resolveTemplateNameForAction(
  clinicId: string,
  actionType: string,
  fallbackOutboundTemplate: string | null,
): Promise<string> {
  const [row] = await db
    .select({ whatsappTemplatesConfig: clinicsTable.whatsappTemplatesConfig })
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId));

  const cfg = (row?.whatsappTemplatesConfig ?? {}) as Record<string, string>;
  const perAction = cfg[actionType]?.trim();
  if (perAction) return perAction;

  const clinicDefault = fallbackOutboundTemplate?.trim();
  if (clinicDefault) return clinicDefault;

  return DEFAULT_TEMPLATE;
}

export function parseWhatsappTemplatesConfig(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) out[key] = value.trim();
  }
  return out;
}
