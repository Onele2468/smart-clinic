import Layout from "@/components/Layout";
import { useGetPatientPortalEmr, getGetPatientPortalEmrQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Pill, FlaskConical, Calendar, Activity, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type TimelineItem = {
  id: string;
  date: string;
  type: "consultation" | "prescription" | "lab" | "appointment" | "assessment";
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: string;
  badgeColor?: string;
};

const TYPE_CONFIG = {
  consultation: { icon: FileText, color: "bg-primary/10 text-primary", label: "Consultation" },
  prescription:  { icon: Pill, color: "bg-secondary text-secondary-foreground", label: "Prescription" },
  lab:           { icon: FlaskConical, color: "bg-blue-100 text-blue-700", label: "Lab Test" },
  appointment:   { icon: Calendar, color: "bg-purple-100 text-purple-700", label: "Appointment" },
  assessment:    { icon: Activity, color: "bg-amber-100 text-amber-700", label: "Assessment" },
};

export default function MedicalRecordsPage() {
  const { data: emr, isLoading, isError } = useGetPatientPortalEmr({
    query: { queryKey: getGetPatientPortalEmrQueryKey() },
  });

  const buildTimeline = (): TimelineItem[] => {
    if (!emr) return [];
    const items: TimelineItem[] = [];

    (emr.consultations ?? []).forEach((c: any) => {
      items.push({
        id: `c-${c.id}`,
        date: c.createdAt,
        type: "consultation",
        title: c.diagnosis ? `Diagnosis: ${c.diagnosis}` : (c.chiefComplaint ?? "Consultation"),
        subtitle: c.treatmentPlan ?? undefined,
        meta: c.doctorName ? `Dr. ${c.doctorName}` : undefined,
        badge: c.status,
      });
    });

    (emr.prescriptions ?? []).forEach((rx: any) => {
      items.push({
        id: `rx-${rx.id}`,
        date: rx.createdAt,
        type: "prescription",
        title: rx.medicationName,
        subtitle: `${rx.dosage} — ${rx.frequency} for ${rx.duration}`,
        badge: rx.status,
      });
    });

    (emr.labRequests ?? []).forEach((lr: any) => {
      items.push({
        id: `lr-${lr.id}`,
        date: lr.createdAt,
        type: "lab",
        title: lr.testName,
        subtitle: lr.testCategory ? `${lr.testCategory} test` : undefined,
        badge: lr.status,
      });
    });

    (emr.appointments ?? []).forEach((a: any) => {
      items.push({
        id: `a-${a.id}`,
        date: a.scheduledAt ?? a.createdAt,
        type: "appointment",
        title: `${(a.type ?? "consultation").replace(/_/g, " ")} appointment`,
        subtitle: a.visitReason ?? undefined,
        badge: a.status,
      });
    });

    (emr.assessments ?? []).forEach((n: any) => {
      const vitals = [
        n.bloodPressure && `BP: ${n.bloodPressure}`,
        n.temperature && `Temp: ${n.temperature}`,
        n.pulseRate && `Pulse: ${n.pulseRate}`,
        n.weight && `Weight: ${n.weight}`,
      ].filter(Boolean).join(" · ");
      items.push({
        id: `na-${n.id}`,
        date: n.createdAt,
        type: "assessment",
        title: "Nurse Assessment",
        subtitle: vitals || n.triageNotes || undefined,
        badge: n.triageLevel ?? undefined,
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const timeline = buildTimeline();

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-foreground">Medical Records</h1>
          <p className="text-muted-foreground mt-0.5">Your complete care timeline, in one place.</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to load medical records. Please refresh.
          </div>
        )}

        {!isLoading && !isError && timeline.length > 0 && (
          <div className="relative" data-testid="timeline-emr">
            {/* Timeline line */}
            <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4 pl-14">
              {timeline.map((item) => {
                const config = TYPE_CONFIG[item.type];
                const Icon = config.icon;
                return (
                  <div key={item.id} className="relative" data-testid={`timeline-item-${item.id}`}>
                    {/* Dot */}
                    <div className={cn("absolute -left-9 w-8 h-8 rounded-full flex items-center justify-center", config.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <Card className="shadow-none">
                      <CardContent className="p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
                              {item.badge && (
                                <span className="px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground capitalize">
                                  {item.badge.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                            <p className="font-medium text-sm mt-0.5 capitalize" data-testid={`text-timeline-title-${item.id}`}>{item.title}</p>
                            {item.subtitle && <p className="text-xs text-muted-foreground mt-0.5">{item.subtitle}</p>}
                            {item.meta && <p className="text-xs text-muted-foreground mt-0.5">{item.meta}</p>}
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                            {format(new Date(item.date), "d MMM yy")}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && !isError && timeline.length === 0 && (
          <div className="text-center py-16 text-muted-foreground" data-testid="empty-records">
            <FileText className="w-12 h-12 mx-auto opacity-20 mb-3" />
            <p className="font-medium">No records yet</p>
            <p className="text-sm mt-1">Your medical history will appear here after clinic visits.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
