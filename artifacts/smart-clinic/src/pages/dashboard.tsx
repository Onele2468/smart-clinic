import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClinicModules } from "@/hooks/useClinicModules";
import {
  useGetDashboardStats,
  useGetQueueTrends,
  useGetRecentActivity,
  useGetLiveQueue,
  useListAppointments,
  useListInvoices,
  useListInventoryItems,
  getGetDashboardStatsQueryKey,
  getGetQueueTrendsQueryKey,
  getGetRecentActivityQueryKey,
  getGetLiveQueueQueryKey,
  getListAppointmentsQueryKey,
  getListInvoicesQueryKey,
  getListInventoryItemsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Users, Calendar, Clock, CheckCircle2, AlertCircle,
  Stethoscope, UserCheck, ListTodo, ArrowRight, Pill, FlaskConical,
  Receipt, Package, TrendingUp, AlertTriangle, DollarSign,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

function StatCard({
  title, value, icon: Icon, description, color = "default", alert,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  color?: "default" | "blue" | "green" | "amber" | "red" | "violet" | "orange";
  alert?: boolean;
}) {
  const colorMap: Record<string, string> = {
    default: "text-muted-foreground",
    blue: "text-blue-500",
    green: "text-green-500",
    amber: "text-amber-500",
    red: "text-red-500",
    violet: "text-violet-500",
    orange: "text-orange-500",
  };
  return (
    <Card className={alert ? "border-amber-300 bg-amber-50/30" : undefined}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${colorMap[color]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard() {
  const { clinicMembership } = useAuth();
  const modules = useClinicModules();
  const clinicId = clinicMembership?.clinicId || "";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardStatsQueryKey(clinicId) },
  });
  const { data: trends, isLoading: trendsLoading } = useGetQueueTrends(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetQueueTrendsQueryKey(clinicId) },
  });
  const { data: activities, isLoading: activitiesLoading } = useGetRecentActivity(clinicId, { limit: 8 }, {
    query: { enabled: !!clinicId, queryKey: getGetRecentActivityQueryKey(clinicId, { limit: 8 }) },
  });

  const fmtCurrency = (n?: number) =>
    n == null ? "—" : `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {clinicMembership?.clinicName} — {format(new Date(), "EEEE, MMMM d yyyy")}
        </p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, modules.hasBilling ? 5 : null, modules.hasBilling ? 6 : null, modules.hasLaboratory ? 7 : null, modules.hasPharmacy ? 8 : null].filter(Boolean).map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <>
          {/* Core KPIs — always visible */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Patients" value={stats?.totalPatients ?? 0} icon={Users} color="blue" />
            <StatCard title="Active Queue" value={stats?.activeQueue ?? 0} icon={ListTodo} description="Waiting or in progress" color="amber" />
            <StatCard title="Appointments Today" value={stats?.appointmentsToday ?? 0} icon={Calendar} color="default" />
            <StatCard title="Completed Today" value={stats?.completedToday ?? 0} icon={CheckCircle2} color="green" />
          </div>

          {/* Financial & Operational KPIs — private/NGO clinics only */}
          {modules.hasBilling ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Revenue Today" value={fmtCurrency(stats?.revenueToday)} icon={DollarSign} color="green" />
              <StatCard title="Monthly Revenue" value={fmtCurrency(stats?.monthlyRevenue)} icon={TrendingUp} color="blue" />
              <StatCard
                title="Pending Invoices"
                value={stats?.pendingInvoices ?? 0}
                icon={Receipt}
                color={stats?.pendingInvoices ? "amber" : "default"}
                description="Unpaid or partial"
                alert={!!stats?.pendingInvoices}
              />
              <StatCard title="Pending Join Requests" value={stats?.pendingJoinRequests ?? 0} icon={AlertCircle} color={stats?.pendingJoinRequests ? "amber" : "default"} description="Awaiting approval" />
            </div>
          ) : (
            /* Government: show only queue + join requests in this row */
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard title="Avg Wait Time" value={`${stats?.avgWaitMinutes ?? 0} min`} icon={Clock} />
              <StatCard title="Pending Join Requests" value={stats?.pendingJoinRequests ?? 0} icon={AlertCircle} color={stats?.pendingJoinRequests ? "amber" : "default"} description="Awaiting approval" />
            </div>
          )}

          {/* Clinical KPIs — filtered per module */}
          {modules.hasBilling && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Avg Wait Time" value={`${stats?.avgWaitMinutes ?? 0} min`} icon={Clock} />
              {modules.hasLaboratory && <StatCard title="Pending Lab Requests" value={stats?.pendingLabRequests ?? 0} icon={FlaskConical} color="orange" />}
              {modules.hasPharmacy && <StatCard title="Active Prescriptions" value={stats?.pendingPrescriptions ?? 0} icon={Pill} color="violet" />}
              {modules.hasInventory && (
                <StatCard
                  title="Low Stock Items"
                  value={stats?.lowStockItems ?? 0}
                  icon={AlertTriangle}
                  color={stats?.lowStockItems ? "red" : "green"}
                  description={stats?.lowStockItems ? "Needs restocking" : "Stock levels OK"}
                  alert={!!stats?.lowStockItems}
                />
              )}
            </div>
          )}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-7">
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="text-base">Queue Trend — Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {trendsLoading ? <Skeleton className="w-full h-full" /> : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tickFormatter={v => format(new Date(v + "T12:00:00"), "MMM d")} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: 12 }} labelFormatter={v => format(new Date(v + "T12:00:00"), "MMM d, yyyy")} />
                  <Area type="monotone" dataKey="count" name="Total" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="hsl(var(--chart-2))" fillOpacity={1} fill="url(#colorCompleted)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/activity">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : !activities?.length ? (
              <p className="text-center text-muted-foreground text-sm py-6">No recent activity.</p>
            ) : (
              <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                {activities.map(item => (
                  <div key={item.id} className="text-sm border-b pb-3 last:border-0 last:pb-0">
                    <p className="font-medium leading-snug">{item.message}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(item.createdAt), "MMM d, h:mm a")}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Doctor Dashboard ──────────────────────────────────────────────────────────
function DoctorDashboard() {
  const { clinicMembership, user } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: queue, isLoading: queueLoading } = useGetLiveQueue(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetLiveQueueQueryKey(clinicId), refetchInterval: 30000 },
  });
  const { data: appointments, isLoading: apptLoading } = useListAppointments(clinicId, { date: todayStr }, {
    query: { enabled: !!clinicId, queryKey: getListAppointmentsQueryKey(clinicId, { date: todayStr }) },
  });

  const myAppts = appointments?.filter(a => a.doctorId === user?.id) ?? [];
  const doctorQueue = queue?.entries.filter(e => e.status === "doctor_consultation") ?? [];
  const waitingCount = queue?.entries.filter(e => e.status === "waiting" || e.status === "nurse_assessment").length ?? 0;
  const checkedInAppts = myAppts.filter(a => a.status === "checked_in");
  const completedToday = myAppts.filter(a => a.status === "completed").length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Doctor Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome, Dr. {user?.name} — {format(new Date(), "EEEE, MMMM d yyyy")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Appointments" value={myAppts.length} icon={Calendar} color="blue" description="Today" />
        <StatCard title="In Consultation" value={doctorQueue.length} icon={Stethoscope} color="green" description="Currently with doctor" />
        <StatCard title="Checked In" value={checkedInAppts.length} icon={CheckCircle2} color="amber" description="Ready for consultation" />
        <StatCard title="Completed Today" value={completedToday} icon={UserCheck} color="default" />
      </div>

      {checkedInAppts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <CheckCircle2 className="w-4 h-4" /> Patients Ready for Consultation
            </CardTitle>
            <CardDescription>These patients have checked in — start their consultation now.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {checkedInAppts.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                  <div>
                    <p className="font-semibold text-sm">{a.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.scheduledAt), "h:mm a")} · {a.type?.replace("_", " ")}
                      {a.visitReason && ` · "${a.visitReason}"`}
                    </p>
                  </div>
                  <Button size="sm" className="h-8" asChild>
                    <Link href={`/consultations/${a.patientId}?appointmentId=${a.id}`}>
                      <Stethoscope className="w-3.5 h-3.5 mr-1.5" /> Start Consultation
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Consultation Queue</CardTitle>
              <CardDescription>Patients currently in your consultation</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild><Link href="/queue"><ArrowRight className="w-4 h-4" /></Link></Button>
          </CardHeader>
          <CardContent>
            {queueLoading ? <Skeleton className="h-32 w-full" /> : !doctorQueue.length ? (
              <p className="text-muted-foreground text-sm text-center py-6">No active consultations.</p>
            ) : (
              <div className="space-y-3">
                {doctorQueue.map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border bg-green-50/50 dark:bg-green-900/10">
                    <div>
                      <p className="font-semibold text-sm">{e.patientName}</p>
                      <p className="text-xs text-muted-foreground">{e.ticketNumber} · {e.patientCode}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 border-0">In Consultation</Badge>
                      <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                        <Link href={`/consultations/${e.patientId}`}>View</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Today's Appointments</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/appointments">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {apptLoading ? <Skeleton className="h-32 w-full" /> : !myAppts.length ? (
              <p className="text-muted-foreground text-sm text-center py-6">No appointments today.</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {myAppts.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-semibold text-sm">{a.patientName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.scheduledAt), "h:mm a")} · {a.type?.replace("_", " ")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={a.status === "completed" ? "default" : "secondary"} className="capitalize text-xs">
                        {a.status?.replace("_", " ")}
                      </Badge>
                      {a.status === "checked_in" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                          <Link href={`/consultations/${a.patientId}?appointmentId=${a.id}`}>Consult</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Nurse Dashboard ───────────────────────────────────────────────────────────
function NurseDashboard() {
  const { clinicMembership, user } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";

  const { data: queue, isLoading } = useGetLiveQueue(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetLiveQueueQueryKey(clinicId), refetchInterval: 20000 },
  });

  const waiting = queue?.entries.filter(e => e.status === "waiting") ?? [];
  const nurseStage = queue?.entries.filter(e => e.status === "nurse_assessment") ?? [];
  const doctorStage = queue?.entries.filter(e => e.status === "doctor_consultation") ?? [];
  const completedToday = queue?.entries.filter(e => e.status === "completed") ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nurse Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome, {user?.name} — {format(new Date(), "EEEE, MMMM d yyyy")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Waiting" value={waiting.length} icon={Clock} color="amber" />
        <StatCard title="Nurse Assessment" value={nurseStage.length} icon={Activity} color="blue" description="Currently assessing" />
        <StatCard title="With Doctor" value={doctorStage.length} icon={Stethoscope} color="green" />
        <StatCard title="Completed Today" value={completedToday.length} icon={CheckCircle2} color="default" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Live Queue</CardTitle>
            <CardDescription>Patients requiring nurse assessment</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild><Link href="/queue">Full Queue View</Link></Button>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-32 w-full" /> : !waiting.length && !nurseStage.length ? (
            <p className="text-muted-foreground text-sm text-center py-6">No patients waiting.</p>
          ) : (
            <div className="space-y-2">
              {[...nurseStage, ...waiting].slice(0, 8).map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-semibold text-sm">{e.patientName}</p>
                    <p className="text-xs text-muted-foreground">{e.ticketNumber}</p>
                  </div>
                  <Badge className={
                    e.status === "nurse_assessment"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-0"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-0"
                  }>
                    {e.status === "nurse_assessment" ? "Nurse Assessment" : "Waiting"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Receptionist Dashboard ────────────────────────────────────────────────────
function ReceptionistDashboard() {
  const { clinicMembership, user } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";
  const todayStr = new Date().toISOString().split("T")[0];

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardStatsQueryKey(clinicId) },
  });
  const { data: queue, isLoading: queueLoading } = useGetLiveQueue(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetLiveQueueQueryKey(clinicId), refetchInterval: 20000 },
  });
  const { data: appointments } = useListAppointments(clinicId, { date: todayStr }, {
    query: { enabled: !!clinicId, queryKey: getListAppointmentsQueryKey(clinicId, { date: todayStr }) },
  });

  const activeQueue = queue?.entries.filter(e => !["completed", "skipped"].includes(e.status)) ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reception Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome, {user?.name} — {format(new Date(), "EEEE, MMMM d yyyy")}</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Total Patients" value={stats?.totalPatients ?? 0} icon={Users} color="blue" />
          <StatCard title="Queue Now" value={activeQueue.length} icon={ListTodo} color="amber" description="Active patients" />
          <StatCard title="Appointments Today" value={stats?.appointmentsToday ?? 0} icon={Calendar} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active Queue</CardTitle>
            <Button variant="outline" size="sm" asChild><Link href="/queue">Manage Queue</Link></Button>
          </CardHeader>
          <CardContent>
            {queueLoading ? <Skeleton className="h-32 w-full" /> : !activeQueue.length ? (
              <p className="text-muted-foreground text-sm text-center py-6">Queue is empty.</p>
            ) : (
              <div className="space-y-2">
                {activeQueue.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-semibold text-sm">{e.patientName}</p>
                      <p className="text-xs text-muted-foreground">{e.ticketNumber}</p>
                    </div>
                    <Badge variant="secondary" className="capitalize">{e.status.replace("_", " ")}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Today's Appointments</CardTitle>
            <Button variant="outline" size="sm" asChild><Link href="/appointments">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {!appointments?.length ? (
              <p className="text-muted-foreground text-sm text-center py-6">No appointments today.</p>
            ) : (
              <div className="space-y-2">
                {appointments.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-semibold text-sm">{a.patientName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.scheduledAt), "h:mm a")} · Dr. {a.doctorName}</p>
                    </div>
                    <Badge variant="secondary" className="capitalize">{a.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Pharmacist Dashboard ──────────────────────────────────────────────────────
function PharmacistDashboard() {
  const { clinicMembership, user } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardStatsQueryKey(clinicId) },
  });
  const { data: inventory, isLoading: invLoading } = useListInventoryItems(clinicId, undefined, {
    query: { enabled: !!clinicId, queryKey: getListInventoryItemsQueryKey(clinicId) },
  });

  const lowStock = inventory?.filter(i => i.isActive && i.currentStock <= i.minimumStock) ?? [];
  const medications = inventory?.filter(i => i.category === "medication" && i.isActive) ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pharmacy Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome, {user?.name} — {format(new Date(), "EEEE, MMMM d yyyy")}</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard title="Pending Prescriptions" value={stats?.pendingPrescriptions ?? 0} icon={Pill} color="violet" description="Active, awaiting dispensing" />
          <StatCard
            title="Low Stock Items"
            value={stats?.lowStockItems ?? 0}
            icon={AlertTriangle}
            color={stats?.lowStockItems ? "red" : "green"}
            description={stats?.lowStockItems ? "Below minimum stock" : "All items well-stocked"}
            alert={!!stats?.lowStockItems}
          />
          <StatCard title="Medications in Stock" value={medications.length} icon={Package} color="blue" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low stock alert */}
        <Card className={lowStock.length ? "border-red-200" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {lowStock.length > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
                Low Stock Alerts
              </CardTitle>
              <CardDescription>Items at or below minimum stock level</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild><Link href="/inventory">Manage</Link></Button>
          </CardHeader>
          <CardContent>
            {invLoading ? <Skeleton className="h-32 w-full" /> : !lowStock.length ? (
              <p className="text-muted-foreground text-sm text-center py-6">
                All stock levels are adequate.
              </p>
            ) : (
              <div className="space-y-2">
                {lowStock.slice(0, 6).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-red-100 bg-red-50/30">
                    <div>
                      <p className="font-semibold text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-red-600">{item.currentStock}</p>
                      <p className="text-xs text-muted-foreground">min: {item.minimumStock}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common pharmacy tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/pharmacy">
                <Pill className="h-4 w-4 mr-2 text-violet-500" />
                View All Prescriptions
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/inventory">
                <Package className="h-4 w-4 mr-2 text-blue-500" />
                Inventory Management
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/suppliers">
                <TrendingUp className="h-4 w-4 mr-2 text-green-500" />
                Suppliers & Orders
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Lab Technician Dashboard ──────────────────────────────────────────────────
function LabDashboard() {
  const { clinicMembership, user } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardStatsQueryKey(clinicId) },
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Laboratory Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome, {user?.name} — {format(new Date(), "EEEE, MMMM d yyyy")}</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            title="Pending Lab Requests"
            value={stats?.pendingLabRequests ?? 0}
            icon={FlaskConical}
            color="orange"
            description="Awaiting processing or results"
            alert={!!stats?.pendingLabRequests}
          />
          <StatCard title="Patients Today" value={stats?.appointmentsToday ?? 0} icon={Users} color="blue" description="Appointments today" />
          <StatCard title="Completed Today" value={stats?.completedToday ?? 0} icon={CheckCircle2} color="green" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Common lab tasks</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/lab">
                <FlaskConical className="h-4 w-4 mr-2 text-orange-500" />
                View Lab Requests
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/patients">
                <Users className="h-4 w-4 mr-2 text-blue-500" />
                Browse Patients
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Overview</CardTitle>
            <CardDescription>Today's lab workload at a glance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 pt-1">
              {[
                { label: "Pending", value: stats?.pendingLabRequests ?? 0, color: "bg-amber-500" },
                { label: "Appointments Today", value: stats?.appointmentsToday ?? 0, color: "bg-blue-500" },
                { label: "Completed", value: stats?.completedToday ?? 0, color: "bg-green-500" },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${row.color} shrink-0`} />
                  <span className="text-sm flex-1">{row.label}</span>
                  <span className="font-semibold text-sm">{statsLoading ? "…" : row.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Cashier Dashboard ─────────────────────────────────────────────────────────
function CashierDashboard() {
  const { clinicMembership, user } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(clinicId, {
    query: { enabled: !!clinicId, queryKey: getGetDashboardStatsQueryKey(clinicId) },
  });
  const { data: invoices, isLoading: invLoading } = useListInvoices(clinicId, undefined, {
    query: { enabled: !!clinicId, queryKey: getListInvoicesQueryKey(clinicId) },
  });

  const fmtCurrency = (n?: number | null) =>
    n == null ? "R0.00" : `R${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const pendingInvoices = invoices?.filter(i => i.status === "unpaid" || i.status === "partial") ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cashier Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome, {user?.name} — {format(new Date(), "EEEE, MMMM d yyyy")}</p>
      </div>

      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Revenue Today" value={fmtCurrency(stats?.revenueToday)} icon={DollarSign} color="green" />
          <StatCard title="Monthly Revenue" value={fmtCurrency(stats?.monthlyRevenue)} icon={TrendingUp} color="blue" />
          <StatCard
            title="Pending Invoices"
            value={stats?.pendingInvoices ?? 0}
            icon={Receipt}
            color={stats?.pendingInvoices ? "amber" : "green"}
            description="Unpaid or partial"
            alert={!!stats?.pendingInvoices}
          />
          <StatCard title="Patients Today" value={stats?.appointmentsToday ?? 0} icon={Users} color="default" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Pending Payments</CardTitle>
              <CardDescription>Invoices awaiting settlement</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild><Link href="/billing">View All</Link></Button>
          </CardHeader>
          <CardContent>
            {invLoading ? <Skeleton className="h-32 w-full" /> : !pendingInvoices.length ? (
              <p className="text-muted-foreground text-sm text-center py-6">No pending payments.</p>
            ) : (
              <div className="space-y-2">
                {pendingInvoices.slice(0, 6).map(inv => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-semibold text-sm">{inv.patientName}</p>
                      <p className="text-xs text-muted-foreground">{inv.invoiceCode}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <p className="text-sm font-bold">
                          R{parseFloat(inv.balance || "0").toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">balance</p>
                      </div>
                      <Badge className={
                        inv.status === "partial"
                          ? "bg-amber-100 text-amber-800 border-0 text-xs"
                          : "bg-red-100 text-red-800 border-0 text-xs"
                      }>
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
            <CardDescription>Common billing tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/billing">
                <Receipt className="h-4 w-4 mr-2 text-blue-500" />
                Manage Invoices
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
            <Button className="w-full justify-start" variant="outline" asChild>
              <Link href="/patients">
                <Users className="h-4 w-4 mr-2 text-green-500" />
                Browse Patients
                <ArrowRight className="h-4 w-4 ml-auto" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { clinicMembership } = useAuth();
  const role = clinicMembership?.role;

  if (role === "clinic_admin") return <AdminDashboard />;
  if (role === "doctor") return <DoctorDashboard />;
  if (role === "nurse") return <NurseDashboard />;
  if (role === "receptionist") return <ReceptionistDashboard />;
  if (role === "pharmacist") return <PharmacistDashboard />;
  if (role === "lab_technician") return <LabDashboard />;
  if (role === "cashier") return <CashierDashboard />;

  return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center text-muted-foreground">Loading your dashboard...</div>
    </div>
  );
}
