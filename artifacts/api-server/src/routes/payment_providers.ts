import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth, requireClinicMember, requireClinicModule, requireRole } from "../lib/auth";
import { createPaymentCheckout } from "../services/payment-gateways/payment-gateway.service";

const router: IRouter = Router();

const CreateCheckoutBody = z.object({
  successUrl: z.string().url().optional().nullable(),
  cancelUrl: z.string().url().optional().nullable(),
  failureUrl: z.string().url().optional().nullable(),
});

router.post(
  "/clinics/:clinicId/invoices/:invoiceId/payment-provider/checkout",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("billing") as any,
  requireRole("clinic_admin", "cashier", "receptionist") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
    const invoiceId = Array.isArray(req.params.invoiceId) ? req.params.invoiceId[0] : req.params.invoiceId;
    const parsed = CreateCheckoutBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    try {
      const transaction = await createPaymentCheckout({
        clinicId,
        invoiceId,
        successUrl: parsed.data.successUrl ?? null,
        cancelUrl: parsed.data.cancelUrl ?? null,
        failureUrl: parsed.data.failureUrl ?? null,
      });
      res.status(201).json(transaction);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create checkout" });
    }
  },
);

export default router;
