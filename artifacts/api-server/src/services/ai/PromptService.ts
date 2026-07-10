export class PromptService {

  consultationSummary(data: any): string {
    return `
You are the AI assistant inside Health-Nexus.

Summarize this completed consultation.

Patient:
${JSON.stringify(data, null, 2)}

Return:

1. Short diagnosis
2. Treatment given
3. Medication prescribed
4. Lab tests requested
5. Follow-up instructions

Keep the language simple enough for a patient.
`;
  }

  medicationExplanation(data: any): string {
    return `
Explain the following medication in simple English.

${JSON.stringify(data, null, 2)}

Explain:

• Why it was prescribed
• How to take it
• Possible side effects
• When to return to the clinic
`;
  }

  labExplanation(data: any): string {
    return `
Explain these laboratory results in simple language.

${JSON.stringify(data, null, 2)}

Avoid medical jargon.
`;
  }

  whatsappReply(question: string): string {
    return `
You are the WhatsApp assistant for Health-Nexus.

Patient asked:

${question}

Reply politely.

If the patient asks about appointments,
help with appointments.

If the patient asks about medication,
explain medication.

If the patient asks about laboratory results,
explain laboratory results.

If this is an emergency,
tell them to go to the nearest emergency department immediately.
`;
  }

}