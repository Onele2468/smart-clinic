import { useState } from "react";
import Layout from "@/components/Layout";
import {
  useListPatientPortalAppointments,
  getListPatientPortalAppointmentsQueryKey,
  useCancelPatientPortalAppointment,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, AlertCircle, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  completed: "bg-gray-50 text-gray-600 border-gray-200",
  no_show: "bg-orange-50 text-orange-700 border-orange-200",
};

type Appointment = {
  id: string;
  scheduledAt?: string | null;
  type?: string | null;
  status?: string | null;
  visitReason?: string | null;
  doctorName?: string | null;
  durationMinutes?: number | null;
};

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState("");

  const { data: appointments, isLoading, isError } = useListPatientPortalAppointments(
    {},
    { query: { queryKey: getListPatientPortalAppointmentsQueryKey({}) } }
  );

  const cancelMutation = useCancelPatientPortalAppointment();

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelError("");
    try {
      await cancelMutation.mutateAsync({ appointmentId: cancelTarget });
      await queryClient.invalidateQueries({ queryKey: getListPatientPortalAppointmentsQueryKey({}) });
      setCancelTarget(null);
    } catch (err: any) {
      setCancelError(err?.response?.data?.error ?? err?.message ?? "Could not cancel appointment.");
    }
  };

  const upcoming = appointments?.filter((a) => {
    if (!a.scheduledAt) return false;
    const d = new Date(a.scheduledAt);
    return d >= new Date() && a.status !== "cancelled" && a.status !== "completed";
  }) ?? [];

  const past = appointments?.filter((a) => {
    if (!a.scheduledAt) return true;
    const d = new Date(a.scheduledAt);
    return d < new Date() || a.status === "cancelled" || a.status === "completed";
  }) ?? [];

  const canCancel = (status: string | null | undefined) =>
    status !== "cancelled" && status !== "completed" && status !== "no_show";

  const AppointmentCard = ({ appt, showCancel }: { appt: Appointment; showCancel?: boolean }) => (
    <Card className="hover:shadow-md transition-shadow" data-testid={`card-appointment-${appt.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm capitalize" data-testid={`text-appt-type-${appt.id}`}>
                {(appt.type ?? "consultation").replace(/_/g, " ")} consultation
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {appt.scheduledAt ? format(new Date(appt.scheduledAt), "EEE d MMM yyyy, HH:mm") : "—"}
                </span>
                {appt.doctorName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    Dr. {appt.doctorName}
                  </span>
                )}
                {appt.durationMinutes && (
                  <span>{appt.durationMinutes} min</span>
                )}
              </div>
              {appt.visitReason && (
                <p className="text-xs text-muted-foreground mt-1.5 truncate">{appt.visitReason}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border capitalize",
              STATUS_STYLES[appt.status ?? "scheduled"] ?? "bg-muted text-muted-foreground border-border"
            )}>
              {(appt.status ?? "scheduled").replace(/_/g, " ")}
            </span>
            {showCancel && canCancel(appt.status) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => setCancelTarget(appt.id)}
                data-testid={`button-cancel-appt-${appt.id}`}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
          <p className="text-muted-foreground mt-0.5">Your upcoming and past clinic visits.</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to load appointments. Please refresh.
          </div>
        )}

        {!isLoading && !isError && (
          <>
            {upcoming.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h2>
                <div className="space-y-3" data-testid="list-upcoming-appointments">
                  {upcoming.map((a) => <AppointmentCard key={a.id} appt={a} showCancel />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past & Cancelled</h2>
                <div className="space-y-3" data-testid="list-past-appointments">
                  {past.map((a) => <AppointmentCard key={a.id} appt={a} />)}
                </div>
              </section>
            )}

            {appointments?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground" data-testid="empty-appointments">
                <Calendar className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="font-medium">No appointments yet</p>
                <p className="text-sm mt-1">Your clinic visits will appear here once scheduled.</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your scheduled appointment. You will need to contact the clinic or book a new one if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelError && (
            <p className="text-sm text-destructive px-1">{cancelError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep appointment</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending ? "Cancelling..." : "Yes, cancel it"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
