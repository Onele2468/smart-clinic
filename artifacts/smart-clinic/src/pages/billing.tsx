import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  Receipt, Plus, Trash2, DollarSign, TrendingUp, Clock, CheckCircle, AlertCircle, CreditCard, Landmark, Save
} from "lucide-react";
import { useListPatients, getListPatientsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL;
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}`, ...opts?.headers },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Request failed"); return d; });

const invoiceItemSchema = z.object({
  type: z.enum(["consultation", "medication", "laboratory", "procedure"]),
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().int().min(1),
  unitPrice: z.coerce.number().min(0),
});

const createInvoiceSchema = z.object({
  patientId: z.string().min(1, "Patient required"),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item required"),
});

const paymentSchema = z.object({
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  paymentMethod: z.enum(["cash", "card", "transfer", "mobile_money"]),
  reference: z.string().optional(),
});

const statusColor: Record<string, string> = {
  unpaid: "bg-red-100 text-red-800",
  partial: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center space-x-4">
        <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Billing() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId ?? "";
  const role = clinicMembership?.role ?? "";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [search, setSearch] = useState("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["billing-stats", clinicId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/billing/stats`),
    enabled: !!clinicId,
  });

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", clinicId, statusFilter],
    queryFn: () => apiFetch(`/clinics/${clinicId}/invoices${statusFilter !== "__all__" ? `?status=${statusFilter}` : ""}`),
    enabled: !!clinicId,
  });

  const { data: responsibilities = [] } = useQuery({
    queryKey: ["financial-responsibilities", clinicId, selectedInvoice?.id],
    queryFn: () => apiFetch(`/clinics/${clinicId}/invoices/${selectedInvoice.id}/financial-responsibilities`),
    enabled: !!clinicId && !!selectedInvoice?.id,
  });

  const { data: invoiceDetail } = useQuery({
    queryKey: ["invoice-detail", clinicId, selectedInvoice?.id],
    queryFn: () => apiFetch(`/clinics/${clinicId}/invoices/${selectedInvoice.id}`),
    enabled: !!clinicId && !!selectedInvoice?.id && isFinanceOpen,
  });

  const { data: refunds = [] } = useQuery({
    queryKey: ["invoice-refunds", clinicId, selectedInvoice?.id],
    queryFn: () => apiFetch(`/clinics/${clinicId}/invoices/${selectedInvoice.id}/refunds`),
    enabled: !!clinicId && !!selectedInvoice?.id && isFinanceOpen,
  });

  const { data: awaitingEft = [] } = useQuery({
    queryKey: ["awaiting-eft-verifications", clinicId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/manual-payment-verifications`),
    enabled: !!clinicId && ["clinic_admin", "cashier"].includes(role),
  });

  const { data: patients } = useListPatients(
    clinicId, {},
    { query: { enabled: !!clinicId && isCreateOpen, queryKey: getListPatientsQueryKey(clinicId, {}) } }
  );

  const patientOptions = useMemo(() =>
    (patients ?? []).map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}`, code: p.patientCode })),
    [patients]
  );

  const form = useForm<z.infer<typeof createInvoiceSchema>>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: { patientId: "", notes: "", items: [{ type: "consultation", description: "", quantity: 1, unitPrice: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const watchItems = form.watch("items");
  const total = watchItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);

  const payForm = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { amount: 0, paymentMethod: "cash", reference: "" },
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/clinics/${clinicId}/invoices`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats", clinicId] });
      toast({ title: "Invoice created successfully" });
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to create invoice", description: e.message }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/clinics/${clinicId}/invoices/${selectedInvoice?.id}/payments`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats", clinicId] });
      toast({ title: "Payment recorded successfully" });
      setIsPayOpen(false);
      payForm.reset();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to record payment", description: e.message }),
  });

  const checkoutMutation = useMutation({
    mutationFn: () => apiFetch(`/clinics/${clinicId}/invoices/${selectedInvoice?.id}/payment-provider/checkout`, { method: "POST", body: JSON.stringify({ successUrl: window.location.href, cancelUrl: window.location.href, failureUrl: window.location.href }) }),
    onSuccess: (transaction: any) => { window.location.assign(transaction.checkoutUrl); },
    onError: (e: any) => toast({ variant: "destructive", title: "Unable to start online payment", description: e.message }),
  });

  const [allocation, setAllocation] = useState({ payerType: "patient", allocatedAmount: "", payerReference: "", authorizationReference: "" });
  const allocationMutation = useMutation({
    mutationFn: () => apiFetch(`/clinics/${clinicId}/invoices/${selectedInvoice?.id}/financial-responsibilities`, { method: "POST", body: JSON.stringify({ ...allocation, allocatedAmount: Number(allocation.allocatedAmount), payerReference: allocation.payerReference || null, authorizationReference: allocation.authorizationReference || null }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["financial-responsibilities", clinicId, selectedInvoice?.id] }); setAllocation({ payerType: "patient", allocatedAmount: "", payerReference: "", authorizationReference: "" }); toast({ title: "Financial responsibility recorded" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Unable to record responsibility", description: e.message }),
  });

  const refundMutation = useMutation({
    mutationFn: (payment: any) => apiFetch(`/clinics/${clinicId}/payments/${payment.id}/refunds`, { method: "POST", body: JSON.stringify({ amount: Number(payment.amount), reason: "Staff-authorised refund" }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoice-detail", clinicId, selectedInvoice?.id] }); queryClient.invalidateQueries({ queryKey: ["invoice-refunds", clinicId, selectedInvoice?.id] }); queryClient.invalidateQueries({ queryKey: ["invoices", clinicId] }); queryClient.invalidateQueries({ queryKey: ["billing-stats", clinicId] }); toast({ title: "Refund processed or awaiting provider confirmation" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Unable to refund payment", description: e.message }),
  });

  const billingEnabled = stats?.billingEnabled !== false;
  const canManage = ["clinic_admin", "cashier", "receptionist"].includes(role);
  const isAdmin = role === "clinic_admin";

  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranchCode, setBankBranchCode] = useState("");
  const [paymentReferenceInstructions, setPaymentReferenceInstructions] = useState("");
  const [paymentTiming, setPaymentTiming] = useState("END_OF_VISIT");
  const [allowedManualPaymentMethods, setAllowedManualPaymentMethods] = useState<string[]>(["cash", "card", "transfer", "mobile_money"]);
  const [eftVerificationRequired, setEftVerificationRequired] = useState(false);
  const [bankingInitialized, setBankingInitialized] = useState(false);

  React.useEffect(() => {
    if (stats && !bankingInitialized) {
      setBankName(stats.bankName ?? "");
      setBankAccountHolder(stats.bankAccountHolder ?? "");
      setBankAccountNumber(stats.bankAccountNumber ?? "");
      setBankBranchCode(stats.bankBranchCode ?? "");
      setPaymentReferenceInstructions(stats.paymentReferenceInstructions ?? "");
      setPaymentTiming(stats.paymentTiming ?? "END_OF_VISIT");
      setAllowedManualPaymentMethods(stats.allowedManualPaymentMethods ?? ["cash", "card", "transfer", "mobile_money"]);
      setEftVerificationRequired(stats.eftVerificationRequired ?? false);
      setBankingInitialized(true);
    }
  }, [stats, bankingInitialized]);

  const saveBankingMutation = useMutation({
    mutationFn: () => apiFetch(`/clinics/${clinicId}/billing/settings`, {
      method: "PATCH",
      body: JSON.stringify({
        bankName: bankName || null,
        bankAccountHolder: bankAccountHolder || null,
        bankAccountNumber: bankAccountNumber || null,
        bankBranchCode: bankBranchCode || null,
        paymentReferenceInstructions: paymentReferenceInstructions || null,
        paymentTiming,
        allowedManualPaymentMethods,
        eftVerificationRequired,
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-stats", clinicId] });
      toast({ title: "Banking details saved" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to save banking details", description: e.message }),
  });

  const verifyEftMutation = useMutation({
    mutationFn: (verificationId: string) => apiFetch(`/clinics/${clinicId}/manual-payment-verifications/${verificationId}/verify`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["awaiting-eft-verifications", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["invoices", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["billing-stats", clinicId] });
      toast({ title: "EFT verified and payment completed" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Unable to verify EFT", description: e.message }),
  });
  const rejectEftMutation = useMutation({
    mutationFn: (verificationId: string) => apiFetch(`/clinics/${clinicId}/manual-payment-verifications/${verificationId}/reject`, { method: "POST", body: JSON.stringify({ reason: "Rejected after staff review" }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["awaiting-eft-verifications", clinicId] }); toast({ title: "EFT verification rejected" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Unable to reject EFT", description: e.message }),
  });

  if (statsLoading) {
    return <div className="p-8 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (!billingEnabled) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-center py-16 space-y-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Receipt className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Billing Disabled</h2>
          <p className="text-muted-foreground">
            Billing is not enabled for this clinic. Clinic admins can enable it in Settings.
          </p>
        </div>
      </div>
    );
  }

  const filtered = (invoices ?? []).filter((inv: any) =>
    search ? inv.patientName?.toLowerCase().includes(search.toLowerCase()) || inv.invoiceCode?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing</h1>
          <p className="text-muted-foreground mt-1">Manage invoices and payments.</p>
        </div>
        {canManage && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Invoice</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => createInvoiceMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="patientId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Patient</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {patientOptions.map(p => <SelectItem key={p.value} value={p.value}>{p.label} <span className="text-xs text-muted-foreground ml-1">({p.code})</span></SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Line Items</p>
                      <Button type="button" variant="outline" size="sm" onClick={() => append({ type: "consultation", description: "", quantity: 1, unitPrice: 0 })}>
                        <Plus className="w-3 h-3 mr-1" /> Add Item
                      </Button>
                    </div>
                    {fields.map((field, idx) => (
                      <div key={field.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                        <div className="grid grid-cols-2 gap-2">
                          <FormField control={form.control} name={`items.${idx}.type`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="consultation">Consultation</SelectItem>
                                  <SelectItem value="medication">Medication</SelectItem>
                                  <SelectItem value="laboratory">Laboratory</SelectItem>
                                  <SelectItem value="procedure">Procedure</SelectItem>
                                </SelectContent>
                              </Select>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`items.${idx}.description`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Description</FormLabel>
                              <FormControl><Input className="h-8 text-xs" placeholder="e.g. GP Consultation" {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`items.${idx}.quantity`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Qty</FormLabel>
                              <FormControl><Input type="number" min={1} className="h-8 text-xs" {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <FormField control={form.control} name={`items.${idx}.unitPrice`} render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">Unit Price</FormLabel>
                              <FormControl><Input type="number" min={0} step={0.01} className="h-8 text-xs" {...field} /></FormControl>
                            </FormItem>
                          )} />
                        </div>
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive h-6 text-xs" onClick={() => remove(idx)}>
                            <Trash2 className="w-3 h-3 mr-1" /> Remove
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="font-semibold">Total</span>
                    <span className="text-lg font-bold">R {total.toFixed(2)}</span>
                  </div>

                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Input placeholder="Additional notes..." {...field} /></FormControl>
                    </FormItem>
                  )} />

                  <Button type="submit" className="w-full" disabled={createInvoiceMutation.isPending}>
                    {createInvoiceMutation.isPending ? "Creating..." : `Create Invoice — R ${total.toFixed(2)}`}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`R ${Number(stats?.totalRevenue ?? 0).toLocaleString()}`} icon={TrendingUp} color="bg-green-100 text-green-700" />
        <StatCard label="Outstanding" value={`R ${Number(stats?.totalOutstanding ?? 0).toLocaleString()}`} icon={AlertCircle} color="bg-orange-100 text-orange-700" />
        <StatCard label="Today" value={`R ${Number(stats?.todayRevenue ?? 0).toLocaleString()}`} icon={DollarSign} color="bg-blue-100 text-blue-700" />
        <StatCard label="Paid Invoices" value={`${stats?.paidCount ?? 0} / ${stats?.invoiceCount ?? 0}`} icon={CheckCircle} color="bg-purple-100 text-purple-700" />
      </div>

      {/* Invoice List */}
      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-lg">Invoices</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Search patient or code..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Statuses</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
              <Receipt className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p>No invoices found.</p>
            </div>
          ) : (
            <div className="divide-y border rounded-md">
              {filtered.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{inv.invoiceCode}</span>
                      <Badge variant="outline" className={statusColor[inv.status]}>{inv.status.toUpperCase()}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{inv.patientName} • {format(new Date(inv.createdAt), "d MMM yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">R {Number(inv.totalAmount).toFixed(2)}</p>
                      {Number(inv.balance) > 0 && <p className="text-xs text-orange-600">Balance: R {Number(inv.balance).toFixed(2)}</p>}
                    </div>
                    {canManage && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(inv); setIsFinanceOpen(true); }}>Details</Button>
                        {inv.status !== "paid" && inv.status !== "cancelled" && <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(inv); payForm.setValue("amount", Number(inv.balance)); setIsPayOpen(true); }}><CreditCard className="w-3 h-3 mr-1" /> Pay</Button>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banking Details Management (admin only, non-government clinics) */}
      {["clinic_admin", "cashier"].includes(role) && awaitingEft.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">EFT Awaiting Manual Verification</CardTitle>
            <CardDescription>These transfers do not complete a payment until a staff member verifies them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {awaitingEft.map((verification: any) => (
              <div key={verification.verification.id} className="flex items-center justify-between gap-3 rounded border p-3 text-sm">
                <span>{verification.patientName} · {verification.invoiceCode} · R {Number(verification.verification.amount).toFixed(2)} · {format(new Date(verification.verification.createdAt), "d MMM yyyy HH:mm")} · transfer{verification.verification.reference ? ` · ${verification.verification.reference}` : ""}</span>
                <div className="flex gap-2"><Button size="sm" onClick={() => verifyEftMutation.mutate(verification.verification.id)} disabled={verifyEftMutation.isPending}>Verify EFT</Button><Button size="sm" variant="outline" onClick={() => rejectEftMutation.mutate(verification.verification.id)} disabled={rejectEftMutation.isPending}>Reject</Button></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Banking Details
            </CardTitle>
            <CardDescription>
              Configure bank transfer details shown to patients on their invoice page.
              Visible to patients where the clinic enables bank-transfer payment details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Bank Name</label>
                <Input
                  placeholder="e.g. Standard Bank"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account Holder</label>
                <Input
                  placeholder="e.g. Demo Clinic (Pty) Ltd"
                  value={bankAccountHolder}
                  onChange={e => setBankAccountHolder(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Account Number</label>
                <Input
                  placeholder="e.g. 1234567890"
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Branch Code</label>
                <Input
                  placeholder="e.g. 051001"
                  value={bankBranchCode}
                  onChange={e => setBankBranchCode(e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Payment Reference Instructions</label>
              <Input
                placeholder="e.g. Use your patient code (e.g. P-00001) as the payment reference"
                value={paymentReferenceInstructions}
                onChange={e => setPaymentReferenceInstructions(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tell patients what to use as their payment reference (e.g. patient code or invoice number).
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Payment Timing</label>
                <Select value={paymentTiming} onValueChange={setPaymentTiming}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BEFORE_SERVICE">Before service</SelectItem>
                    <SelectItem value="DURING_WORKFLOW">During workflow</SelectItem>
                    <SelectItem value="AFTER_SERVICE">After service</SelectItem>
                    <SelectItem value="END_OF_VISIT">End of visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 pt-6 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={eftVerificationRequired} onChange={e => setEftVerificationRequired(e.target.checked)} /> Require manual EFT verification</label>
                <div className="pt-1">Manual methods: {["cash", "card", "transfer", "mobile_money"].map(method => <label key={method} className="mr-3 inline-flex items-center gap-1"><input type="checkbox" checked={allowedManualPaymentMethods.includes(method)} onChange={e => setAllowedManualPaymentMethods(current => e.target.checked ? [...current, method] : current.filter(value => value !== method))} /> {method.replace("_", " ")}</label>)}</div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={() => saveBankingMutation.mutate()}
                disabled={saveBankingMutation.isPending}
                className="gap-2"
              >
                <Save className="w-4 h-4" />
                {saveBankingMutation.isPending ? "Saving…" : "Save Banking Details"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={isFinanceOpen} onOpenChange={setIsFinanceOpen}>
        <DialogContent className="sm:max-w-[680px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Invoice Financial Details</DialogTitle></DialogHeader>
          {selectedInvoice && <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-3 rounded border p-3"><span>Invoice total: <b>R {Number(invoiceDetail?.totalAmount ?? selectedInvoice.totalAmount).toFixed(2)}</b></span><span>Payment received: <b>R {Number(invoiceDetail?.paidAmount ?? selectedInvoice.paidAmount ?? 0).toFixed(2)}</b></span><span>Outstanding: <b>R {Number(invoiceDetail?.balance ?? selectedInvoice.balance).toFixed(2)}</b></span><span>Status: <b>{(invoiceDetail?.status ?? selectedInvoice.status).toUpperCase()}</b></span></div>
            <div><p className="font-medium mb-2">Responsibility (not payment received)</p>{responsibilities.length ? responsibilities.map((item: any) => <div key={item.id} className="flex justify-between border-b py-1"><span>{item.payerType.replaceAll("_", " ")}{item.payerReference ? ` · ${item.payerReference}` : ""}</span><span>R {Number(item.allocatedAmount).toFixed(2)} · {item.claimStatus}</span></div>) : <p className="text-muted-foreground">No responsibilities recorded.</p>}</div>
            {canManage && <div className="grid grid-cols-2 gap-2 border rounded p-3"><Select value={allocation.payerType} onValueChange={payerType => setAllocation(current => ({ ...current, payerType }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["patient", "medical_aid", "government", "ngo", "donor", "sponsor", "clinic"].map(type => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select><Input type="number" min="0" step="0.01" placeholder="Amount" value={allocation.allocatedAmount} onChange={e => setAllocation(current => ({ ...current, allocatedAmount: e.target.value }))}/><Input placeholder="Payer reference" value={allocation.payerReference} onChange={e => setAllocation(current => ({ ...current, payerReference: e.target.value }))}/><Input placeholder="Authorisation reference" value={allocation.authorizationReference} onChange={e => setAllocation(current => ({ ...current, authorizationReference: e.target.value }))}/><Button className="col-span-2" onClick={() => allocationMutation.mutate()} disabled={!allocation.allocatedAmount || allocationMutation.isPending}>Add responsibility</Button></div>}
            <div><p className="font-medium mb-2">Payments and refunds</p>{(invoiceDetail?.payments ?? []).map((payment: any) => <div key={payment.id} className="flex justify-between border-b py-1"><span>{payment.paymentMethod} · R {Number(payment.amount).toFixed(2)} · {format(new Date(payment.paidAt), "d MMM yyyy")}</span>{["clinic_admin", "cashier"].includes(role) && <Button size="sm" variant="outline" disabled={refundMutation.isPending} onClick={() => refundMutation.mutate(payment)}>Refund</Button>}</div>)}{refunds.map((refund: any) => <div key={refund.id} className="text-xs text-muted-foreground py-1">Refund: R {Number(refund.amount).toFixed(2)} · {refund.status} · {refund.origin}</div>)}</div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="text-sm text-muted-foreground mb-2">
              <p><span className="font-medium">{selectedInvoice.invoiceCode}</span> — {selectedInvoice.patientName}</p>
              <p>Balance: <span className="font-semibold text-foreground">R {Number(selectedInvoice.balance).toFixed(2)}</span></p>
              {responsibilities.length > 0 && (
                <p className="mt-2 text-xs">Responsibilities: {responsibilities.map((item: any) => `${item.payerType} R ${Number(item.allocatedAmount).toFixed(2)}`).join(", ")}</p>
              )}
            </div>
          )}
          <Form {...payForm}>
            <form onSubmit={payForm.handleSubmit(d => recordPaymentMutation.mutate(d))} className="space-y-4">
              <FormField control={payForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl><Input type="number" min={0.01} step={0.01} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payForm.control} name="paymentMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{allowedManualPaymentMethods.map(method => <SelectItem key={method} value={method}>{method === "transfer" ? "Bank Transfer" : method.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={payForm.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference (optional)</FormLabel>
                  <FormControl><Input placeholder="Transaction reference..." {...field} /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={recordPaymentMutation.isPending}>
                {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
              </Button>
              {stats?.onlinePaymentsEnabled && <Button type="button" variant="outline" className="w-full" disabled={checkoutMutation.isPending} onClick={() => checkoutMutation.mutate()}>{checkoutMutation.isPending ? "Opening checkout..." : "Open secure Yoco checkout"}</Button>}
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
