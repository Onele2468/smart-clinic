import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetActivityLogs, getGetActivityLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ClipboardList, Activity, Calendar, User, CheckCircle2, UserPlus,
  ChevronLeft, ChevronRight, Search, X, FlaskConical, Pill,
  Package, DollarSign, Layers, Filter,
} from "lucide-react";
import { format } from "date-fns";

const ALL = "__all__";

const MODULE_LABELS: Record<string, string> = {
  queue: "Queue",
  billing: "Billing",
  pharmacy: "Pharmacy",
  laboratory: "Laboratory",
  inventory: "Inventory",
  patients: "Patients",
  appointments: "Appointments",
  staff: "Staff",
};

const MODULE_COLORS: Record<string, string> = {
  queue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  billing: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  pharmacy: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  laboratory: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  inventory: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  patients: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  appointments: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  staff: "bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-300",
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  queue: Layers,
  billing: DollarSign,
  pharmacy: Pill,
  laboratory: FlaskConical,
  inventory: Package,
  patients: UserPlus,
  appointments: Calendar,
  staff: User,
};

const ACTION_LABELS: Record<string, string> = {
  queue_added: "Added to Queue",
  queue_stage_changed: "Stage Changed",
  queue_completed: "Completed",
  patient_added: "Patient Registered",
  appointment_booked: "Booked",
  appointment_cancelled: "Cancelled",
  appointment_updated: "Updated",
  invoice_created: "Invoice Created",
  payment_recorded: "Payment Recorded",
  prescription_created: "Prescription",
  lab_request_created: "Lab Request",
  lab_result_submitted: "Lab Result",
  stock_added: "Stock Added",
  stock_adjusted: "Stock Adjusted",
  join_approved: "Join Approved",
  join_rejected: "Join Rejected",
  role_changed: "Role Changed",
  member_removed: "Member Removed",
  member_deactivated: "Deactivated",
  member_suspended: "Suspended",
  member_activated: "Activated",
  member_joined: "Joined",
};

const ROLE_LABELS: Record<string, string> = {
  clinic_admin: "Admin",
  doctor: "Doctor",
  nurse: "Nurse",
  receptionist: "Receptionist",
  cashier: "Cashier",
  pharmacist: "Pharmacist",
  lab_technician: "Lab Technician",
};

const PAGE_SIZE = 25;

function FilterSelect({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-sm min-w-[140px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}

export default function ActivityLogs() {
  const { clinicMembership } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [module, setModule] = useState(ALL);
  const [userRole, setUserRole] = useState(ALL);
  const [actionType, setActionType] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const searchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 350);
  };

  const params = {
    page,
    limit: PAGE_SIZE,
    ...(module !== ALL ? { module } : {}),
    ...(userRole !== ALL ? { userRole } : {}),
    ...(actionType !== ALL ? { actionType } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  };

  const { data, isLoading } = useGetActivityLogs(
    clinicId,
    params,
    { query: { enabled: !!clinicId, queryKey: getGetActivityLogsQueryKey(clinicId, params) } }
  );

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const hasFilters = module !== ALL || userRole !== ALL || actionType !== ALL || debouncedSearch || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setModule(ALL);
    setUserRole(ALL);
    setActionType(ALL);
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Logs</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Full audit trail — searchable, filterable, paginated.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filters
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7 text-xs text-muted-foreground">
                <X className="h-3 w-3 mr-1" /> Clear all
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search log messages..."
                value={search}
                onChange={e => handleSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <FilterSelect value={module} onChange={v => { setModule(v); setPage(1); }} placeholder="All Modules">
              {Object.entries(MODULE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect value={userRole} onChange={v => { setUserRole(v); setPage(1); }} placeholder="All Roles">
              {Object.entries(ROLE_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </FilterSelect>
            <FilterSelect value={actionType} onChange={v => { setActionType(v); setPage(1); }} placeholder="All Actions">
              {Object.entries(ACTION_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </FilterSelect>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">From</span>
              <Input
                type="date"
                value={dateFrom}
                onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                className="h-9 text-sm w-[145px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground whitespace-nowrap">To</span>
              <Input
                type="date"
                value={dateTo}
                onChange={e => { setDateTo(e.target.value); setPage(1); }}
                className="h-9 text-sm w-[145px]"
              />
            </div>
            {total > 0 && (
              <span className="text-xs text-muted-foreground self-center ml-auto">
                {total.toLocaleString()} event{total !== 1 ? "s" : ""} found
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Log List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Audit Trail
          </CardTitle>
          <CardDescription>
            Page {page} of {totalPages}
            {hasFilters ? " — filtered results" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No activity found</p>
              {hasFilters && (
                <p className="text-xs mt-1">Try adjusting or clearing your filters</p>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((item) => {
                const mod = item.module ?? "";
                const ModuleIcon = MODULE_ICONS[mod] ?? Activity;
                const modColor = MODULE_COLORS[mod] ?? "";
                const actionLabel = item.actionType ? (ACTION_LABELS[item.actionType] ?? item.actionType.replace(/_/g, " ")) : null;
                const roleLabel = item.userRole ? (ROLE_LABELS[item.userRole] ?? item.userRole) : null;

                return (
                  <div key={item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <ModuleIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">{item.message}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {mod && (
                          <Badge className={`${modColor} border-0 text-[10px] px-1.5 py-0 font-medium`}>
                            {MODULE_LABELS[mod] ?? mod}
                          </Badge>
                        )}
                        {actionLabel && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                            {actionLabel}
                          </Badge>
                        )}
                        {roleLabel && (
                          <span className="text-[10px] text-muted-foreground">{roleLabel}</span>
                        )}
                        {item.userName && (
                          <span className="text-[10px] text-muted-foreground">· {item.userName}</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto whitespace-nowrap">
                          {format(new Date(item.createdAt), "MMM d, yyyy · h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
