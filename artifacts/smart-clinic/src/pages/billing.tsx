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
  const clinicType = clinicMembership?.clinicType ?? "private";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
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

  const billingEnabled = stats?.billingEnabled !== false;
  const canManage = ["clinic_admin", "cashier", "receptionist"].includes(role);
  const isAdmin = role === "clinic_admin";

  const [bankName, setBankName] = useState("");
  const [bankAccountHolder, setBankAccountHolder] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankBranchCode, setBankBranchCode] = useState("");
  const [paymentReferenceInstructions, setPaymentReferenceInstructions] = useState("");
  const [bankingInitialized, setBankingInitialized] = useState(false);

  React.useEffect(() => {
    if (stats && !bankingInitialized) {
      setBankName(stats.bankName ?? "");
      setBankAccountHolder(stats.bankAccountHolder ?? "");
      setBankAccountNumber(stats.bankAccountNumber ?? "");
      setBankBranchCode(stats.bankBranchCode ?? "");
      setPaymentReferenceInstructions(stats.paymentReferenceInstructions ?? "");
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
      }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-stats", clinicId] });
      toast({ title: "Banking details saved" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to save banking details", description: e.message }),
  });

  if (statsLoading) {
    return <div className="p-8 space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  }

  if (clinicType === "government") {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="text-center py-16 space-y-4">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <Receipt className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold">Not Available</h2>
          <p className="text-muted-foreground">
            Billing is not available for Government clinics. Patients receive services free of charge
            and no invoices or payment workflows are generated.
          </p>
        </div>
      </div>
    );
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
                    {canManage && inv.status !== "paid" && inv.status !== "cancelled" && (
                      <Button variant="outline" size="sm" onClick={() => { setSelectedInvoice(inv); payForm.setValue("amount", Number(inv.balance)); setIsPayOpen(true); }}>
                        <CreditCard className="w-3 h-3 mr-1" /> Pay
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banking Details Management (admin only, non-government clinics) */}
      {isAdmin && stats?.clinicType !== "government" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Landmark className="w-4 h-4" />
              Banking Details
            </CardTitle>
            <CardDescription>
              Configure bank transfer details shown to patients on their invoice page.
              Only visible to patients of private / NGO clinics.
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
      <Dialog open={isPayOpen} onOpenChange={setIsPayOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          {selectedInvoice && (
            <div className="text-sm text-muted-foreground mb-2">
              <p><span className="font-medium">{selectedInvoice.invoiceCode}</span> — {selectedInvoice.patientName}</p>
              <p>Balance: <span className="font-semibold text-foreground">R {Number(selectedInvoice.balance).toFixed(2)}</span></p>
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
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="transfer">Bank Transfer</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    </SelectContent>
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
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
