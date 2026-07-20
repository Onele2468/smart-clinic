import { db, invoiceItemsTable, invoicesTable, patientsTable, paymentsTable, clinicsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

export interface DynamicReceipt {
  receiptNumber: string;
  invoiceNumber: string;
  patientName: string;
  clinicName: string;
  amountPaid: number;
  totalPaid: number;
  invoiceTotal: number;
  balance: number;
  paymentMethod: string;
  paymentReference: string | null;
  paymentDate: string;
  currency: string;
  services: Array<{ description: string; quantity: number; unitPrice: number; total: number }>;
}

export async function generateReceiptForPayment(params: {
  clinicId: string;
  invoiceId: string;
  paymentId: string;
}): Promise<DynamicReceipt> {
  const [row] = await db
    .select({
      invoiceCode: invoicesTable.invoiceCode,
      totalAmount: invoicesTable.totalAmount,
      paidAmount: invoicesTable.paidAmount,
      balance: invoicesTable.balance,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
      clinicName: clinicsTable.name,
      currency: clinicsTable.paymentCurrency,
      paymentAmount: paymentsTable.amount,
      paymentMethod: paymentsTable.paymentMethod,
      paymentReference: paymentsTable.reference,
      paidAt: paymentsTable.paidAt,
    })
    .from(paymentsTable)
    .innerJoin(invoicesTable, eq(paymentsTable.invoiceId, invoicesTable.id))
    .innerJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
    .innerJoin(clinicsTable, eq(invoicesTable.clinicId, clinicsTable.id))
    .where(and(eq(paymentsTable.id, params.paymentId), eq(paymentsTable.clinicId, params.clinicId), eq(invoicesTable.id, params.invoiceId)));

  if (!row) {
    throw new Error("Payment receipt source not found");
  }

  const items = await db
    .select()
    .from(invoiceItemsTable)
    .where(eq(invoiceItemsTable.invoiceId, params.invoiceId))
    .orderBy(desc(invoiceItemsTable.createdAt));

  return {
    receiptNumber: `${row.invoiceCode}-${String(params.paymentId).slice(0, 8).toUpperCase()}`,
    invoiceNumber: row.invoiceCode,
    patientName: `${row.patientFirstName} ${row.patientLastName}`.trim(),
    clinicName: row.clinicName,
    amountPaid: Number(row.paymentAmount),
    totalPaid: Number(row.paidAmount),
    invoiceTotal: Number(row.totalAmount),
    balance: Number(row.balance),
    paymentMethod: row.paymentMethod,
    paymentReference: row.paymentReference,
    paymentDate: row.paidAt.toISOString(),
    currency: row.currency ?? "ZAR",
    services: items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      total: Number(item.total),
    })),
  };
}
