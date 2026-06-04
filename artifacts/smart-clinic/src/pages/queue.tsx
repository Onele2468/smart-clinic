import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinicModules } from "@/hooks/useClinicModules";
import {
  useGetLiveQueue,
  useAddToQueue,
  useUpdateQueueEntry,
  useListPatients,
  useCreateNurseAssessment,
  useListStaffAvailability,
  QueueEntryInputType,
  QueueEntryUpdateStatus,
  getGetLiveQueueQueryKey,
  getListPatientsQueryKey,
  getListStaffAvailabilityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Plus, ChevronRight, User, Stethoscope, Activity, CheckCircle2,
  AlertCircle, Pill, FlaskConical, Heart, Wifi, WifiOff, Coffee,
  CreditCard, Banknote, ReceiptText, Building2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

type QueueStatus = "waiting" | "nurse_assessment" | "doctor_consultation" | "pharmacy" | "laboratory" | "completed" | "skipped";
type AvailStatus = "available" | "busy" | "in_consultation" | "offline" | "on_break";

const AVAIL_CONFIG: Record<AvailStatus, { dot: string; label: string }> = {
  available:       { dot: "bg-emerald-500", label: "Available" },
  in_consultation: { dot: "bg-violet-500",  label: "In Consult" },
  busy:            { dot: "bg-amber-500",   label: "Busy" },
  on_break:        { dot: "bg-blue-400",    label: "On Break" },
  offline:         { dot: "bg-gray-400",    label: "Offline" },
};

interface StageConfig {
  key: QueueStatus;
  label: string;
  next: QueueStatus | null;
  nextLabel: string;
  color: string;
  badgeClass: string;
  icon: React.ElementType;
  allowedRoles: string[];
}

const STAGES: StageConfig[] = [
  {
    key: "waiting",
    label: "Waiting",
    next: "nurse_assessment",
    nextLabel: "Move to Nurse Assessment",
    color: "border-amber-200 bg-amber-50/40 dark:bg-amber-900/10",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0",
    icon: Clock,
    allowedRoles: ["clinic_admin", "nurse", "receptionist"],
  },
  {
    key: "nurse_assessment",
    label: "Nurse Assessment",
    next: "doctor_consultation",
    nextLabel: "Send to Doctor",
    color: "border-blue-200 bg-blue-50/40 dark:bg-blue-900/10",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0",
    icon: Activity,
    allowedRoles: ["clinic_admin", "nurse", "doctor"],
  },
  {
    key: "doctor_consultation",
    label: "Doctor Consultation",
    next: "completed",
    nextLabel: "Mark Completed",
    color: "border-violet-200 bg-violet-50/40 dark:bg-violet-900/10",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300 border-0",
    icon: Stethoscope,
    allowedRoles: ["clinic_admin", "doctor"],
  },
  {
    key: "pharmacy",
    label: "Pharmacy",
    next: "completed",
    nextLabel: "Mark Completed",
    color: "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-900/10",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-0",
    icon: Pill,
    allowedRoles: ["clinic_admin", "pharmacist", "nurse"],
  },
  {
    key: "laboratory",
    label: "Laboratory",
    next: "completed",
    nextLabel: "Mark Completed",
    color: "border-cyan-200 bg-cyan-50/40 dark:bg-cyan-900/10",
    badgeClass: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300 border-0",
    icon: FlaskConical,
    allowedRoles: ["clinic_admin", "lab_technician", "doctor"],
  },
  {
    key: "completed",
    label: "Completed",
    next: null,
    nextLabel: "",
    color: "border-green-200 bg-green-50/40 dark:bg-green-900/10",
    badgeClass: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-0",
    icon: CheckCircle2,
    allowedRoles: [],
  },
];

// Department-based stage visibility — each role only sees its relevant workflow columns
const DEPT_VISIBLE_STAGES: Record<string, QueueStatus[]> = {
  receptionist:   ["waiting", "nurse_assessment"],
  nurse:          ["waiting", "nurse_assessment", "doctor_consultation"],
  doctor:         ["nurse_assessment", "doctor_consultation", "laboratory", "completed"],
  lab_technician: ["laboratory", "completed"],
  pharmacist:     ["pharmacy", "completed"],
  cashier:        [], // cashier has a separate invoice-based payment queue view
  clinic_admin:   ["waiting", "nurse_assessment", "doctor_consultation", "pharmacy", "laboratory", "completed"],
};

interface DeptInfo { title: string; subtitle: (counts: any) => string }
const DEPT_INFO: Record<string, DeptInfo> = {
  receptionist:   { title: "Reception Queue",     subtitle: c => `${c.waiting} waiting · ${c.nurseAssessment} in nurse assessment` },
  nurse:          { title: "Nursing Queue",        subtitle: c => `${c.waiting} waiting · ${c.nurseAssessment} in assessment · Avg wait ${c.avgWaitMinutes} min` },
  doctor:         { title: "Consultation Queue",   subtitle: c => `${c.nurseAssessment} ready for consult · ${c.doctorConsultation} in consultation · ${c.laboratory} in lab` },
  lab_technician: { title: "Laboratory Queue",     subtitle: c => `${c.laboratory} active lab request${c.laboratory !== 1 ? "s" : ""} · ${c.completed} completed today` },
  pharmacist:     { title: "Pharmacy Queue",       subtitle: c => `${c.pharmacy} waiting for dispensing · ${c.completed} completed today` },
  cashier:        { title: "Payment Queue",        subtitle: _ => "Outstanding invoices and pending payments" },
  clinic_admin:   { title: "Live Queue",           subtitle: c => `${c.inProgress} active · ${c.completed} completed · Avg wait ${c.avgWaitMinutes} min${c.pharmacy > 0 ? ` · ${c.pharmacy} in pharmacy` : ""}${c.laboratory > 0 ? ` · ${c.laboratory} in lab` : ""}` },
};

const BASE_URL = import.meta.env.BASE_URL;
const authFetch = (path: string) =>
  fetch(`${BASE_URL}${path.replace(/^\//, "")}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem("token") ?? ""}` },
  }).then(r => r.json());

// Cashier payment queue — shows unpaid and partially-paid invoices
function CashierPaymentQueue({ clinicId }: { clinicId: string }) {
  const { data: unpaid = [], isLoading: lu } = useQuery<any[]>({
    queryKey: ["cashier-queue-unpaid", clinicId],
    queryFn: () => authFetch(`api/clinics/${clinicId}/invoices?status=unpaid`),
    enabled: !!clinicId,
    refetchInterval: 30000,
  });
  const { data: partial = [], isLoading: lp } = useQuery<any[]>({
    queryKey: ["cashier-queue-partial", clinicId],
    queryFn: () => authFetch(`api/clinics/${clinicId}/invoices?status=partial`),
    enabled: !!clinicId,
    refetchInterval: 30000,
  });

  const isLoading = lu || lp;
  const all = [...(unpaid ?? []), ...(partial ?? [])].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  if (isLoading) {
    return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  }

  if (all.length === 0) {
    return (
      <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
        <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-25" />
        <p className="font-medium">No outstanding invoices</p>
        <p className="text-sm mt-1">All payments are up to date.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {all.map((inv: any) => {
        const isPartial = inv.status === "partial";
        const balance = Number(inv.balance ?? 0);
        const total = Number(inv.totalAmount ?? 0);
        const paidPct = total > 0 ? Math.min(100, ((total - balance) / total) * 100) : 0;
        return (
          <div key={inv.id} className={`rounded-xl border-2 p-4 space-y-2 bg-background shadow-sm ${isPartial ? "border-blue-200" : "border-amber-200"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{inv.patientName}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{inv.invoiceCode}</p>
              </div>
              <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${isPartial ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>
                {isPartial ? "Partial" : "Unpaid"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">R {total.toFixed(2)}</span>
            </div>
            {isPartial && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="text-green-700 font-medium">R {(total - balance).toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${paidPct}%` }} />
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-sm pt-1 border-t">
              <span className="text-muted-foreground">Outstanding</span>
              <span className="font-bold text-destructive">R {balance.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(inv.createdAt), { addSuffix: true })}</p>
          </div>
        );
      })}
    </div>
  );
}

const addToQueueSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  type: z.nativeEnum(QueueEntryInputType),
  priority: z.coerce.number().min(0).default(0),
  assignedDoctorId: z.string().nullable().optional(),
  assignedNurseId: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const assessmentSchema = z.object({
  bloodPressure: z.string().optional(),
  temperature: z.string().optional(),
  pulseRate: z.string().optional(),
  oxygenSaturation: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  bloodSugar: z.string().optional(),
  symptoms: z.string().optional(),
  triageNotes: z.string().optional(),
  triageLevel: z.enum(["emergency", "urgent", "normal", "non_urgent"]).default("normal"),
});

interface AssessmentEntry {
  id: string;
  patientId: string;
  patientName: string;
  ticketNumber: string;
}

function AvailDot({ status }: { status: string }) {
  const cfg = AVAIL_CONFIG[status as AvailStatus] ?? AVAIL_CONFIG.offline;
  return <span title={cfg.label} className={cn("inline-block w-2 h-2 rounded-full shrink-0", cfg.dot)} />;
}

export default function Queue() {
  const { user, clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const role = clinicMembership?.role || "";
  const currentUserId = user?.id ?? "";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [assessmentEntry, setAssessmentEntry] = useState<AssessmentEntry | null>(null);
  const [showAvailPanel, setShowAvailPanel] = useState(false);

  const { data: liveQueue, isLoading } = useGetLiveQueue(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetLiveQueueQueryKey(clinicId), refetchInterval: 15000 }
  });

  const { data: patients } = useListPatients(
    clinicId,
    { search: patientSearch || undefined },
    { query: { enabled: !!clinicId && patientSearch.length > 1, queryKey: getListPatientsQueryKey(clinicId, { search: patientSearch || undefined }) } }
  );

  const canAdd = ["clinic_admin", "receptionist", "nurse"].includes(role);

  const { data: staffList } = useListStaffAvailability(
    clinicId,
    {},
    { query: { enabled: !!clinicId && (canAdd || ["clinic_admin", "receptionist"].includes(role)), queryKey: getListStaffAvailabilityQueryKey(clinicId), refetchInterval: 20000 } }
  );

  const doctors = (staffList ?? []).filter(s => s.role === "doctor");
  const nurses = (staffList ?? []).filter(s => s.role === "nurse");
  const availDoctors = doctors.filter(d => d.availabilityStatus === "available");
  const availNurses = nurses.filter(n => n.availabilityStatus === "available");

  const addToQueueMutation = useAddToQueue();
  const updateQueueMutation = useUpdateQueueEntry();
  const createAssessmentMutation = useCreateNurseAssessment();

  const form = useForm<z.infer<typeof addToQueueSchema>>({
    resolver: zodResolver(addToQueueSchema),
    defaultValues: { patientId: "", type: QueueEntryInputType.registration, priority: 0, notes: "", assignedDoctorId: null, assignedNurseId: null },
  });

  const assessmentForm = useForm<z.infer<typeof assessmentSchema>>({
    resolver: zodResolver(assessmentSchema),
    defaultValues: {
      bloodPressure: "", temperature: "", pulseRate: "", oxygenSaturation: "",
      weight: "", height: "", bloodSugar: "", symptoms: "", triageNotes: "", triageLevel: "normal",
    },
  });

  const onAddToQueue = async (values: z.infer<typeof addToQueueSchema>) => {
    try {
      await addToQueueMutation.mutateAsync({
        clinicId,
        data: {
          patientId: values.patientId,
          type: values.type,
          priority: values.priority,
          assignedDoctorId: values.assignedDoctorId ?? null,
          assignedNurseId: values.assignedNurseId ?? null,
          notes: values.notes ?? null,
        } as any,
      });
      queryClient.invalidateQueries({ queryKey: getGetLiveQueueQueryKey(clinicId) });
      toast({ title: "Patient added to queue" });
      setIsAddOpen(false);
      form.reset();
      setPatientSearch("");
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to add to queue", description: error?.message });
    }
  };

  const moveToStage = async (entryId: string, status: QueueStatus) => {
    try {
      await updateQueueMutation.mutateAsync({ clinicId, queueId: entryId, data: { status: status as QueueEntryUpdateStatus } });
      queryClient.invalidateQueries({ queryKey: getGetLiveQueueQueryKey(clinicId) });
      queryClient.invalidateQueries({ queryKey: getListStaffAvailabilityQueryKey(clinicId) });
      toast({ title: `Moved to ${status.replace(/_/g, " ")}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to update queue", description: error?.message });
    }
  };

  const markSkipped = async (entryId: string) => {
    try {
      await updateQueueMutation.mutateAsync({ clinicId, queueId: entryId, data: { status: "skipped" as QueueEntryUpdateStatus } });
      queryClient.invalidateQueries({ queryKey: getGetLiveQueueQueryKey(clinicId) });
      toast({ title: "Patient marked as skipped" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error?.message });
    }
  };

  const onSubmitAssessment = async (values: z.infer<typeof assessmentSchema>) => {
    if (!assessmentEntry) return;
    try {
      const cleanValues = Object.fromEntries(
        Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
      );
      await createAssessmentMutation.mutateAsync({
        clinicId,
        patientId: assessmentEntry.patientId,
        data: { ...cleanValues, queueEntryId: assessmentEntry.id } as any,
      });
      queryClient.invalidateQueries({ queryKey: getGetLiveQueueQueryKey(clinicId) });
      toast({ title: "Nurse assessment recorded — patient moved to doctor consultation" });
      setAssessmentEntry(null);
      assessmentForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to record assessment", description: error?.message });
    }
  };

  const entries = liveQueue?.entries ?? [];
  const skipped = entries.filter(e => e.status === "skipped");

  // Role-aware entry filtering per stage:
  // Doctors only see patients assigned to them (or unassigned) in doctor_consultation.
  const stageEntries = (key: QueueStatus) => {
    const items = entries.filter(e => e.status === key);
    if (role === "doctor" && key === "doctor_consultation") {
      return items.filter(e => !e.assignedDoctorId || e.assignedDoctorId === currentUserId);
    }
    return items;
  };

  const modules = useClinicModules();

  const canAssess = ["clinic_admin", "nurse", "doctor"].includes(role);
  const canViewAvailability = ["clinic_admin", "receptionist", "doctor", "nurse"].includes(role);

  // Restrict visible Kanban columns to the department's workflow scope,
  // then further narrow by clinic-type module flags (e.g. no pharmacy/lab for government clinics).
  const deptKeys = new Set<QueueStatus>(DEPT_VISIBLE_STAGES[role] ?? DEPT_VISIBLE_STAGES.clinic_admin);
  const visibleStages = (role === "clinic_admin" ? STAGES : STAGES.filter(s => deptKeys.has(s.key)))
    .filter(s => {
      if (s.key === "pharmacy"    && !modules.hasPharmacy)   return false;
      if (s.key === "laboratory"  && !modules.hasLaboratory) return false;
      return true;
    });

  // Role-aware page header
  const deptInfo = DEPT_INFO[role] ?? DEPT_INFO.clinic_admin;
  const queueCounts = {
    waiting: liveQueue?.waiting ?? 0,
    nurseAssessment: liveQueue?.nurseAssessment ?? 0,
    doctorConsultation: liveQueue?.doctorConsultation ?? 0,
    pharmacy: liveQueue?.pharmacy ?? 0,
    laboratory: liveQueue?.laboratory ?? 0,
    inProgress: liveQueue?.inProgress ?? 0,
    completed: liveQueue?.completed ?? 0,
    avgWaitMinutes: liveQueue?.avgWaitMinutes ?? 0,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{deptInfo.title}</h1>
          <p className="text-muted-foreground text-sm mt-1">{deptInfo.subtitle(queueCounts)}</p>
        </div>

        <div className="flex gap-2">
          {canViewAvailability && (
            <Button variant="outline" size="sm" onClick={() => setShowAvailPanel(v => !v)}>
              <Wifi className="h-4 w-4 mr-1.5" />
              Staff ({availDoctors.length + availNurses.length} available)
            </Button>
          )}

          {canAdd && (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Add to Queue</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Patient to Queue</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onAddToQueue)} className="space-y-4">
                    {/* Patient search */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Search Patient</label>
                      <Input
                        placeholder="Type name or code..."
                        value={patientSearch}
                        onChange={e => setPatientSearch(e.target.value)}
                      />
                      {patients && patients.length > 0 && (
                        <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                          {patients.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                              onClick={() => {
                                form.setValue("patientId", p.id);
                                setPatientSearch(`${p.firstName} ${p.lastName} (${p.patientCode})`);
                              }}
                            >
                              <span className="font-medium">{p.firstName} {p.lastName}</span>
                              <span className="text-muted-foreground ml-2">{p.patientCode}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      <FormField control={form.control} name="patientId" render={({ field }) => (
                        <input type="hidden" {...field} />
                      )} />
                    </div>

                    {/* Queue type */}
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Queue Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="registration">Registration</SelectItem>
                            <SelectItem value="nurse">Nurse Visit</SelectItem>
                            <SelectItem value="doctor">Doctor Consultation</SelectItem>
                            <SelectItem value="emergency">Emergency</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    {/* Assign Doctor */}
                    <FormField control={form.control} name="assignedDoctorId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Doctor <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Select onValueChange={v => field.onChange(v === "none" ? null : v)} value={field.value ?? "none"}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select doctor..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">— No doctor assigned —</SelectItem>
                            {doctors.map(d => (
                              <SelectItem key={d.userId} value={d.userId}>
                                <div className="flex items-center gap-2">
                                  <AvailDot status={d.availabilityStatus} />
                                  {d.name}
                                  <span className="text-muted-foreground text-xs ml-1">({AVAIL_CONFIG[d.availabilityStatus as AvailStatus]?.label ?? d.availabilityStatus})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    {/* Assign Nurse */}
                    <FormField control={form.control} name="assignedNurseId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Nurse <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Select onValueChange={v => field.onChange(v === "none" ? null : v)} value={field.value ?? "none"}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select nurse..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="none">— No nurse assigned —</SelectItem>
                            {nurses.map(n => (
                              <SelectItem key={n.userId} value={n.userId}>
                                <div className="flex items-center gap-2">
                                  <AvailDot status={n.availabilityStatus} />
                                  {n.name}
                                  <span className="text-muted-foreground text-xs ml-1">({AVAIL_CONFIG[n.availabilityStatus as AvailStatus]?.label ?? n.availabilityStatus})</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />

                    {/* Notes */}
                    <FormField control={form.control} name="notes" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl><Textarea rows={2} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <Button type="submit" className="w-full" disabled={addToQueueMutation.isPending}>
                      {addToQueueMutation.isPending ? "Adding..." : "Add to Queue"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Staff Availability Panel */}
      {showAvailPanel && canViewAvailability && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                Staff Availability
              </span>
              <div className="flex gap-4 text-xs font-normal">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {availDoctors.length} dr available</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> {availNurses.length} nurse available</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {(staffList ?? []).map(member => {
                const cfg = AVAIL_CONFIG[member.availabilityStatus as AvailStatus] ?? AVAIL_CONFIG.offline;
                return (
                  <div key={member.userId} className="flex items-center gap-2 bg-background rounded-lg px-3 py-2 border">
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {member.name.charAt(0)}
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background", cfg.dot)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{member.role} · {cfg.label}</p>
                    </div>
                  </div>
                );
              })}
              {(staffList ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground col-span-full py-2">No staff records found. Staff must set their availability from their dashboard.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cashier role: show invoice payment queue instead of the Kanban (private/NGO only) */}
      {role === "cashier" && modules.hasCashier && <CashierPaymentQueue clinicId={clinicId} />}

      {role !== "cashier" && (
        isLoading ? (
          <div className="grid gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        ) : (
        <div className={`grid gap-4 sm:grid-cols-2 ${visibleStages.length <= 2 ? "lg:grid-cols-2" : visibleStages.length <= 3 ? "lg:grid-cols-3" : visibleStages.length <= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3 xl:grid-cols-6"}`}>
          {visibleStages.map(stage => {
            const stageItems = stageEntries(stage.key);
            const StageIcon = stage.icon;
            return (
              <div key={stage.key} className={`rounded-xl border-2 ${stage.color} p-4 space-y-3 min-h-[220px]`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StageIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold text-xs">{stage.label}</h3>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">{stageItems.length}</Badge>
                </div>

                <div className="space-y-2">
                  {stageItems.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-xs">Empty</div>
                  ) : (
                    stageItems.map(entry => (
                      <div key={entry.id} className="bg-background border rounded-lg p-3 shadow-sm space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <p className="font-semibold text-xs truncate">{entry.patientName}</p>
                            <p className="text-[10px] text-muted-foreground">{entry.ticketNumber} · {entry.patientCode}</p>
                          </div>
                          <Badge className={`${stage.badgeClass} shrink-0 text-[9px]`}>{entry.type}</Badge>
                        </div>

                        {/* Assigned doctor/nurse */}
                        {(entry.assignedDoctorName || entry.assignedNurseName) && (
                          <div className="space-y-0.5">
                            {entry.assignedDoctorName && (
                              <p className="text-[10px] text-violet-700 flex items-center gap-1">
                                <Stethoscope className="h-2.5 w-2.5" />
                                Dr. {entry.assignedDoctorName}
                              </p>
                            )}
                            {entry.assignedNurseName && (
                              <p className="text-[10px] text-blue-600 flex items-center gap-1">
                                <Heart className="h-2.5 w-2.5" />
                                {entry.assignedNurseName}
                              </p>
                            )}
                          </div>
                        )}

                        {entry.notes && (
                          <p className="text-[10px] text-muted-foreground bg-muted rounded px-2 py-1 truncate">{entry.notes}</p>
                        )}

                        <p className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                        </p>

                        {/* Nurse assessment button */}
                        {stage.key === "nurse_assessment" && canAssess && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full h-7 text-xs border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setAssessmentEntry({ id: entry.id, patientId: entry.patientId, patientName: entry.patientName ?? "", ticketNumber: entry.ticketNumber });
                              assessmentForm.reset();
                            }}
                          >
                            <Heart className="h-3 w-3 mr-1" /> Record Vitals
                          </Button>
                        )}

                        {/* Pharmacy/Lab routing from doctor_consultation */}
                        {stage.key === "doctor_consultation" && ["clinic_admin", "doctor"].includes(role) && (
                          <div className="flex gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-[10px] border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => moveToStage(entry.id, "pharmacy")}
                              disabled={updateQueueMutation.isPending}
                            >
                              <Pill className="h-3 w-3 mr-1" /> Pharmacy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-[10px] border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                              onClick={() => moveToStage(entry.id, "laboratory")}
                              disabled={updateQueueMutation.isPending}
                            >
                              <FlaskConical className="h-3 w-3 mr-1" /> Lab
                            </Button>
                          </div>
                        )}

                        {stage.next && stage.allowedRoles.includes(role) && stage.key !== "nurse_assessment" && (
                          <div className="flex gap-1 pt-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs"
                              onClick={() => moveToStage(entry.id, stage.next!)}
                              disabled={updateQueueMutation.isPending}
                            >
                              {stage.nextLabel} <ChevronRight className="ml-1 h-3 w-3" />
                            </Button>
                          </div>
                        )}

                        {stage.key === "waiting" && role !== "doctor" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full h-6 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() => markSkipped(entry.id)}
                          >
                            Mark No-show
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        )
      )}

      {skipped.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
              Skipped / No-show ({skipped.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {skipped.map(e => (
                <Badge key={e.id} variant="secondary" className="text-xs">
                  {e.ticketNumber} · {e.patientName}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Nurse Assessment Side Sheet */}
      <Sheet open={!!assessmentEntry} onOpenChange={(open) => { if (!open) setAssessmentEntry(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-blue-600" />
              Nurse Assessment
            </SheetTitle>
            {assessmentEntry && (
              <p className="text-sm text-muted-foreground">
                {assessmentEntry.patientName} · {assessmentEntry.ticketNumber}
              </p>
            )}
          </SheetHeader>

          <Form {...assessmentForm}>
            <form onSubmit={assessmentForm.handleSubmit(onSubmitAssessment)} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={assessmentForm.control} name="bloodPressure" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Blood Pressure</FormLabel>
                    <FormControl><Input placeholder="e.g. 120/80" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={assessmentForm.control} name="pulseRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Pulse Rate (bpm)</FormLabel>
                    <FormControl><Input placeholder="e.g. 72" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={assessmentForm.control} name="temperature" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Temperature (°C)</FormLabel>
                    <FormControl><Input placeholder="e.g. 36.8" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={assessmentForm.control} name="oxygenSaturation" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">O₂ Saturation (%)</FormLabel>
                    <FormControl><Input placeholder="e.g. 98" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={assessmentForm.control} name="weight" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Weight (kg)</FormLabel>
                    <FormControl><Input placeholder="e.g. 70" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={assessmentForm.control} name="height" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Height (cm)</FormLabel>
                    <FormControl><Input placeholder="e.g. 175" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={assessmentForm.control} name="bloodSugar" render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="text-xs">Blood Sugar (mmol/L)</FormLabel>
                    <FormControl><Input placeholder="e.g. 5.4" className="h-8 text-sm" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>

              <FormField control={assessmentForm.control} name="symptoms" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Chief Symptoms</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Describe main symptoms..." className="text-sm" {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={assessmentForm.control} name="triageLevel" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Triage Level</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="h-8"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="emergency">🔴 Emergency</SelectItem>
                      <SelectItem value="urgent">🟠 Urgent</SelectItem>
                      <SelectItem value="normal">🟢 Normal</SelectItem>
                      <SelectItem value="non_urgent">🔵 Non-Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />

              <FormField control={assessmentForm.control} name="triageNotes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Triage Notes</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Additional assessment notes..." className="text-sm" {...field} /></FormControl>
                </FormItem>
              )} />

              <Button type="submit" className="w-full" disabled={createAssessmentMutation.isPending}>
                {createAssessmentMutation.isPending ? "Saving..." : "Save Assessment & Send to Doctor"}
              </Button>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
