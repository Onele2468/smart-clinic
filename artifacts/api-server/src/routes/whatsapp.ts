import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { clinicsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole } from "../lib/auth";
import { toWhatsAppSettingsResponse } from "../lib/clinicSerializer";
import {
  deliverPatientWhatsAppMessage,
  getClinicWhatsAppConfig,
  normalizePhoneNumber,
} from "../services/whatsapp/whatsapp.service";
import {
  DEFAULT_OPERATIONAL_ALERTS_CONFIG,
  parseOperationalAlertsConfig,
  type OperationalAlertsConfig,
} from "../services/whatsapp/operationalAlerts.types";
import {
  DEFAULT_WHATSAPP_REMINDER_CONFIG,
  parseWhatsappReminderConfig,
} from "../services/whatsapp/whatsapp.reminders.types";
import { parseWhatsappTemplatesConfig } from "../services/whatsapp/whatsapp.templates.config";
import {
  getFailedWhatsappMessages,
  getWhatsappDeliverySummary,
} from "../services/whatsapp/whatsapp.monitoring";

const router: IRouter = Router();

const UpdateWhatsAppSettingsBody = z.object({
  whatsappEnabled: z.boolean().optional(),
  whatsappProvider: z.enum(["meta", "twilio", "360dialog"]).optional(),
  whatsappAccessToken: z.string().optional().nullable(),
  whatsappPhoneNumberId: z.string().optional().nullable(),
  whatsappBusinessAccountId: z.string().optional().nullable(),
  whatsappMessagingMode: z.enum(["text", "template", "auto"]).optional(),
  whatsappOutboundTemplate: z.string().optional().nullable(),
});

const TestWhatsAppBody = z.object({
  phone: z.string().min(9),
  message: z.string().optional(),
});

const AlertToggleBody = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().int().min(1).optional(),
});

const UpdateOperationalAlertsBody = z.object({
  enabled: z.boolean().optional(),
  recipientPhone: z.string().optional().nullable(),
  patientRegistered: AlertToggleBody.optional(),
  queueThreshold: AlertToggleBody.optional(),
  lowInventory: AlertToggleBody.optional(),
  labRequestCreated: AlertToggleBody.optional(),
  unpaidInvoices: AlertToggleBody.optional(),
  staffJoinRequest: AlertToggleBody.optional(),
  highPatientVolume: AlertToggleBody.optional(),
});

function mergeOperationalAlertsConfig(
  current: OperationalAlertsConfig,
  patch: z.infer<typeof UpdateOperationalAlertsBody>,
): OperationalAlertsConfig {
  const mergeToggle = (
    existing: { enabled: boolean; threshold?: number },
    incoming?: { enabled?: boolean; threshold?: number },
  ) => ({
    enabled: incoming?.enabled ?? existing.enabled,
    threshold: incoming?.threshold ?? existing.threshold,
  });

  return {
    enabled: patch.enabled ?? current.enabled,
    recipientPhone: patch.recipientPhone !== undefined ? patch.recipientPhone : current.recipientPhone,
    patientRegistered: mergeToggle(current.patientRegistered, patch.patientRegistered),
    queueThreshold: mergeToggle(current.queueThreshold, patch.queueThreshold),
    lowInventory: mergeToggle(current.lowInventory, patch.lowInventory),
    labRequestCreated: mergeToggle(current.labRequestCreated, patch.labRequestCreated),
    unpaidInvoices: mergeToggle(current.unpaidInvoices, patch.unpaidInvoices),
    staffJoinRequest: mergeToggle(current.staffJoinRequest, patch.staffJoinRequest),
    highPatientVolume: mergeToggle(current.highPatientVolume, patch.highPatientVolume),
  };
}

// GET /clinics/:clinicId/whatsapp/settings
router.get(
  "/clinics/:clinicId/whatsapp/settings",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

    const [clinic] = await db
      .select({
        whatsappEnabled: clinicsTable.whatsappEnabled,
        whatsappProvider: clinicsTable.whatsappProvider,
        whatsappAccessToken: clinicsTable.whatsappAccessToken,
        whatsappPhoneNumberId: clinicsTable.whatsappPhoneNumberId,
        whatsappBusinessAccountId: clinicsTable.whatsappBusinessAccountId,
        whatsappMessagingMode: clinicsTable.whatsappMessagingMode,
        whatsappOutboundTemplate: clinicsTable.whatsappOutboundTemplate,
      })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));

    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }

    res.json(toWhatsAppSettingsResponse(clinic));
  },
);

// PATCH /clinics/:clinicId/whatsapp/settings
router.patch(
  "/clinics/:clinicId/whatsapp/settings",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

    const parsed = UpdateWhatsAppSettingsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.whatsappEnabled !== undefined) updates.whatsappEnabled = parsed.data.whatsappEnabled;
    if (parsed.data.whatsappProvider !== undefined) updates.whatsappProvider = parsed.data.whatsappProvider;
    if (parsed.data.whatsappPhoneNumberId !== undefined) {
      updates.whatsappPhoneNumberId = parsed.data.whatsappPhoneNumberId;
    }
    if (parsed.data.whatsappBusinessAccountId !== undefined) {
      updates.whatsappBusinessAccountId = parsed.data.whatsappBusinessAccountId;
    }
    if (parsed.data.whatsappAccessToken !== undefined) {
      const token = parsed.data.whatsappAccessToken;
      // Ignore blank strings so clients can PATCH other fields without clearing the token.
      if (token !== null && token.trim() === "") {
        // no-op
      } else {
        updates.whatsappAccessToken = token;
      }
    }
    if (parsed.data.whatsappMessagingMode !== undefined) {
      updates.whatsappMessagingMode = parsed.data.whatsappMessagingMode;
    }
    if (parsed.data.whatsappOutboundTemplate !== undefined) {
      const tpl = parsed.data.whatsappOutboundTemplate;
      updates.whatsappOutboundTemplate = tpl === null || tpl.trim() === "" ? null : tpl.trim();
    }

    const [clinic] = await db
      .update(clinicsTable)
      .set(updates)
      .where(eq(clinicsTable.id, clinicId))
      .returning({
        whatsappEnabled: clinicsTable.whatsappEnabled,
        whatsappProvider: clinicsTable.whatsappProvider,
        whatsappPhoneNumberId: clinicsTable.whatsappPhoneNumberId,
        whatsappBusinessAccountId: clinicsTable.whatsappBusinessAccountId,
        whatsappAccessToken: clinicsTable.whatsappAccessToken,
        whatsappMessagingMode: clinicsTable.whatsappMessagingMode,
        whatsappOutboundTemplate: clinicsTable.whatsappOutboundTemplate,
      });

    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }

    res.json(toWhatsAppSettingsResponse(clinic));
  },
);

// GET /clinics/:clinicId/whatsapp/operational-alerts
router.get(
  "/clinics/:clinicId/whatsapp/operational-alerts",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

    const [clinic] = await db
      .select({ operationalAlertsConfig: clinicsTable.operationalAlertsConfig })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));

    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }

    res.json(parseOperationalAlertsConfig(clinic.operationalAlertsConfig ?? DEFAULT_OPERATIONAL_ALERTS_CONFIG));
  },
);

// PATCH /clinics/:clinicId/whatsapp/operational-alerts
router.patch(
  "/clinics/:clinicId/whatsapp/operational-alerts",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

    const parsed = UpdateOperationalAlertsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [existing] = await db
      .select({ operationalAlertsConfig: clinicsTable.operationalAlertsConfig })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));

    if (!existing) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }

    const current = parseOperationalAlertsConfig(existing.operationalAlertsConfig);
    const merged = mergeOperationalAlertsConfig(current, parsed.data);

    const [clinic] = await db
      .update(clinicsTable)
      .set({ operationalAlertsConfig: merged })
      .where(eq(clinicsTable.id, clinicId))
      .returning({ operationalAlertsConfig: clinicsTable.operationalAlertsConfig });

    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }

    res.json(parseOperationalAlertsConfig(clinic.operationalAlertsConfig));
  },
);

// POST /clinics/:clinicId/whatsapp/test — verify Meta credentials and delivery path
router.post(
  "/clinics/:clinicId/whatsapp/test",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const parsed = TestWhatsAppBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const config = await getClinicWhatsAppConfig(clinicId);
    if (!config?.enabled) {
      res.status(400).json({ error: "WhatsApp is not enabled for this clinic" });
      return;
    }
    if (!config.accessToken || !config.phoneNumberId) {
      res.status(400).json({ error: "WhatsApp credentials incomplete for this clinic" });
      return;
    }

    const toPhone = normalizePhoneNumber(parsed.data.phone);
    if (!toPhone) {
      res.status(400).json({ error: "Invalid phone number" });
      return;
    }

    const body =
      parsed.data.message?.trim() ||
      "Smart Clinic WhatsApp test — your integration is configured correctly.";

    try {
      await deliverPatientWhatsAppMessage({
        config,
        toPhone,
        body,
        logContext: { clinicId, actionType: "test", recipientType: "test" },
      });
      res.json({
        success: true,
        to: toPhone,
        messagingMode: config.messagingMode,
        template: config.outboundTemplate ?? process.env.WHATSAPP_DEFAULT_TEMPLATE ?? "hello_world",
        message: "Test message dispatched. Check server logs for Meta API response.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(502).json({ error: "WhatsApp test failed", detail: msg });
    }
  },
);

const UpdateReminderConfigBody = z.object({
  enabled: z.boolean().optional(),
  appointmentReminders: z
    .object({
      enabled: z.boolean().optional(),
      hoursBefore: z.array(z.number().int().min(1).max(168)).optional(),
    })
    .optional(),
  followUpReminders: z
    .object({
      enabled: z.boolean().optional(),
      daysAfterConsultation: z.array(z.number().int().min(1).max(90)).optional(),
    })
    .optional(),
});

const UpdateTemplatesConfigBody = z.record(z.string(), z.string());

// GET /clinics/:clinicId/whatsapp/reminders
router.get(
  "/clinics/:clinicId/whatsapp/reminders",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const [clinic] = await db
      .select({ whatsappReminderConfig: clinicsTable.whatsappReminderConfig })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));
    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }
    res.json(parseWhatsappReminderConfig(clinic.whatsappReminderConfig ?? DEFAULT_WHATSAPP_REMINDER_CONFIG));
  },
);

// PATCH /clinics/:clinicId/whatsapp/reminders
router.patch(
  "/clinics/:clinicId/whatsapp/reminders",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const parsed = UpdateReminderConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [existing] = await db
      .select({ whatsappReminderConfig: clinicsTable.whatsappReminderConfig })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));
    if (!existing) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }
    const current = parseWhatsappReminderConfig(existing.whatsappReminderConfig);
    const merged = {
      enabled: parsed.data.enabled ?? current.enabled,
      appointmentReminders: {
        enabled:
          parsed.data.appointmentReminders?.enabled ?? current.appointmentReminders.enabled,
        hoursBefore:
          parsed.data.appointmentReminders?.hoursBefore ?? current.appointmentReminders.hoursBefore,
      },
      followUpReminders: {
        enabled: parsed.data.followUpReminders?.enabled ?? current.followUpReminders.enabled,
        daysAfterConsultation:
          parsed.data.followUpReminders?.daysAfterConsultation ??
          current.followUpReminders.daysAfterConsultation,
      },
    };
    const [clinic] = await db
      .update(clinicsTable)
      .set({ whatsappReminderConfig: merged })
      .where(eq(clinicsTable.id, clinicId))
      .returning({ whatsappReminderConfig: clinicsTable.whatsappReminderConfig });
    res.json(parseWhatsappReminderConfig(clinic!.whatsappReminderConfig));
  },
);

// GET /clinics/:clinicId/whatsapp/templates
router.get(
  "/clinics/:clinicId/whatsapp/templates",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const [clinic] = await db
      .select({ whatsappTemplatesConfig: clinicsTable.whatsappTemplatesConfig })
      .from(clinicsTable)
      .where(eq(clinicsTable.id, clinicId));
    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }
    res.json(parseWhatsappTemplatesConfig(clinic.whatsappTemplatesConfig));
  },
);

// PATCH /clinics/:clinicId/whatsapp/templates
router.patch(
  "/clinics/:clinicId/whatsapp/templates",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const parsed = UpdateTemplatesConfigBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const [clinic] = await db
      .update(clinicsTable)
      .set({ whatsappTemplatesConfig: parsed.data })
      .where(eq(clinicsTable.id, clinicId))
      .returning({ whatsappTemplatesConfig: clinicsTable.whatsappTemplatesConfig });
    if (!clinic) {
      res.status(404).json({ error: "Clinic not found" });
      return;
    }
    res.json(parseWhatsappTemplatesConfig(clinic.whatsappTemplatesConfig));
  },
);

// GET /clinics/:clinicId/whatsapp/messages — delivery dashboard
router.get(
  "/clinics/:clinicId/whatsapp/messages",
  requireAuth as any,
  requireClinicMember as any,
  requireRole("clinic_admin") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const status = req.query.status as string | undefined;
    const summary = await getWhatsappDeliverySummary(clinicId);
    const failed = status === "failed" ? await getFailedWhatsappMessages(clinicId) : undefined;
    res.json({ summary, failed });
  },
);

export default router;
