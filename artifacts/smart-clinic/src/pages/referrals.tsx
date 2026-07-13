import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useListClinicDoctors, useListPatients, getListPatientsQueryKey } from "@workspace/api-client-react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Filter,
  History,
  Plus,
  Search,
  Send,
  Stethoscope,
  User,
  XCircle,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const ALL = "all";
const PAGE_SIZE = 10;

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...opts?.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

type ReferralStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";
type ReferralType = "internal" | "external" | "specialist" | "hospital";
type ReferralUrgency = "routine" | "urgent" | "emergency";

type Referral = {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientCode?: string | null;
  consultationId?: string | null;
  referringDoctorId?: string | null;
  referringDoctorName?: string | null;
  targetClinicId?: string | null;
  referralType: ReferralType;
  destinationName: string;
  specialty?: string | null;
  urgency: ReferralUrgency;
  reason: string;
  clinicalSummary?: string | null;
  documentText?: string | null;
  status: ReferralStatus;
  consentGiven: boolean;
  consentGivenAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ReferralDetail = Referral & {
  documents: Array<{ id: string; documentType: string; documentText?: string | null; createdAt: string }>;
  history: Array<{
    id: string;
    oldStatus?: string | null;
    newStatus: string;
    notes?: string | null;
    createdByName?: string | null;
    createdAt: string;
  }>;
};

type ReferralListResponse = {
  data: Referral[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ReferralDashboard = {
  total: number;
  incoming: number;
  outgoing: number;
  pending: number;
  accepted: number;
  rejected: number;
  completed: number;
  cancelled: number;
  urgent: number;
  emergency: number;
};

const statusClass: Record<ReferralStatus, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  accepted: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
};

const urgencyClass: Record<ReferralUrgency, string> = {
  routine: "bg-slate-100 text-slate-700 border-slate-200",
  urgent: "bg-orange-100 text-orange-800 border-orange-200",
  emergency: "bg-red-100 text-red-800 border-red-200",
};

const emptyForm = {
  patientId: "",
  consultationId: "",
  referringDoctorId: "",
  targetClinicId: "",
  referralType: "external" as ReferralType,
  destinationName: "",
  specialty: "",
  urgency: "routine" as ReferralUrgency,
  reason: "",
  clinicalSummary: "",
  consentGiven: false,
};

function statusLabel(status: string) {
  return status.replace("_", " ").toUpperCase();
}

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: number; icon: React.ElementType; tone: string }) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </Card>
  );
}

function ReferralBadges({ referral }: { referral: Referral }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className={cn("text-xs", statusClass[referral.status])}>{statusLabel(referral.status)}</Badge>
      <Badge variant="outline" className={cn("text-xs capitalize", urgencyClass[referral.urgency])}>{referral.urgency}</Badge>
      <Badge variant="outline" className="text-xs capitalize">{referral.referralType}</Badge>
    </div>
  );
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== ALL) qs.set(key, String(value));
  });
  const text = qs.toString();
  return text ? `?${text}` : "";
}

export default function ReferralsPage() {
  const { clinicMembership, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId ?? "";
  const role = clinicMembership?.role ?? "";

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [urgency, setUrgency] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [direction, setDirection] = useState(ALL);
  const [doctorId, setDoctorId] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selectedReferralId, setSelectedReferralId] = useState<string | null>(() => new URLSearchParams(window.location.search).get("referralId"));
  const [action, setAction] = useState<ReferralStatus | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  const params = useMemo(() => ({
    search: search.trim() || undefined,
    status,
    urgency,
    referralType: type,
    direction,
    doctorId,
    page,
    limit: PAGE_SIZE,
  }), [search, status, urgency, type, direction, doctorId, page]);

  const queryText = buildQuery(params);
  const referralsQueryKey = ["referrals", clinicId, params];

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<ReferralDashboard>({
    queryKey: ["referrals-dashboard", clinicId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/referrals/dashboard`),
    enabled: !!clinicId,
  });

  const { data: referralPage, isLoading, isFetching } = useQuery<ReferralListResponse>({
    queryKey: referralsQueryKey,
    queryFn: () => apiFetch(`/clinics/${clinicId}/referrals${queryText}`),
    enabled: !!clinicId,
  });

  const { data: selectedReferral, isLoading: detailLoading } = useQuery<ReferralDetail>({
    queryKey: ["referral", clinicId, selectedReferralId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/referrals/${selectedReferralId}`),
    enabled: !!clinicId && !!selectedReferralId,
  });

  const { data: patients } = useListPatients(
    clinicId,
    {},
    { query: { enabled: !!clinicId && isCreateOpen, queryKey: getListPatientsQueryKey(clinicId, {}) } },
  );

  const { data: doctors } = useListClinicDoctors(
    clinicId,
    { query: { enabled: !!clinicId, queryKey: ["listClinicDoctors", clinicId] } },
  );

  const patientOptions = useMemo(
    () => (patients ?? []).map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}`, code: p.patientCode })),
    [patients],
  );

  const doctorOptions = useMemo(
    () => (doctors ?? []).map((d) => ({ value: d.id, label: d.name, sub: d.staffCode ?? d.role })),
    [doctors],
  );

  const canCreate = ["clinic_admin", "doctor", "nurse", "receptionist"].includes(role);
  const canClinicalAction = ["clinic_admin", "doctor"].includes(role);
  const canCoordinateAction = ["clinic_admin", "doctor", "receptionist"].includes(role);

  const invalidateReferrals = () => {
    queryClient.invalidateQueries({ queryKey: ["referrals", clinicId] });
    queryClient.invalidateQueries({ queryKey: ["referrals-dashboard", clinicId] });
    if (selectedReferralId) queryClient.invalidateQueries({ queryKey: ["referral", clinicId, selectedReferralId] });
  };

  const createMutation = useMutation({
    mutationFn: () => apiFetch<Referral>(`/clinics/${clinicId}/referrals`, {
      method: "POST",
      body: JSON.stringify({
        ...form,
        consultationId: form.consultationId || null,
        referringDoctorId: form.referringDoctorId || (role === "doctor" ? user?.id : null),
        targetClinicId: form.targetClinicId || null,
        specialty: form.specialty || null,
        clinicalSummary: form.clinicalSummary || null,
      }),
    }),
    onSuccess: (created) => {
      invalidateReferrals();
      toast({ title: "Referral created", description: "The referral letter and audit history were recorded." });
      setForm(emptyForm);
      setIsCreateOpen(false);
      setSelectedReferralId(created.id);
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Failed to create referral", description: error.message }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, nextStatus, notes }: { id: string; nextStatus: ReferralStatus; notes?: string }) =>
      apiFetch<Referral>(`/clinics/${clinicId}/referrals/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus, notes: notes || null }),
      }),
    onSuccess: () => {
      invalidateReferrals();
      toast({ title: "Referral updated" });
      setAction(null);
      setActionNotes("");
    },
    onError: (error: Error) => toast({ variant: "destructive", title: "Failed to update referral", description: error.message }),
  });

  const canSubmit = form.patientId && form.destinationName.trim() && form.reason.trim().length >= 3;
  const referrals = referralPage?.data ?? [];
  const totalPages = referralPage?.totalPages ?? 1;
  const hasFilters = search || status !== ALL || urgency !== ALL || type !== ALL || direction !== ALL || doctorId !== ALL;

  const openAction = (nextStatus: ReferralStatus, referralId: string) => {
    setSelectedReferralId(referralId);
    setAction(nextStatus);
    setActionNotes("");
  };

  const clearFilters = () => {
    setSearch("");
    setStatus(ALL);
    setUrgency(ALL);
    setType(ALL);
    setDirection(ALL);
    setDoctorId(ALL);
    setPage(1);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Referrals</h1>
          <p className="text-muted-foreground text-sm mt-1">Create, route, and audit patient referrals across clinics and external care providers.</p>
        </div>

        {canCreate && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Referral</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Referral</DialogTitle>
                <DialogDescription>Record patient consent, referral reason, destination, and clinical context.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Patient</Label>
                    <Select value={form.patientId} onValueChange={(patientId) => setForm((f) => ({ ...f, patientId }))}>
                      <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                      <SelectContent>
                        {patientOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label} ({p.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Referring Doctor</Label>
                    <Select value={form.referringDoctorId} onValueChange={(referringDoctorId) => setForm((f) => ({ ...f, referringDoctorId }))}>
                      <SelectTrigger><SelectValue placeholder={role === "doctor" ? "Defaults to you" : "Select doctor"} /></SelectTrigger>
                      <SelectContent>
                        {doctorOptions.map((doctor) => (
                          <SelectItem key={doctor.value} value={doctor.value}>{doctor.label} ({doctor.sub})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={form.referralType} onValueChange={(referralType: ReferralType) => setForm((f) => ({ ...f, referralType }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="external">External</SelectItem>
                        <SelectItem value="internal">Internal Clinic</SelectItem>
                        <SelectItem value="specialist">Specialist</SelectItem>
                        <SelectItem value="hospital">Hospital</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Urgency</Label>
                    <Select value={form.urgency} onValueChange={(urgency: ReferralUrgency) => setForm((f) => ({ ...f, urgency }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="routine">Routine</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                        <SelectItem value="emergency">Emergency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Destination</Label>
                    <Input value={form.destinationName} onChange={(e) => setForm((f) => ({ ...f, destinationName: e.target.value }))} placeholder="Clinic, specialist, or hospital" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Specialty</Label>
                    <Input value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} placeholder="Optional" />
                  </div>
                  {form.referralType === "internal" && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Target Clinic ID</Label>
                      <Input value={form.targetClinicId} onChange={(e) => setForm((f) => ({ ...f, targetClinicId: e.target.value }))} placeholder="Internal receiving clinic UUID" />
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm sm:col-span-2 rounded-md border p-3">
                    <Checkbox checked={form.consentGiven} onCheckedChange={(checked) => setForm((f) => ({ ...f, consentGiven: checked === true }))} />
                    Patient consent recorded for referral information sharing
                  </label>
                </div>
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Textarea rows={3} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason for referral" />
                </div>
                <div className="space-y-1.5">
                  <Label>Clinical Summary</Label>
                  <Textarea rows={4} value={form.clinicalSummary} onChange={(e) => setForm((f) => ({ ...f, clinicalSummary: e.target.value }))} placeholder="Relevant clinical context only" />
                </div>
                <Button className="w-full" disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Creating..." : "Create Referral"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {dashboardLoading ? (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <StatCard label="Total" value={dashboard?.total ?? 0} icon={Send} tone="bg-blue-50 text-blue-700" />
            <StatCard label="Pending" value={dashboard?.pending ?? 0} icon={Clock} tone="bg-amber-50 text-amber-700" />
            <StatCard label="Accepted" value={dashboard?.accepted ?? 0} icon={CheckCircle2} tone="bg-green-50 text-green-700" />
            <StatCard label="Incoming" value={dashboard?.incoming ?? 0} icon={FileText} tone="bg-cyan-50 text-cyan-700" />
            <StatCard label="Urgent / Emergency" value={(dashboard?.urgent ?? 0) + (dashboard?.emergency ?? 0)} icon={AlertTriangle} tone="bg-red-50 text-red-700" />
          </>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" /> Referral List
                {isFetching && !isLoading && <span className="text-xs font-normal text-muted-foreground">Refreshing...</span>}
              </CardTitle>
              <CardDescription>{referralPage?.total ?? 0} referral{referralPage?.total === 1 ? "" : "s"} found</CardDescription>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start lg:self-center text-muted-foreground">
                <XCircle className="h-4 w-4 mr-1" /> Clear filters
              </Button>
            )}
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-2">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search patient, destination, specialty..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={urgency} onValueChange={(value) => { setUrgency(value); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Urgency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Urgency</SelectItem>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(value) => { setType(value); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Types</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="external">External</SelectItem>
                <SelectItem value="specialist">Specialist</SelectItem>
                <SelectItem value="hospital">Hospital</SelectItem>
              </SelectContent>
            </Select>
            <Select value={direction} onValueChange={(value) => { setDirection(value); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Direction" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Directions</SelectItem>
                <SelectItem value="outgoing">Outgoing</SelectItem>
                <SelectItem value="incoming">Incoming</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select value={doctorId} onValueChange={(value) => { setDoctorId(value); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Doctor referral history" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Doctors</SelectItem>
                {doctorOptions.map((doctor) => (
                  <SelectItem key={doctor.value} value={doctor.value}>{doctor.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground border rounded-lg bg-muted/10">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No referrals found</p>
              <p className="text-sm mt-1">{hasFilters ? "Adjust the filters to broaden the list." : "Create the first referral when a patient needs care outside this visit."}</p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y overflow-hidden">
              {referrals.map((referral) => {
                const canAcceptReject = referral.status === "pending" && canCoordinateAction;
                const canComplete = referral.status === "accepted" && canClinicalAction;
                const canCancel = ["pending", "accepted"].includes(referral.status) && canCoordinateAction;
                return (
                  <div key={referral.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                          <button className="font-semibold text-left hover:underline" onClick={() => setSelectedReferralId(referral.id)}>
                            {referral.destinationName}
                          </button>
                          <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-1.5">
                            <Link href={`/patients/${referral.patientId}`} className="hover:underline">{referral.patientName}</Link>
                            {referral.patientCode && <span className="font-mono">({referral.patientCode})</span>}
                            <span>-</span>
                            <span>{format(new Date(referral.createdAt), "MMM d, yyyy h:mm a")}</span>
                            {referral.referringDoctorName && (
                              <>
                                <span>-</span>
                                <span>Dr. {referral.referringDoctorName}</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{referral.reason}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-start xl:items-end gap-3 shrink-0">
                        <ReferralBadges referral={referral} />
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => setSelectedReferralId(referral.id)}>
                            <History className="w-3.5 h-3.5 mr-1" /> Details
                          </Button>
                          {canAcceptReject && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-700 border-green-200 hover:bg-green-50" onClick={() => openAction("accepted", referral.id)}>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Accept
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-700 border-red-200 hover:bg-red-50" onClick={() => openAction("rejected", referral.id)}>
                                <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                              </Button>
                            </>
                          )}
                          {canComplete && (
                            <Button size="sm" variant="outline" className="text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => openAction("completed", referral.id)}>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Complete
                            </Button>
                          )}
                          {canCancel && (
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => openAction("cancelled", referral.id)}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedReferralId && !action} onOpenChange={(open) => { if (!open) setSelectedReferralId(null); }}>
        <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
          {detailLoading || !selectedReferral ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedReferral.destinationName}
                </DialogTitle>
                <DialogDescription>
                  {selectedReferral.patientName} {selectedReferral.patientCode ? `(${selectedReferral.patientCode})` : ""} - created {format(new Date(selectedReferral.createdAt), "MMM d, yyyy h:mm a")}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <ReferralBadges referral={selectedReferral} />
                  <Badge variant="outline">Consent: {selectedReferral.consentGiven ? "Recorded" : "Not recorded"}</Badge>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Patient</p>
                      <Link href={`/patients/${selectedReferral.patientId}`} className="font-medium hover:underline">{selectedReferral.patientName}</Link>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Referring Doctor</p>
                      <p className="font-medium">{selectedReferral.referringDoctorName ? `Dr. ${selectedReferral.referringDoctorName}` : "Not assigned"}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-muted-foreground">Specialty</p>
                      <p className="font-medium">{selectedReferral.specialty || "General"}</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold">Reason</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{selectedReferral.reason}</p>
                    </div>
                    {selectedReferral.clinicalSummary && (
                      <div>
                        <p className="text-sm font-semibold">Clinical Summary</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{selectedReferral.clinicalSummary}</p>
                      </div>
                    )}
                    {selectedReferral.documentText && (
                      <div>
                        <p className="text-sm font-semibold">Referral Letter</p>
                        <pre className="mt-1 max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 text-xs whitespace-pre-wrap font-sans">{selectedReferral.documentText}</pre>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Referral Timeline</p>
                    {!selectedReferral.history?.length ? (
                      <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">No status history recorded.</div>
                    ) : (
                      <div className="relative pl-5">
                        <div className="absolute left-2 top-0 bottom-0 w-px bg-border" />
                        <div className="space-y-4">
                          {selectedReferral.history.map((item) => (
                            <div key={item.id} className="relative">
                              <div className="absolute -left-[17px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                              <p className="text-sm font-medium">{statusLabel(item.newStatus)}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(item.createdAt), "MMM d, yyyy h:mm a")}
                                {item.createdByName ? ` - ${item.createdByName}` : ""}
                              </p>
                              {item.notes && <p className="text-xs mt-1 rounded bg-muted px-2 py-1">{item.notes}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!action} onOpenChange={(open) => { if (!open) setAction(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="capitalize">{action} referral?</DialogTitle>
            <DialogDescription>This update is written to referral history, activity logs, and notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={actionNotes} onChange={(e) => setActionNotes(e.target.value)} placeholder="Optional status note" rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={statusMutation.isPending}>Close</Button>
            <Button
              variant={action === "rejected" || action === "cancelled" ? "destructive" : "default"}
              disabled={!selectedReferralId || !action || statusMutation.isPending}
              onClick={() => selectedReferralId && action && statusMutation.mutate({ id: selectedReferralId, nextStatus: action, notes: actionNotes })}
            >
              {statusMutation.isPending ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
