export interface AppointmentReminderSettings {
  enabled: boolean;
  hoursBefore: number[];
}

export interface FollowUpReminderSettings {
  enabled: boolean;
  daysAfterConsultation: number[];
}

export interface WhatsappReminderConfig {
  enabled: boolean;
  appointmentReminders: AppointmentReminderSettings;
  followUpReminders: FollowUpReminderSettings;
}

export const DEFAULT_WHATSAPP_REMINDER_CONFIG: WhatsappReminderConfig = {
  enabled: false,
  appointmentReminders: { enabled: true, hoursBefore: [24, 1] },
  followUpReminders: { enabled: true, daysAfterConsultation: [7] },
};

export function parseWhatsappReminderConfig(raw: unknown): WhatsappReminderConfig {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_WHATSAPP_REMINDER_CONFIG };
  }
  const src = raw as Partial<WhatsappReminderConfig>;
  return {
    enabled: src.enabled ?? DEFAULT_WHATSAPP_REMINDER_CONFIG.enabled,
    appointmentReminders: {
      enabled:
        src.appointmentReminders?.enabled ??
        DEFAULT_WHATSAPP_REMINDER_CONFIG.appointmentReminders.enabled,
      hoursBefore:
        src.appointmentReminders?.hoursBefore ??
        DEFAULT_WHATSAPP_REMINDER_CONFIG.appointmentReminders.hoursBefore,
    },
    followUpReminders: {
      enabled:
        src.followUpReminders?.enabled ??
        DEFAULT_WHATSAPP_REMINDER_CONFIG.followUpReminders.enabled,
      daysAfterConsultation:
        src.followUpReminders?.daysAfterConsultation ??
        DEFAULT_WHATSAPP_REMINDER_CONFIG.followUpReminders.daysAfterConsultation,
    },
  };
}
