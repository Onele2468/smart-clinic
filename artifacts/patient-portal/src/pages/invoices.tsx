import React, { useState } from "react";
import Layout from "@/components/Layout";
import {
  useListPatientPortalInvoices,
  getListPatientPortalInvoicesQueryKey,
  useSubmitPatientPaymentRequest,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Receipt,
  AlertCircle,
  CheckCircle,
  Clock,
  Landmark,
  ChevronDown,
  ChevronUp,
  Send,
  Ban,
  Info,
} from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { cls: string; icon: typeof CheckCircle; label: string }> = {
  paid:      { cls: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle, label: "Paid" },
  unpaid:    { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Unpaid" },
  partial:   { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock, label: "Partial" },
  cancelled: { cls: "bg-gray-50 text-gray-500 border-gray-200", icon: Ban, label: "Cancelled" },
};

const ITEM_TYPE_BADGE: Record<string, string> = {
  consultation: "bg-purple-50 text-purple-700 border border-purple-200",
  medication:   "bg-green-50 text-green-700 border border-green-200",
  laboratory:   "bg-blue-50 text-blue-700 border border-blue-200",
  procedure:    "bg-orange-50 text-orange-700 border border-orange-200",
};

function fmt(value: string | number | null | undefined) {
  const n = typeof value === "string" ? parseFloat(value) : (value ?? 0);
  return `R ${n.toFixed(2)}`;
}

function computeDueDate(inv: { dueDate?: string | null; createdAt: string }): Date {
  if (inv.dueDate) return new Date(inv.dueDate);
  return addDays(new Date(inv.createdAt), 30);
}

export default function InvoicesPage() {
  const { toast } = useToast();
  const { data, isLoading, isError } = useListPatientPortalInvoices({
    query: { queryKey: getListPatientPortalInvoicesQueryKey() },
  });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notifyInvoiceId, setNotifyInvoiceId] = useState<string | null>(null);
  const [payReference, setPayReference] = useState("");

  const payRequestMutation = useSubmitPatientPaymentRequest();

  const invoices: any[] = (data as any)?.invoices ?? [];
  const clinicBilling: any = (data as any)?.clinicBilling ?? {};

  const isGovClinic = clinicBilling.clinicType === "government";
  const billingEnabled = clinicBilling.billingEnabled !== false;
  const hasBankingInfo = !!(clinicBilling.bankName || clinicBilling.bankAccountNumber);
  const showBankingPanel = !isGovClinic && billingEnabled && hasBankingInfo;

  const totalOwed = invoices
    .filter(i => i.status !== "cancelled")
    .reduce((sum, i) => sum + parseFloat(i.balance ?? "0"), 0);

  const handleNotifyPayment = async () => {
    if (!notifyInvoiceId) return;
    try {
      await payRequestMutation.mutateAsync({
        invoiceId: notifyInvoiceId,
        data: { reference: payReference || undefined },
      });
      toast({ title: "Payment notification sent", description: "Our team will verify and update your invoice status." });
      setNotifyInvoiceId(null);
      setPayReference("");
    } catch {
      toast({ variant: "destructive", title: "Could not send notification", description: "Please try again or contact the clinic." });
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Invoices</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Your billing history and outstanding balances.</p>
          </div>
          {totalOwed > 0 && !isGovClinic && billingEnabled && (
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">Total outstanding</p>
              <p className="text-xl font-semibold text-destructive" data-testid="text-total-owed">{fmt(totalOwed)}</p>
            </div>
          )}
        </div>

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Failed to load invoices. Please try refreshing the page.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {/* Government clinic notice */}
            {(isGovClinic || !billingEnabled) && (
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-5 pb-5 flex items-start gap-3">
                  <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900">No Billing Applicable</p>
                    <p className="text-sm text-blue-700 mt-0.5">
                      {isGovClinic
                        ? "This is a government clinic. Services are provided at no charge and patient invoices are not generated."
                        : "Billing is not currently enabled for your clinic."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Banking / payment details panel */}
            {showBankingPanel && (
              <Card className="border-indigo-200 bg-indigo-50/40">
                <CardHeader className="pb-2 pt-4">
                  <CardTitle className="text-sm flex items-center gap-2 text-indigo-900">
                    <Landmark className="w-4 h-4" />
                    Banking / Payment Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-4">
                  <p className="text-xs text-indigo-700 mb-3">
                    Make payment via bank transfer using the details below, then click "Notify Payment" on your invoice.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm">
                    {clinicBilling.bankName && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Bank</p>
                        <p className="font-semibold mt-0.5">{clinicBilling.bankName}</p>
                      </div>
                    )}
                    {clinicBilling.bankAccountHolder && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Account Holder</p>
                        <p className="font-semibold mt-0.5">{clinicBilling.bankAccountHolder}</p>
                      </div>
                    )}
                    {clinicBilling.bankAccountNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Account Number</p>
                        <p className="font-semibold font-mono mt-0.5">{clinicBilling.bankAccountNumber}</p>
                      </div>
                    )}
                    {clinicBilling.bankBranchCode && (
                      <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Branch Code</p>
                        <p className="font-semibold font-mono mt-0.5">{clinicBilling.bankBranchCode}</p>
                      </div>
                    )}
                  </div>
                  {clinicBilling.paymentReferenceInstructions && (
                    <div className="mt-3 p-2.5 bg-indigo-100 rounded-lg">
                      <p className="text-xs text-indigo-900">
                        <span className="font-semibold">Payment Reference: </span>
                        {clinicBilling.paymentReferenceInstructions}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Invoice cards */}
            {!isGovClinic && billingEnabled && (
              <div className="space-y-3" data-testid="list-invoices">
                {invoices.map(inv => {
                  const statusConf = STATUS_CONFIG[inv.status ?? "unpaid"];
                  const StatusIcon = statusConf?.icon ?? Clock;
                  const isExpanded = expandedId === inv.id;
                  const dueDate = computeDueDate(inv);
                  const paidAmt = parseFloat(inv.paidAmount ?? "0");
                  const totalAmt = parseFloat(inv.totalAmount ?? "0");
                  const balanceAmt = parseFloat(inv.balance ?? "0");
                  const paidPct = totalAmt > 0 ? Math.min(100, (paidAmt / totalAmt) * 100) : 0;
                  const isOverdue = inv.status !== "paid" && inv.status !== "cancelled" && dueDate < new Date();
                  const canNotify = inv.status === "unpaid" || inv.status === "partial";

                  return (
                    <Card key={inv.id} data-testid={`card-invoice-${inv.id}`} className="overflow-hidden transition-shadow hover:shadow-sm">
                      <CardContent className="p-4">
                        {/* Invoice header row */}
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <Receipt className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="font-semibold text-sm font-mono" data-testid={`text-invoice-code-${inv.id}`}>
                                {inv.invoiceCode}
                              </p>
                              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {isOverdue && (
                                  <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                                    Overdue
                                  </span>
                                )}
                                <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border", statusConf?.cls)}>
                                  <StatusIcon className="w-3 h-3" />
                                  {statusConf?.label ?? inv.status}
                                </span>
                              </div>
                            </div>

                            {/* Dates */}
                            <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground flex-wrap">
                              <span>Issued {format(new Date(inv.createdAt), "d MMM yyyy")}</span>
                              <span className={cn(isOverdue ? "text-destructive font-medium" : "")}>
                                Due {format(dueDate, "d MMM yyyy")}
                              </span>
                            </div>

                            {/* Financial summary */}
                            <div className="flex items-center gap-4 mt-2 text-xs flex-wrap">
                              <span className="text-muted-foreground">
                                Total: <span className="font-semibold text-foreground" data-testid={`text-invoice-total-${inv.id}`}>
                                  {fmt(inv.totalAmount)}
                                </span>
                              </span>
                              {paidAmt > 0 && (
                                <span className="text-muted-foreground">
                                  Paid: <span className="font-semibold text-green-700">{fmt(paidAmt)}</span>
                                </span>
                              )}
                              {balanceAmt > 0 && (
                                <span className="text-muted-foreground">
                                  Outstanding: <span className="font-semibold text-destructive">{fmt(balanceAmt)}</span>
                                </span>
                              )}
                            </div>

                            {/* Progress bar */}
                            {paidPct > 0 && (
                              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${paidPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expand / notify actions */}
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground px-2"
                            onClick={() => setExpandedId(isExpanded ? null : inv.id)}
                          >
                            {isExpanded
                              ? <><ChevronUp className="w-3.5 h-3.5 mr-1" />Hide details</>
                              : <><ChevronDown className="w-3.5 h-3.5 mr-1" />View details{inv.items?.length ? ` (${inv.items.length} item${inv.items.length !== 1 ? "s" : ""})` : ""}</>}
                          </Button>
                          {canNotify && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/5"
                              onClick={() => { setNotifyInvoiceId(inv.id); setPayReference(""); }}
                            >
                              <Send className="w-3 h-3 mr-1.5" />
                              Notify Payment
                            </Button>
                          )}
                        </div>

                        {/* Expanded detail section */}
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t space-y-3">
                            {inv.items && inv.items.length > 0 ? (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                  Services &amp; Items
                                </p>
                                <div className="divide-y divide-dashed">
                                  {inv.items.map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between py-2 gap-3 text-sm">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className={cn("shrink-0 text-xs px-1.5 py-0.5 rounded font-medium capitalize", ITEM_TYPE_BADGE[item.type] ?? "bg-gray-100 text-gray-600 border border-gray-200")}>
                                          {item.type}
                                        </span>
                                        <span className="text-foreground truncate">{item.description}</span>
                                        {item.quantity > 1 && (
                                          <span className="text-xs text-muted-foreground shrink-0">× {item.quantity}</span>
                                        )}
                                      </div>
                                      <span className="font-semibold shrink-0">{fmt(item.total)}</span>
                                    </div>
                                  ))}
                                </div>
                                {/* Items total line */}
                                <div className="flex items-center justify-between pt-2 mt-1 border-t text-sm">
                                  <span className="font-semibold text-muted-foreground">Total</span>
                                  <span className="font-bold">{fmt(inv.totalAmount)}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No line items on record.</p>
                            )}

                            {inv.notes && (
                              <div className="p-2.5 bg-muted/50 rounded-md">
                                <p className="text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">Note: </span>{inv.notes}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {invoices.length === 0 && (
                  <div className="text-center py-16 text-muted-foreground" data-testid="empty-invoices">
                    <Receipt className="w-12 h-12 mx-auto opacity-20 mb-3" />
                    <p className="font-medium">No invoices yet</p>
                    <p className="text-sm mt-1">Your billing statements will appear here.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Payment notification dialog */}
        <Dialog
          open={!!notifyInvoiceId}
          onOpenChange={open => { if (!open) { setNotifyInvoiceId(null); setPayReference(""); } }}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Notify Payment</DialogTitle>
              <DialogDescription>
                Let the clinic know you've made a payment. Our team will verify and update your invoice status.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div>
                <label className="text-sm font-medium">Payment Reference <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input
                  className="mt-1.5"
                  placeholder="e.g. EFT reference, POP number"
                  value={payReference}
                  onChange={e => setPayReference(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Enter your bank transfer reference or transaction ID so we can locate your payment.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setNotifyInvoiceId(null)}>Cancel</Button>
              <Button size="sm" onClick={handleNotifyPayment} disabled={payRequestMutation.isPending}>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {payRequestMutation.isPending ? "Submitting…" : "Submit Notification"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
