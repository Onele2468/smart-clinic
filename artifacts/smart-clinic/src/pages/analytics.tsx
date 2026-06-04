import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinicModules } from "@/hooks/useClinicModules";
import {
  useGetAnalyticsOverview,
  useGetQueuePerformance,
  useGetStaffPerformance,
  getGetAnalyticsOverviewQueryKey,
  getGetQueuePerformanceQueryKey,
  getGetStaffPerformanceQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Users, UserPlus, CheckCircle2, Clock, Stethoscope, Activity,
  TrendingUp, DollarSign, AlertCircle, BarChart2, Pill, FlaskConical,
  Receipt, Package, CalendarCheck, Timer, UserCheck, Layers,
} from "lucide-react";

// ── Colour palette ────────────────────────────────────────────────────────────
const CHART_BLUE    = "#3b82f6";
const CHART_GREEN   = "#22c55e";
const CHART_AMBER   = "#f59e0b";
const CHART_VIOLET  = "#8b5cf6";
const CHART_ROSE    = "#f43f5e";
const STAGE_COLORS  = [CHART_AMBER, CHART_BLUE, CHART_VIOLET];
const MODULE_ICON: Record<string, React.ElementType> = {
  pharmacy: Pill,
  laboratory: FlaskConical,
  billing: Receipt,
  inventory: Package,
  queue: Layers,
  patients: Users,
  appointments: CalendarCheck,
  staff: UserCheck,
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function fmtMin(mins: number) {
  if (!mins || mins <= 0) return "—";
  if (mins < 60) return `${mins.toFixed(0)} min`;
  return `${(mins / 60).toFixed(1)} hr`;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function shortDay(dateStr: string) {
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
  } catch { return dateStr; }
}

function hourLabel(h: number) {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, color = "blue", loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color?: "blue" | "green" | "amber" | "violet" | "rose";
  loading?: boolean;
}) {
  const colorMap = {
    blue:   "bg-blue-50 text-blue-600",
    green:  "bg-green-50 text-green-600",
    amber:  "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose:   "bg-rose-50 text-rose-600",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-muted-foreground mb-1 truncate">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <p className="text-2xl font-bold text-foreground">{value}</p>
            )}
            {sub && !loading && (
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            )}
          </div>
          <div className={`p-2.5 rounded-lg flex-shrink-0 ${colorMap[color]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 rounded-lg bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { clinicMembership } = useAuth();
  const { hasBilling } = useClinicModules();
  const clinicId = clinicMembership?.clinicId ?? "";

  const [staffTab, setStaffTab] = useState<"doctors" | "nurses">("doctors");

  const { data: overview, isLoading: ovLoading } = useGetAnalyticsOverview(clinicId, {
    query: { queryKey: getGetAnalyticsOverviewQueryKey(clinicId), enabled: !!clinicId },
  });

  const { data: queuePerf, isLoading: qpLoading } = useGetQueuePerformance(clinicId, {
    query: { queryKey: getGetQueuePerformanceQueryKey(clinicId), enabled: !!clinicId },
  });

  const { data: staffPerf, isLoading: spLoading } = useGetStaffPerformance(clinicId, {
    query: { queryKey: getGetStaffPerformanceQueryKey(clinicId), enabled: !!clinicId },
  });

  const completionRate = overview?.completionRate ?? 0;
  const doctors = staffPerf?.doctors ?? [];
  const nurses = staffPerf?.nurses ?? [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clinic Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Operational performance overview — today + last 7 days
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1.5 px-3 py-1.5">
          <BarChart2 className="h-3.5 w-3.5" />
          Admin only
        </Badge>
      </div>

      {/* ── Section 1: Patient & Queue Overview ─────────────────────────────── */}
      <section>
        <SectionHeading icon={Users} title="Patient Overview" description="Registrations and queue activity for today" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Patients"
            value={ovLoading ? "…" : (overview?.totalPatients ?? 0).toLocaleString()}
            icon={Users}
            color="blue"
            loading={ovLoading}
          />
          <StatCard
            label="New Today"
            value={ovLoading ? "…" : overview?.newPatientsToday ?? 0}
            sub={`${overview?.newPatientsThisWeek ?? 0} this week`}
            icon={UserPlus}
            color="green"
            loading={ovLoading}
          />
          <StatCard
            label="Queue Today"
            value={ovLoading ? "…" : overview?.queueTotalToday ?? 0}
            sub={`${overview?.queueCompletedToday ?? 0} completed`}
            icon={Activity}
            color="violet"
            loading={ovLoading}
          />
          <StatCard
            label="Completion Rate"
            value={ovLoading ? "…" : `${completionRate}%`}
            sub="Queue completed today"
            icon={CheckCircle2}
            color={completionRate >= 80 ? "green" : completionRate >= 50 ? "amber" : "rose"}
            loading={ovLoading}
          />
        </div>
      </section>

      {/* ── Section 2: Appointments ──────────────────────────────────────────── */}
      <section>
        <SectionHeading icon={CalendarCheck} title="Appointments Today" />
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Scheduled"
            value={ovLoading ? "…" : overview?.appointmentsToday ?? 0}
            icon={CalendarCheck}
            color="blue"
            loading={ovLoading}
          />
          <StatCard
            label="Completed / Checked-in"
            value={ovLoading ? "…" : overview?.appointmentsCompleted ?? 0}
            sub={overview ? `${Math.round(((overview.appointmentsCompleted ?? 0) / Math.max(overview.appointmentsToday ?? 1, 1)) * 100)}% attendance rate` : ""}
            icon={CheckCircle2}
            color="green"
            loading={ovLoading}
          />
        </div>
      </section>

      {/* ── Section 3: Queue Performance ─────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Timer} title="Queue Performance" description="Average stage times — completed patients last 7 days" />

        {/* Timing cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            label="Avg Wait Time"
            value={qpLoading ? "…" : fmtMin(queuePerf?.avgWaitMinutes ?? 0)}
            sub="Arrival → first seen"
            icon={Clock}
            color="amber"
            loading={qpLoading}
          />
          <StatCard
            label="Avg Nurse Assessment"
            value={qpLoading ? "…" : fmtMin(queuePerf?.avgNurseMinutes ?? 0)}
            sub="Nurse stage duration"
            icon={UserCheck}
            color="blue"
            loading={qpLoading}
          />
          <StatCard
            label="Avg Consultation"
            value={qpLoading ? "…" : fmtMin(queuePerf?.avgDoctorMinutes ?? 0)}
            sub="Doctor stage duration"
            icon={Stethoscope}
            color="violet"
            loading={qpLoading}
          />
          <StatCard
            label="Avg Total Visit"
            value={qpLoading ? "…" : fmtMin(queuePerf?.avgTotalMinutes ?? 0)}
            sub={`${queuePerf?.totalCompleted7d ?? 0} completed · ${queuePerf?.completionRate7d ?? 0}% rate`}
            icon={TrendingUp}
            color="green"
            loading={qpLoading}
          />
        </div>

        {/* Stage breakdown bar + Daily trend area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stage breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stage Duration Breakdown</CardTitle>
              <CardDescription className="text-xs">Average minutes per stage (7-day)</CardDescription>
            </CardHeader>
            <CardContent>
              {qpLoading ? (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : !queuePerf?.stageBreakdown?.length ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">No completed queue data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={queuePerf.stageBreakdown} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}m`} />
                    <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} width={130} />
                    <Tooltip formatter={(v: number) => [`${v} min`, "Avg time"]} />
                    <Bar dataKey="avgMinutes" radius={[0, 4, 4, 0]}>
                      {queuePerf.stageBreakdown.map((_, i) => (
                        <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Daily completion trend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Daily Queue Volume (7 days)</CardTitle>
              <CardDescription className="text-xs">Total registered vs completed</CardDescription>
            </CardHeader>
            <CardContent>
              {qpLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : !queuePerf?.dailyTrend?.length ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm">No queue data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={queuePerf.dailyTrend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradDone" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={shortDay} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip labelFormatter={shortDay} />
                    <Area type="monotone" dataKey="count" name="Total" stroke={CHART_BLUE} fill="url(#gradTotal)" strokeWidth={2} dot={false} />
                    <Area type="monotone" dataKey="completed" name="Completed" stroke={CHART_GREEN} fill="url(#gradDone)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── Section 4: Peak Activity Hours ────────────────────────────────────── */}
      <section>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Peak Activity Hours</CardTitle>
                <CardDescription className="text-xs">System activity by hour of day — last 7 days</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {qpLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !queuePerf?.peakHours?.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">No activity data yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={queuePerf.peakHours} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickFormatter={hourLabel} interval={2} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip labelFormatter={(h: number) => `${hourLabel(h)} – ${hourLabel(h + 1)}`} formatter={(v: number) => [v, "Actions"]} />
                  <Bar dataKey="count" fill={CHART_VIOLET} radius={[3, 3, 0, 0]} name="Actions" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 5: Staff Performance ──────────────────────────────────────── */}
      <section>
        <SectionHeading icon={Stethoscope} title="Staff Performance" description="Individual metrics — last 7 days" />
        <Card>
          <CardContent className="pt-4">
            <Tabs value={staffTab} onValueChange={(v) => setStaffTab(v as "doctors" | "nurses")}>
              <TabsList className="mb-4">
                <TabsTrigger value="doctors">Doctors ({doctors.length})</TabsTrigger>
                <TabsTrigger value="nurses">Nurses ({nurses.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="doctors">
                {spLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !doctors.length ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <Stethoscope className="h-6 w-6" />
                    <p className="text-sm">No active doctors found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Doctor</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Consultations</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Prescriptions</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Lab Requests</th>
                          <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Total Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctors.map((d, i) => {
                          const total = d.consultations7d + d.prescriptions7d + d.labRequests7d;
                          return (
                            <tr key={d.userId} className={`border-b last:border-0 ${i === 0 ? "bg-green-50/50" : ""}`}>
                              <td className="py-3 pr-4">
                                <div className="flex items-center gap-2">
                                  {i === 0 && <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200">Top</Badge>}
                                  <div>
                                    <p className="font-medium text-foreground">{d.name}</p>
                                    {d.staffCode && <p className="text-xs text-muted-foreground">{d.staffCode}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="text-right py-3 px-3 font-semibold">{d.consultations7d}</td>
                              <td className="text-right py-3 px-3 text-muted-foreground">{d.prescriptions7d}</td>
                              <td className="text-right py-3 px-3 text-muted-foreground">{d.labRequests7d}</td>
                              <td className="text-right py-3 pl-3">
                                <Badge variant="outline">{total}</Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="nurses">
                {spLoading ? (
                  <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : !nurses.length ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                    <UserCheck className="h-6 w-6" />
                    <p className="text-sm">No active nurses found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Nurse</th>
                          <th className="text-right py-2 px-3 font-medium text-muted-foreground">Assessments Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {nurses.map((n, i) => (
                          <tr key={n.userId} className={`border-b last:border-0 ${i === 0 ? "bg-blue-50/50" : ""}`}>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                {i === 0 && n.assessments7d > 0 && <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">Top</Badge>}
                                <div>
                                  <p className="font-medium text-foreground">{n.name}</p>
                                  {n.staffCode && <p className="text-xs text-muted-foreground">{n.staffCode}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="text-right py-3 px-3 font-semibold">{n.assessments7d}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </section>

      {/* ── Section 6: Module Activity ────────────────────────────────────────── */}
      <section>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-muted">
                <Layers className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">Module Activity</CardTitle>
                <CardDescription className="text-xs">Staff actions per module — last 30 days</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ovLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !overview?.moduleActivity?.length ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                <Activity className="h-5 w-5" />
                <p className="text-sm">No module activity recorded yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                {/* Bar chart */}
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={overview.moduleActivity}
                    layout="vertical"
                    margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="module" tick={{ fontSize: 11 }} width={90} />
                    <Tooltip formatter={(v: number) => [v.toLocaleString(), "Actions"]} />
                    <Bar dataKey="count" fill={CHART_BLUE} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Module list */}
                <div className="space-y-2">
                  {overview.moduleActivity.map((m, i) => {
                    const Icon = MODULE_ICON[m.module] ?? Activity;
                    const maxCount = overview.moduleActivity[0]?.count ?? 1;
                    const pct = Math.round((m.count / maxCount) * 100);
                    return (
                      <div key={m.module} className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-muted flex-shrink-0">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="text-xs font-medium capitalize">{m.module}</span>
                            <span className="text-xs text-muted-foreground">{m.count.toLocaleString()}</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        {i === 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 flex-shrink-0">Most used</Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Section 7: Revenue (billing clinics only) ─────────────────────────── */}
      {hasBilling && (
        <section>
          <SectionHeading
            icon={DollarSign}
            title="Revenue Summary"
            description="Payments collected — this week and this month"
          />
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Revenue This Week"
              value={ovLoading ? "…" : fmtCurrency(overview?.revenueThisWeek ?? 0)}
              icon={DollarSign}
              color="green"
              loading={ovLoading}
            />
            <StatCard
              label="Revenue This Month"
              value={ovLoading ? "…" : fmtCurrency(overview?.revenueThisMonth ?? 0)}
              icon={TrendingUp}
              color="blue"
              loading={ovLoading}
            />
          </div>
        </section>
      )}
    </div>
  );
}
