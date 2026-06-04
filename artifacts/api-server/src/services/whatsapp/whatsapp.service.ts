import { db } from "@workspace/db";
import {
  clinicsTable,
  patientsTable,
  appointmentsTable,
  prescriptionsTable,
  labRequestsTable,
  labResultsTable,
  invoicesTable,
  usersTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { buildWhatsAppMessage, buildOperationalAlertMessage } from "./whatsapp.templates";
import {
  postMetaMessages,
  shouldRetryWithTemplate,
} from "./whatsapp.meta";
import type {
  ClinicWhatsAppConfig,
  SendWhatsAppMessageParams,
  WhatsAppDispatchPayload,
  WhatsAppMessagingMode,
  WhatsAppProvider,
  WhatsAppTemplateContext,
  WhatsAppTriggerAction,
} from "./whatsapp.types";
import {
  WHATSAPP_TRIGGER_ACTIONS,
  isOperationalAlertAction,
  OPERATIONAL_ALERT_CONFIG_KEY,
} from "./whatsapp.types";
import { getOperationalAlertsConfig } from "./operationalAlerts.config";
import {
  classifyFailure,
  computeNextRetry,
  createWhatsappMessageRecord,
  markWhatsappMessageFailed,
  markWhatsappMessageSent,
} from "./whatsapp.delivery";
import { notifyWhatsappDeliveryFailure } from "./whatsapp.monitoring";
import { resolveTemplateNameForAction } from "./whatsapp.templates.config";
import type { MetaSendResult } from "./whatsapp.meta";

const DEFAULT_TEMPLATE_NAME = process.env.WHATSAPP_DEFAULT_TEMPLATE ?? "hello_world";
const DEFAULT_TEMPLATE_LANGUAGE = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";

function formatAppointmentDate(d: Date): string {
  return d.toLocaleString("en-ZA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Normalize SA/local numbers to digits-only E.164 without '+'. */
export function normalizePhoneNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("27") && digits.length >= 11) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `27${digits.slice(1)}`;
  if (digits.length === 9) return `27${digits}`;
  return digits;
}

function resolveMessagingMode(config: ClinicWhatsAppConfig): WhatsAppMessagingMode {
  const mode = config.messagingMode ?? "auto";
  if (mode === "text" || mode === "template" || mode === "auto") return mode;
  return "auto";
}

function resolveDefaultTemplateName(config: ClinicWhatsAppConfig): string {
  return config.outboundTemplate?.trim() || DEFAULT_TEMPLATE_NAME;
}

export async function getClinicWhatsAppConfig(clinicId: string): Promise<ClinicWhatsAppConfig | null> {
  const [clinic] = await db
    .select({
      clinicId: clinicsTable.id,
      enabled: clinicsTable.whatsappEnabled,
      provider: clinicsTable.whatsappProvider,
      accessToken: clinicsTable.whatsappAccessToken,
      phoneNumberId: clinicsTable.whatsappPhoneNumberId,
      businessAccountId: clinicsTable.whatsappBusinessAccountId,
      messagingMode: clinicsTable.whatsappMessagingMode,
      outboundTemplate: clinicsTable.whatsappOutboundTemplate,
    })
    .from(clinicsTable)
    .where(eq(clinicsTable.id, clinicId));

  if (!clinic) return null;

  return {
    clinicId: clinic.clinicId,
    enabled: clinic.enabled,
    provider: (clinic.provider ?? "meta") as WhatsAppProvider,
    accessToken: clinic.accessToken ?? null,
    phoneNumberId: clinic.phoneNumberId ?? null,
    businessAccountId: clinic.businessAccountId ?? null,
    messagingMode: (clinic.messagingMode ?? "auto") as WhatsAppMessagingMode,
    outboundTemplate: clinic.outboundTemplate ?? null,
  };
}

async function resolvePatientById(clinicId: string, patientId: string) {
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(and(eq(patientsTable.id, patientId), eq(patientsTable.clinicId, clinicId)));
  return patient ?? null;
}

async function resolvePatientPhoneContext(
  clinicId: string,
  patientId: string,
): Promise<{ phone: string | null; context: WhatsAppTemplateContext }> {
  const patient = await resolvePatientById(clinicId, patientId);
  if (!patient) return { phone: null, context: {} };
  return {
    phone: normalizePhoneNumber(patient.contactNumber),
    context: { patientName: `${patient.firstName} ${patient.lastName}`.trim() },
  };
}

async function resolveTemplateContext(
  clinicId: string,
  actionType: WhatsAppTriggerAction,
  entityId?: string | null,
): Promise<{ phone: string | null; context: WhatsAppTemplateContext; patientId?: string }> {
  const ctx: WhatsAppTemplateContext = {};

  if (!entityId) {
    return { phone: null, context: ctx };
  }

  switch (actionType) {
    case "nurse_assessment_completed":
    case "consultation_completed":
    case "follow_up_reminder":
    case "queue_check_in":
    case "patient_added": {
      const resolved = await resolvePatientPhoneContext(clinicId, entityId);
      return { ...resolved, patientId: entityId };
    }

    case "appointment_booked":
    case "appointment_cancelled":
    case "appointment_checked_in":
    case "appointment_reminder": {
      const [row] = await db
        .select({
          patientId: appointmentsTable.patientId,
          scheduledAt: appointmentsTable.scheduledAt,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
          contactNumber: patientsTable.contactNumber,
          doctorName: usersTable.name,
        })
        .from(appointmentsTable)
        .innerJoin(patientsTable, eq(appointmentsTable.patientId, patientsTable.id))
        .innerJoin(usersTable, eq(appointmentsTable.doctorId, usersTable.id))
        .where(and(eq(appointmentsTable.id, entityId), eq(appointmentsTable.clinicId, clinicId)));
      if (!row) return { phone: null, context: ctx };
      ctx.patientName = `${row.patientFirst} ${row.patientLast}`.trim();
      ctx.doctorName = row.doctorName ?? undefined;
      ctx.appointmentDate = row.scheduledAt
        ? formatAppointmentDate(new Date(row.scheduledAt))
        : undefined;
      return {
        phone: normalizePhoneNumber(row.contactNumber),
        context: ctx,
        patientId: row.patientId,
      };
    }

    case "prescription_created":
    case "dispense": {
      const [row] = await db
        .select({
          status: prescriptionsTable.status,
          patientId: prescriptionsTable.patientId,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
          contactNumber: patientsTable.contactNumber,
        })
        .from(prescriptionsTable)
        .innerJoin(patientsTable, eq(prescriptionsTable.patientId, patientsTable.id))
        .where(and(eq(prescriptionsTable.id, entityId), eq(prescriptionsTable.clinicId, clinicId)));
      if (!row) return { phone: null, context: ctx };
      if (actionType === "dispense" && row.status !== "dispensed") {
        return { phone: null, context: ctx };
      }
      ctx.patientName = `${row.patientFirst} ${row.patientLast}`.trim();
      return {
        phone: normalizePhoneNumber(row.contactNumber),
        context: ctx,
        patientId: row.patientId,
      };
    }

    case "lab_request_created": {
      const [row] = await db
        .select({
          patientId: labRequestsTable.patientId,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
          contactNumber: patientsTable.contactNumber,
        })
        .from(labRequestsTable)
        .innerJoin(patientsTable, eq(labRequestsTable.patientId, patientsTable.id))
        .where(and(eq(labRequestsTable.id, entityId), eq(labRequestsTable.clinicId, clinicId)));
      if (!row) return { phone: null, context: ctx };
      ctx.patientName = `${row.patientFirst} ${row.patientLast}`.trim();
      return {
        phone: normalizePhoneNumber(row.contactNumber),
        context: ctx,
        patientId: row.patientId,
      };
    }

    case "lab_result_submitted": {
      const [row] = await db
        .select({
          patientId: labResultsTable.patientId,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
          contactNumber: patientsTable.contactNumber,
        })
        .from(labResultsTable)
        .innerJoin(patientsTable, eq(labResultsTable.patientId, patientsTable.id))
        .where(and(eq(labResultsTable.id, entityId), eq(labResultsTable.clinicId, clinicId)));
      if (!row) return { phone: null, context: ctx };
      ctx.patientName = `${row.patientFirst} ${row.patientLast}`.trim();
      return {
        phone: normalizePhoneNumber(row.contactNumber),
        context: ctx,
        patientId: row.patientId,
      };
    }

    case "invoice_created":
    case "payment_recorded": {
      const [row] = await db
        .select({
          patientId: invoicesTable.patientId,
          totalAmount: invoicesTable.totalAmount,
          patientFirst: patientsTable.firstName,
          patientLast: patientsTable.lastName,
          contactNumber: patientsTable.contactNumber,
        })
        .from(invoicesTable)
        .innerJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
        .where(and(eq(invoicesTable.id, entityId), eq(invoicesTable.clinicId, clinicId)));
      if (!row) return { phone: null, context: ctx };
      ctx.patientName = `${row.patientFirst} ${row.patientLast}`.trim();
      ctx.amount = String(row.totalAmount ?? "");
      return {
        phone: normalizePhoneNumber(row.contactNumber),
        context: ctx,
        patientId: row.patientId,
      };
    }

    default:
      return { phone: null, context: ctx };
  }
}

async function sendMetaText(
  config: ClinicWhatsAppConfig,
  toPhone: string,
  body: string,
  logContext: Record<string, unknown>,
) {
  return postMetaMessages(
    config.phoneNumberId!,
    config.accessToken!,
    {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "text",
      text: { body },
    },
    { ...logContext, deliveryMode: "text" },
  );
}

async function sendMetaTemplate(
  config: ClinicWhatsAppConfig,
  toPhone: string,
  templateName: string,
  logContext: Record<string, unknown>,
  bodyText?: string,
) {
  const template: Record<string, unknown> = {
    name: templateName,
    language: { code: DEFAULT_TEMPLATE_LANGUAGE },
  };

  // Optional single-variable utility templates ({{1}} = message body)
  if (bodyText && templateName !== "hello_world") {
    template.components = [
      {
        type: "body",
        parameters: [{ type: "text", text: bodyText.slice(0, 1024) }],
      },
    ];
  }

  return postMetaMessages(
    config.phoneNumberId!,
    config.accessToken!,
    {
      messaging_product: "whatsapp",
      to: toPhone,
      type: "template",
      template,
    },
    { ...logContext, deliveryMode: "template", templateName },
  );
}

/**
 * Send patient message via Meta: respects clinic messaging mode; auto-falls back to template.
 */
export interface DeliverPatientWhatsAppResult {
  metaMessageId?: string;
  templateName: string;
}

export async function deliverPatientWhatsAppMessage(params: {
  config: ClinicWhatsAppConfig;
  toPhone: string;
  body: string;
  logContext: Record<string, unknown>;
  templateNameOverride?: string;
}): Promise<DeliverPatientWhatsAppResult> {
  const { config, toPhone, body, logContext } = params;
  const mode = resolveMessagingMode(config);
  const templateName = params.templateNameOverride?.trim() || resolveDefaultTemplateName(config);

  const finalize = (result: MetaSendResult, usedTemplate: string) => {
    if (!result.ok) {
      throw Object.assign(new Error(result.errorMessage ?? "Meta send failed"), {
        metaResult: result,
      });
    }
    return { metaMessageId: result.messageId, templateName: usedTemplate };
  };

  if (mode === "template") {
    return finalize(await sendMetaTemplate(config, toPhone, templateName, logContext, body), templateName);
  }

  if (mode === "text") {
    return finalize(await sendMetaText(config, toPhone, body, logContext), templateName);
  }

  const textResult = await sendMetaText(config, toPhone, body, logContext);
  if (textResult.ok) {
    return { metaMessageId: textResult.messageId, templateName: "session_text" };
  }

  if (!shouldRetryWithTemplate(textResult)) {
    throw Object.assign(new Error(textResult.errorMessage ?? "Meta text failed"), { metaResult: textResult });
  }

  logger.info(
    { ...logContext, metaErrorCode: textResult.errorCode },
    "[whatsapp] Session text rejected — retrying with Meta template",
  );

  let templateResult = await sendMetaTemplate(config, toPhone, templateName, logContext, body);
  let usedTemplate = templateName;
  if (!templateResult.ok && templateName !== "hello_world") {
    logger.warn({ ...logContext, templateName }, "[whatsapp] Clinic template failed — retrying hello_world");
    templateResult = await sendMetaTemplate(config, toPhone, "hello_world", logContext);
    usedTemplate = "hello_world";
  }

  return finalize(templateResult, usedTemplate);
}

async function sendTrackedWhatsApp(params: {
  config: ClinicWhatsAppConfig;
  toPhone: string;
  body: string;
  actionType: string;
  entityId?: string | null;
  reminderKey?: string | null;
  patientId?: string | null;
  logContext: Record<string, unknown>;
}): Promise<void> {
  const templateName = await resolveTemplateNameForAction(
    params.config.clinicId,
    params.actionType,
    params.config.outboundTemplate,
  );

  const recordId = await createWhatsappMessageRecord({
    clinicId: params.config.clinicId,
    patientId: params.patientId,
    actionType: params.actionType,
    entityId: params.entityId,
    reminderKey: params.reminderKey,
    recipientPhone: params.toPhone,
    bodyPreview: params.body,
    templateName,
  });

  try {
    if (params.config.provider !== "meta") {
      throw new Error(`Provider ${params.config.provider} not implemented`);
    }

    const delivered = await deliverPatientWhatsAppMessage({
      config: params.config,
      toPhone: params.toPhone,
      body: params.body,
      logContext: params.logContext,
      templateNameOverride: templateName,
    });

    await markWhatsappMessageSent(recordId, {
      metaMessageId: delivered.metaMessageId,
      templateName: delivered.templateName,
    });
  } catch (err: unknown) {
    const metaResult = (err as { metaResult?: MetaSendResult }).metaResult;
    const attemptCount = 1;
    const failureType = metaResult ? classifyFailure(metaResult) : "transient";
    const errorMessage = err instanceof Error ? err.message : String(err);
    await markWhatsappMessageFailed(recordId, {
      errorCode: metaResult?.errorCode,
      errorMessage,
      failureType,
      attemptCount,
      nextRetryAt: failureType === "transient" ? computeNextRetry(attemptCount) : null,
    });
    if (failureType === "permanent") {
      await notifyWhatsappDeliveryFailure(params.config.clinicId, params.actionType, errorMessage);
    }
    throw err;
  }
}

/**
 * Fire-and-forget: resolve recipient, build template, send via clinic credentials.
 * Patient notifications go to the patient phone; operational alerts go to the clinic recipient.
 * Never throws to callers.
 */
export function dispatchWhatsAppNotification(payload: WhatsAppDispatchPayload): void {
  void (async () => {
    const baseLog = {
      clinicId: payload.clinicId,
      actionType: payload.actionType,
      entityId: payload.entityId ?? null,
    };

    logger.info(baseLog, "[whatsapp] Dispatch started");

    try {
      const { actionType, clinicId } = payload;

      const config = await getClinicWhatsAppConfig(clinicId);
      if (!config) {
        logger.warn(baseLog, "[whatsapp] Skipped — clinic not found");
        return;
      }

      logger.info(
        {
          ...baseLog,
          whatsappEnabled: config.enabled,
          provider: config.provider,
          hasAccessToken: !!config.accessToken,
          hasPhoneNumberId: !!config.phoneNumberId,
          phoneNumberIdSuffix: config.phoneNumberId?.slice(-4) ?? null,
          messagingMode: config.messagingMode,
          outboundTemplate: config.outboundTemplate ?? DEFAULT_TEMPLATE_NAME,
        },
        "[whatsapp] Clinic config loaded",
      );

      if (!config.enabled) {
        logger.info(baseLog, "[whatsapp] Skipped — WhatsApp disabled for clinic");
        return;
      }
      if (!config.accessToken || !config.phoneNumberId) {
        logger.warn(baseLog, "[whatsapp] Skipped — enabled but credentials missing");
        return;
      }

      if (isOperationalAlertAction(actionType)) {
        const alertConfig = await getOperationalAlertsConfig(clinicId);
        if (!alertConfig.enabled) {
          logger.info(baseLog, "[whatsapp] Operational alert skipped — operational alerts disabled");
          return;
        }

        const configKey = OPERATIONAL_ALERT_CONFIG_KEY[actionType];
        const alertToggle = alertConfig[configKey];
        if (!alertToggle?.enabled) {
          logger.info(
            { ...baseLog, alertToggle: configKey },
            "[whatsapp] Operational alert skipped — alert type disabled",
          );
          return;
        }

        const phone = normalizePhoneNumber(alertConfig.recipientPhone ?? "");
        if (!phone) {
          logger.info(baseLog, "[whatsapp] Operational alert skipped — no valid recipient phone");
          return;
        }

        const body = buildOperationalAlertMessage(actionType, payload.message);
        logger.info(
          { ...baseLog, recipientPhoneSuffix: phone.slice(-4), messageLength: body.length },
          "[whatsapp] Sending operational alert",
        );

        await sendTrackedWhatsApp({
          config,
          toPhone: phone,
          body,
          actionType,
          entityId: payload.entityId,
          logContext: { ...baseLog, recipientType: "clinic" },
        });

        logger.info(baseLog, "[whatsapp] Operational alert sent");
        return;
      }

      if (!WHATSAPP_TRIGGER_ACTIONS.has(actionType as WhatsAppTriggerAction)) {
        logger.info(
          { ...baseLog },
          "[whatsapp] Skipped — action type not in patient trigger registry",
        );
        return;
      }

      const triggerAction = actionType as WhatsAppTriggerAction;
      const { phone, context, patientId } = await resolveTemplateContext(
        clinicId,
        triggerAction,
        payload.entityId,
      );

      if (!phone) {
        logger.warn(
          {
            ...baseLog,
            patientId: patientId ?? null,
            reason: "invalid_or_missing_patient_phone",
          },
          "[whatsapp] Skipped — no valid patient phone",
        );
        return;
      }

      const body = buildWhatsAppMessage(triggerAction, context);
      logger.info(
        {
          ...baseLog,
          patientId: patientId ?? null,
          recipientPhoneSuffix: phone.slice(-4),
          messagePreview: body.slice(0, 80),
        },
        "[whatsapp] Sending patient notification",
      );

      await sendTrackedWhatsApp({
        config,
        toPhone: phone,
        body,
        actionType: triggerAction,
        entityId: payload.entityId,
        reminderKey: payload.reminderKey,
        patientId: patientId ?? payload.patientId,
        logContext: { ...baseLog, recipientType: "patient", patientId },
      });

      logger.info({ ...baseLog, patientId }, "[whatsapp] Patient notification sent");
    } catch (err) {
      logger.error({ err, ...baseLog }, "[whatsapp] Dispatch failed");
    }
  })();
}
