import { WorkflowEvent } from "../../constants/workflowEvents";
import { generateWithOllama } from "./ollama.service";
import { PromptService } from "./PromptService";

export class WorkflowAI {
private prompts = new PromptService();

  async process(event: WorkflowEvent, data: unknown) {

    switch (event) {

      case WorkflowEvent.APPOINTMENT_BOOKED:
        return this.onAppointmentBooked(data);

      case WorkflowEvent.PATIENT_CHECKED_IN:
        return this.onPatientCheckedIn(data);

      case WorkflowEvent.TRIAGE_COMPLETED:
        return this.onTriageCompleted(data);

      case WorkflowEvent.CONSULTATION_COMPLETED:
        return this.onConsultationCompleted(data);

      case WorkflowEvent.LAB_REQUEST_CREATED:
        return this.onLabRequested(data);

      case WorkflowEvent.LAB_RESULT_COMPLETED:
        return this.onLabCompleted(data);

      case WorkflowEvent.PRESCRIPTION_CREATED:
        return this.onPrescriptionCreated(data);

      case WorkflowEvent.MEDICATION_DISPENSED:
        return this.onMedicationDispensed(data);

      case WorkflowEvent.PAYMENT_CREATED:
        return this.onPaymentCreated(data);

      case WorkflowEvent.PAYMENT_COMPLETED:
        return this.onPaymentCompleted(data);

      case WorkflowEvent.VISIT_COMPLETED:
        return this.onVisitCompleted(data);

      default:
        return;
    }

  }

  private async onAppointmentBooked(data: unknown) {}

  private async onPatientCheckedIn(data: unknown) {}

  private async onTriageCompleted(data: unknown) {}

  private async onConsultationCompleted(data: unknown) {}

  private async onLabRequested(data: unknown) {}

  private async onLabCompleted(data: unknown) {}

  private async onPrescriptionCreated(data: unknown) {}

  private async onMedicationDispensed(data: unknown) {}

  private async onPaymentCreated(data: unknown) {}

  private async onPaymentCompleted(data: unknown) {}

  private async onVisitCompleted(data: unknown) {}

}

export const workflowAI = new WorkflowAI();