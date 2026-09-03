import { Router, type IRouter } from "express";
import { WorkflowEvent } from "../constants/workflowEvents";
import { getClinicPaymentGatewayConfig, getPaymentGateway } from "../services/payment-gateways/payment-gateway.service";
import {
  findProviderTransactionForEvent,
  hasProcessedProviderEvent,
  markProviderTransactionPaidOnce,
  markProviderEventProcessed,
  recordProviderEvent,
  updateProviderTransactionStatus,
} from "../services/payment-gateways/provider-transaction.service";
import { processWorkflowEvent } from "../services/workflow/workflow-engine.service";
import { findPendingProviderRefund } from "../services/billing/refund.service";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/:provider/:clinicId", async (req, res): Promise<void> => {
  const provider = Array.isArray(req.params.provider) ? req.params.provider[0] : req.params.provider;
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));

  try {
    const config = await getClinicPaymentGatewayConfig(clinicId);
    if (config.provider !== provider) {
      res.status(400).json({ error: "Provider does not match clinic configuration" });
      return;
    }

    const gateway = getPaymentGateway(provider);
    const event = gateway.verifyWebhook(config, rawBody, req.headers);
    const transaction = await findProviderTransactionForEvent(event);

    await recordProviderEvent({
      clinicId: transaction?.clinicId ?? clinicId,
      transactionId: transaction?.id ?? null,
      event,
    });

    if (await hasProcessedProviderEvent(event.provider, event.providerEventId)) {
      res.json({ received: true, duplicate: true });
      return;
    }

    if (!transaction) {
      logger.warn({ provider, clinicId, eventType: event.eventType, providerEventId: event.providerEventId }, "Payment provider event has no matching transaction");
      await markProviderEventProcessed(event.provider, event.providerEventId);
      res.json({ received: true, matched: false });
      return;
    }

    if (transaction.clinicId !== clinicId) {
      logger.warn({ provider, clinicId, transactionClinicId: transaction.clinicId, transactionId: transaction.id }, "Payment provider event clinic mismatch");
      res.status(400).json({ error: "Provider transaction does not belong to webhook clinic" });
      return;
    }

    if (event.currency && event.currency !== transaction.currency) {
      logger.warn({ provider, clinicId, transactionId: transaction.id, eventCurrency: event.currency, transactionCurrency: transaction.currency }, "Payment provider event currency mismatch");
      res.status(400).json({ error: "Provider payment currency does not match transaction" });
      return;
    }

    if (event.status === "paid" && (event.amount === null || event.amount === undefined || Number(event.amount) !== Number(transaction.amount))) {
      logger.warn({ provider, clinicId, transactionId: transaction.id, eventAmount: event.amount, transactionAmount: transaction.amount }, "Payment provider event amount mismatch");
      res.status(400).json({ error: "Provider payment amount does not match transaction" });
      return;
    }

    if (event.status === "paid") {
      const paidTransaction = await markProviderTransactionPaidOnce({
        transactionId: transaction.id,
        providerTransactionId: event.providerTransactionId ?? transaction.providerTransactionId,
        rawProviderPayload: event.rawPayload,
        paidAt: event.paidAt ?? new Date(),
      });
      if (!paidTransaction) {
        await markProviderEventProcessed(event.provider, event.providerEventId);
        res.json({ received: true, duplicate: true });
        return;
      }

      await processWorkflowEvent(WorkflowEvent.PAYMENT_COMPLETED, {
        clinicId: paidTransaction.clinicId,
        invoiceId: paidTransaction.invoiceId,
        patientId: paidTransaction.patientId,
        amount: event.amount ?? Number(paidTransaction.amount),
        paymentMethod: event.paymentMethod ?? provider,
        reference: event.providerTransactionId ?? transaction.providerCheckoutId ?? transaction.id,
        provider,
        providerTransactionId: paidTransaction.id,
        paidAt: event.paidAt ?? new Date(),
        source: "provider",
      });
    } else if (event.status === "refunded") {
      const refund = event.providerRefundId
        ? await findPendingProviderRefund({ clinicId, providerTransactionId: transaction.id, providerRefundId: event.providerRefundId })
        : null;
      if (refund) {
        await processWorkflowEvent(WorkflowEvent.PAYMENT_REFUNDED, { clinicId, refundId: refund.id, patientId: transaction.patientId, userRole: "payment_gateway" });
      } else {
        logger.warn({ clinicId, transactionId: transaction.id, providerRefundId: event.providerRefundId }, "Provider refund event has no pending authorised refund");
      }
    } else if (event.status === "failed" || event.status === "expired") {
      await updateProviderTransactionStatus({
        transactionId: transaction.id,
        status: event.status,
        providerTransactionId: event.providerTransactionId ?? transaction.providerTransactionId,
        rawProviderPayload: event.rawPayload,
        failureReason: event.status,
      });
      await processWorkflowEvent(WorkflowEvent.PAYMENT_FAILED, {
        clinicId: transaction.clinicId,
        patientId: transaction.patientId,
        invoiceId: transaction.invoiceId,
        providerTransactionId: transaction.id,
        reason: `Payment provider event ${event.eventType} resulted in ${event.status}.`,
      });
    }

    await markProviderEventProcessed(event.provider, event.providerEventId);
    res.json({ received: true });
  } catch (err: unknown) {
    logger.error({ err, provider, clinicId }, "Payment provider webhook failed");
    res.status(400).json({ error: err instanceof Error ? err.message : "Webhook processing failed" });
  }
});

export default router;
