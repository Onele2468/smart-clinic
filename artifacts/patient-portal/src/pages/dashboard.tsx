import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetPatientPortalMe,
  getGetPatientPortalMeQueryKey,
  useGetPatientPortalQueueStatus,
  getGetPatientPortalQueueStatusQueryKey,
  useListPatientPortalAppointments,
  getListPatientPortalAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Calendar, Clock, User, Building2, Activity, ChevronRight, Pill, CheckCircle2, Circle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  completed: "Completed",
  waiting: "Waiting",
  called: "Called",
  nurse_assessment: "With Nurse",
  doctor_consultation: "With Doctor",
  pharmacy: "At Pharmacy",
  lab: "At Lab",
};

const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  completed: "bg-gray-100 text-gray-700",
  waiting: "bg-amber-100 text-amber-800",
  called: "bg-purple-100 text-purple-800",
  nurse_assessment: "bg-cyan-100 text-cyan-800",
  doctor_consultation: "bg-indigo-100 text-indigo-800",
  pharmacy: "bg-violet-100 text-violet-800",
  lab: "bg-orange-100 text-orange-800",
};

const QUEUE_STAGES = [
  { key: "waiting", label: "Check-in" },
  { key: "nurse_assessment", label: "Nurse" },
  { key: "doctor_consultation", label: "Doctor" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "lab", label: "Lab" },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
      STATUS_COLOR[status] ?? "bg-muted text-muted-foreground"
    )}>
      {STATUS_LABEL[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function QueueProgressBar({ status }: { status: string }) {
  const currentIdx = QUEUE_STAGES.findIndex((s) => s.key === status);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-0">
        {QUEUE_STAGES.map((stage, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors text-xs font-bold",
                  done ? "bg-primary border-primary text-primary-foreground" :
                    active ? "bg-primary/20 border-primary text-primary animate-pulse" :
                      "bg-muted border-border text-muted-foreground"
                )}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-3 h-3" />}
                </div>
                <span className={cn(
                  "text-[10px] leading-none text-center",
                  active ? "text-primary font-semibold" : done ? "text-primary/70" : "text-muted-foreground"
                )}>
                  {stage.label}
                </span>
              </div>
              {i < QUEUE_STAGES.length - 1 && (
                <div className={cn("h-0.5 w-full mb-4 mx-0.5", done ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useGetPatientPortalMe({
    query: { queryKey: getGetPatientPortalMeQueryKey(), staleTime: 60_000 },
  });

  const { data: queueStatus } = useGetPatientPortalQueueStatus({
    query: { queryKey: getGetPatientPortalQueueStatusQueryKey(), refetchInterval: 15_000 },
  });

  const { data: appointments, isLoading: apptLoading } = useListPatientPortalAppointments(
    { upcoming: true },
    { query: { queryKey: getListPatientPortalAppointmentsQueryKey({ upcoming: true }) } }
  );

  const patient = profile?.patient;
  const clinic = profile?.clinic;
  const nextAppt = appointments?.filter((a) => a.status !== "cancelled" && a.status !== "completed")?.[0];

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-greeting">
            Hello, {patient?.firstName ?? user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="text-muted-foreground mt-0.5">Here's an overview of your health activity.</p>
        </div>

        {/* Queue status card */}
        {queueStatus?.inQueue && queueStatus.status && (
          <div className="mb-6 p-5 rounded-xl bg-primary/8 border border-primary/25" data-testid="queue-status-banner">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Activity className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-foreground">You're in the queue</p>
                    {(queueStatus as any).ticketNumber && (
                      <span className="font-mono text-xs font-bold bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                        {(queueStatus as any).ticketNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(queueStatus as any).aheadCount != null
                      ? `${(queueStatus as any).aheadCount} ahead · Est. ${queueStatus.estimatedWaitMinutes} min wait`
                      : `Position #${queueStatus.position} · Est. ${queueStatus.estimatedWaitMinutes} min wait`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={queueStatus.status} />
                <Link href="/queue" className="text-xs text-primary hover:underline font-medium flex items-center gap-0.5">
                  Details <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
            <QueueProgressBar status={queueStatus.status} />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Patient card */}
          <Card className="lg:col-span-2" data-testid="card-patient-info">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" />
                Patient Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profileLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
                </div>
              ) : patient ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Full Name</p>
                    <p className="font-medium" data-testid="text-patient-name">{patient.firstName} {patient.lastName}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Patient Code</p>
                    <p className="font-medium font-mono" data-testid="text-patient-code">{patient.patientCode}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Date of Birth</p>
                    <p className="font-medium">{patient.dateOfBirth}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Gender</p>
                    <p className="font-medium capitalize">{patient.gender}</p>
                  </div>
                  {patient.bloodType && (
                    <div>
                      <p className="text-muted-foreground text-xs">Blood Type</p>
                      <p className="font-medium">{patient.bloodType}</p>
                    </div>
                  )}
                  {patient.allergies && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Allergies</p>
                      <p className="font-medium text-destructive">{patient.allergies}</p>
                    </div>
                  )}
                  {patient.governmentIdNumber && (
                    <div>
                      <p className="text-muted-foreground text-xs">{patient.governmentIdType === "PASSPORT" ? "Passport" : "ID Number"}</p>
                      <p className="font-medium">{patient.governmentIdNumber}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Profile data unavailable.</p>
              )}
            </CardContent>
          </Card>

          {/* Clinic card */}
          <Card data-testid="card-clinic-info">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Your Clinic
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {clinic ? (
                <div className="space-y-2">
                  <p className="font-semibold text-base" data-testid="text-clinic-name">{clinic.name}</p>
                  {clinic.address && <p className="text-muted-foreground">{clinic.address}</p>}
                  {clinic.contactNumber && <p className="text-muted-foreground">{clinic.contactNumber}</p>}
                  {clinic.email && <p className="text-muted-foreground">{clinic.email}</p>}
                </div>
              ) : (
                <p className="text-muted-foreground">Loading clinic...</p>
              )}
            </CardContent>
          </Card>

          {/* Next appointment */}
          <Card className="lg:col-span-2" data-testid="card-next-appointment">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Next Appointment
              </CardTitle>
              <Link href="/appointments" className="text-xs text-primary hover:underline flex items-center gap-0.5" data-testid="link-all-appointments">
                View all <ChevronRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {apptLoading ? (
                <div className="h-12 bg-muted rounded animate-pulse" />
              ) : nextAppt ? (
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm capitalize" data-testid="text-next-appt-type">{(nextAppt.type ?? "consultation").replace(/_/g, " ")} consultation</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {nextAppt.scheduledAt ? format(new Date(nextAppt.scheduledAt), "EEE, d MMM yyyy — HH:mm") : "—"}
                      </span>
                      {nextAppt.doctorName && <span>Dr. {nextAppt.doctorName}</span>}
                    </div>
                  </div>
                  <StatusBadge status={nextAppt.status ?? "scheduled"} />
                </div>
              ) : (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Calendar className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No upcoming appointments scheduled.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick links */}
          <Card data-testid="card-quick-links">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {[
                { href: "/prescriptions", label: "Prescriptions", icon: Pill },
                { href: "/lab-results", label: "Lab Results", icon: Activity },
                { href: "/invoices", label: "Invoices", icon: Calendar },
              ].map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors text-sm"
                  data-testid={`link-quick-${label.toLowerCase().replace(/ /g, "-")}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    {label}
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
