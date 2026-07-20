import { db, invoicesTable, patientsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import type { DynamicReceipt } from "../billing/receipt.service";

export async function generateVisitSummary(params: {
  clinicId: string;
  patientId: string;
  invoiceId: string;
  receipt: DynamicReceipt;
}): Promise<string> {
  const [row] = await db
    .select({
      invoiceCode: invoicesTable.invoiceCode,
      patientFirstName: patientsTable.firstName,
      patientLastName: patientsTable.lastName,
    })
    .from(invoicesTable)
    .innerJoin(patientsTable, eq(invoicesTable.patientId, patientsTable.id))
    .where(and(eq(invoicesTable.id, params.invoiceId), eq(invoicesTable.clinicId, params.clinicId), eq(invoicesTable.patientId, params.patientId)));

  const patientName = row ? `${row.patientFirstName} ${row.patientLastName}`.trim() : params.receipt.patientName;
  const serviceList = params.receipt.services.length
    ? params.receipt.services.map((item) => `${item.description} (${item.quantity})`).join(", ")
    : "Services recorded on invoice";

  return [
    `Visit summary for ${patientName}`,
    `Invoice: ${row?.invoiceCode ?? params.receipt.invoiceNumber}`,
    `Services: ${serviceList}`,
    `Payment received: ${params.receipt.currency} ${params.receipt.amountPaid.toFixed(2)}`,
    `Receipt: ${params.receipt.receiptNumber}`,
    "The visit billing workflow has been completed.",
  ].join("\n");
}
