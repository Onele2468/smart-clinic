import Layout from "@/components/Layout";
import {
  useGetPatientPortalQueueStatus,
  getGetPatientPortalQueueStatusQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  CheckCircle2,
  Circle,
  Clock,
  RefreshCw,
  Ticket,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const QUEUE_STAGES = [
  { key: "waiting", label: "Check-in" },
  { key: "nurse_assessment", label: "Nurse" },
  { key: "doctor_consultation", label: "Doctor" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "lab", label: "Lab" },
];

const STATUS_LABELS: Record<string, string> = {
  waiting: "Waiting",
  called: "Being Called",
  nurse_assessment: "With Nurse",
  doctor_consultation: "In Consultation",
  pharmacy: "At Pharmacy",
  lab: "At Lab",
  completed: "Visit Complete",
  skipped: "Skipped",
};

const CARD_COLORS: Record<string, string> = {
  waiting: "border-amber-200 bg-amber-50/40",
  called: "border-purple-200 bg-purple-50/40",
  nurse_assessment: "border-cyan-200 bg-cyan-50/40",
  doctor_consultation: "border-indigo-200 bg-indigo-50/40",
  pharmacy: "border-violet-200 bg-violet-50/40",
  lab: "border-orange-200 bg-orange-50/40",
};

const BADGE_COLORS: Record<string, string> = {
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
  called: "bg-purple-100 text-purple-800 border-purple-200",
  nurse_assessment: "bg-cyan-100 text-cyan-800 border-cyan-200",
  doctor_consultation: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pharmacy: "bg-violet-100 text-violet-800 border-violet-200",
  lab: "bg-orange-100 text-orange-800 border-orange-200",
};

const DOT_COLORS: Record<string, string> = {
  waiting: "bg-amber-500",
  called: "bg-purple-500",
  nurse_assessment: "bg-cyan-500",
  doctor_consultation: "bg-indigo-500",
  pharmacy: "bg-violet-500",
  lab: "bg-orange-500",
};

function QueueProgressBar({ status }: { status: string }) {
  const isCompleted = status === "completed";
  const currentIdx = QUEUE_STAGES.findIndex((s) => s.key === status);
  return (
    <div className="flex items-center gap-0 mt-5">
      {QUEUE_STAGES.map((stage, i) => {
        const done = isCompleted || i < currentIdx;
        const active = !isCompleted && i === currentIdx;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                  done
                    ? "bg-primary border-primary text-primary-foreground"
                    : active
                    ? "bg-primary/20 border-primary text-primary animate-pulse"
                    : "bg-muted border-border text-muted-foreground"
                )}
              >
                {done ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Circle className="w-3 h-3" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-none text-center font-medium",
                  active
                    ? "text-primary"
                    : done
                    ? "text-primary/70"
                    : "text-muted-foreground"
                )}
              >
                {stage.label}
              </span>
            </div>
            {i < QUEUE_STAGES.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-full mb-5 mx-0.5",
                  done ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function QueuePage() {
  const {
    data: qs,
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useGetPatientPortalQueueStatus({
    query: {
      queryKey: getGetPatientPortalQueueStatusQueryKey(),
      refetchInterval: 15_000,
    },
  });

  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    if (!dataUpdatedAt) return;
    const update = () =>
      setSecondsAgo(Math.floor((Date.now() - dataUpdatedAt) / 1000));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  const status = qs?.status as string | null;
  const inQueue = qs?.inQueue;
  const ticketNumber = (qs as any)?.ticketNumber as string | null;
  const currentlyServing = (qs as any)?.currentlyServing as string | null;
  const aheadCount = (qs as any)?.aheadCount as number | null;
  const completedAt = (qs as any)?.completedAt as string | null;
  const isActive =
    inQueue &&
    status &&
    status !== "completed" &&
    status !== "skipped";

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Live Queue</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Your real-time queue status
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border hover:bg-muted"
            data-testid="button-refresh-queue"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5", isFetching && "animate-spin")}
            />
            Refresh
          </button>
        </div>

        {/* Loading skeleton */}
        {isLoading && !qs ? (
          <div className="space-y-3">
            <div className="h-48 bg-muted rounded-xl animate-pulse" />
            <div className="h-16 bg-muted rounded-xl animate-pulse" />
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
          </div>
        ) : !status ? (
          /* ── Not in queue today ── */
          <Card data-testid="queue-not-in-queue">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Ticket className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <h3 className="font-semibold text-lg">Not in Queue</h3>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                You are not registered in today's queue. Please check in at the
                reception desk when you arrive.
              </p>
            </CardContent>
          </Card>
        ) : status === "completed" || status === "skipped" ? (
          /* ── Completed / done ── */
          <Card
            className="border-green-200 bg-green-50/30"
            data-testid="queue-completed"
          >
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-9 h-9 text-green-600" />
              </div>
              <h3 className="font-semibold text-xl text-green-800">
                {status === "completed" ? "Visit Complete" : "Visit Skipped"}
              </h3>
              <p className="text-green-700 text-sm mt-1">
                {status === "completed"
                  ? "Your visit today has been completed. Thank you!"
                  : "Your queue slot was skipped today."}
              </p>
              {ticketNumber && (
                <div className="mt-5 inline-block bg-white border border-green-200 rounded-xl px-8 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Ticket
                  </p>
                  <p
                    className="font-mono font-bold text-3xl text-foreground"
                    data-testid="text-ticket-number"
                  >
                    {ticketNumber}
                  </p>
                </div>
              )}
              {completedAt && (
                <p className="text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Completed at {format(new Date(completedAt), "h:mm a")}
                </p>
              )}
              {qs?.enteredAt && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  Checked in at {format(new Date(qs.enteredAt), "h:mm a")}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          /* ── Active in queue ── */
          <>
            {/* Main ticket card */}
            <Card
              className={cn(
                "mb-4 border-2",
                CARD_COLORS[status] ?? "border-primary/20 bg-primary/5"
              )}
              data-testid="queue-active-card"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: ticket + status badge */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                      Your Ticket
                    </p>
                    <p
                      className={cn(
                        "font-mono font-bold text-6xl leading-none",
                        ["called", "nurse_assessment", "doctor_consultation"].includes(status)
                          ? "animate-pulse"
                          : ""
                      )}
                      data-testid="text-ticket-number"
                    >
                      {ticketNumber ?? "—"}
                    </p>
                    <div className="mt-3">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border",
                          BADGE_COLORS[status] ?? "bg-muted text-muted-foreground border-border"
                        )}
                        data-testid="text-queue-status"
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full animate-pulse",
                            DOT_COLORS[status] ?? "bg-primary"
                          )}
                        />
                        {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Right: ahead + wait */}
                  {status === "waiting" && (
                    <div className="text-right space-y-4 shrink-0">
                      {aheadCount !== null && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                            Ahead of you
                          </p>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span
                              className="font-bold text-3xl"
                              data-testid="text-ahead-count"
                            >
                              {aheadCount}
                            </span>
                          </div>
                          {aheadCount === 0 && (
                            <p className="text-xs font-medium text-primary mt-0.5">
                              You're next!
                            </p>
                          )}
                        </div>
                      )}
                      {qs?.estimatedWaitMinutes != null && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                            Est. wait
                          </p>
                          <div className="flex items-center justify-end gap-1.5 mt-0.5">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-bold text-3xl">
                              {qs.estimatedWaitMinutes}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              min
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <QueueProgressBar status={status} />
              </CardContent>
            </Card>

            {/* Now serving */}
            {currentlyServing && (
              <Card className="mb-4">
                <CardContent className="py-4 px-5 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                      Now Serving
                    </p>
                    <p
                      className="font-mono font-bold text-2xl leading-tight"
                      data-testid="text-now-serving"
                    >
                      {currentlyServing}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Check-in time */}
            {qs?.enteredAt && (
              <Card>
                <CardContent className="py-3 px-5 flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Checked in{" "}
                    {formatDistanceToNow(new Date(qs.enteredAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <span>{format(new Date(qs.enteredAt), "h:mm a")}</span>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Footer: last updated */}
        <div className="mt-5 text-center">
          <p className="text-xs text-muted-foreground">
            {secondsAgo <= 3
              ? "Just updated"
              : `Updated ${secondsAgo}s ago`}{" "}
            · Auto-refreshes every 15s
          </p>
        </div>
      </div>
    </Layout>
  );
}
