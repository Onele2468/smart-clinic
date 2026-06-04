import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListStaffAvailability,
  useUpdateMyAvailability,
  getListStaffAvailabilityQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Search, RefreshCw, Stethoscope, Heart, Wifi, WifiOff, Clock, Coffee, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type AvailStatus = "available" | "busy" | "in_consultation" | "offline" | "on_break";

const STATUS_CONFIG: Record<AvailStatus, { label: string; dot: string; badge: string; icon: React.ElementType }> = {
  available:       { label: "Available",       dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Wifi },
  in_consultation: { label: "In Consultation", dot: "bg-violet-500",  badge: "bg-violet-50 text-violet-700 border-violet-200",  icon: Stethoscope },
  busy:            { label: "Busy",            dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700 border-amber-200",   icon: Activity },
  on_break:        { label: "On Break",        dot: "bg-blue-400",    badge: "bg-blue-50 text-blue-700 border-blue-200",    icon: Coffee },
  offline:         { label: "Offline",         dot: "bg-gray-400",    badge: "bg-gray-50 text-gray-600 border-gray-200",    icon: WifiOff },
};

const MY_STATUSES: AvailStatus[] = ["available", "busy", "in_consultation", "on_break", "offline"];

function StatusBadge({ status }: { status: AvailStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium", cfg.badge)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

function RoleIcon({ role }: { role: string }) {
  if (role === "doctor") return <Stethoscope className="w-3.5 h-3.5 text-violet-600" />;
  return <Heart className="w-3.5 h-3.5 text-blue-500" />;
}

export default function StaffAvailabilityPage() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId ?? "";
  const myRole = clinicMembership?.role ?? "";

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "doctor" | "nurse">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AvailStatus>("all");

  const { data: staff, isLoading, refetch, isFetching } = useListStaffAvailability(
    clinicId,
    {
      role: roleFilter !== "all" ? roleFilter : undefined,
      status: statusFilter !== "all" ? statusFilter : undefined,
    },
    { query: { enabled: !!clinicId, queryKey: getListStaffAvailabilityQueryKey(clinicId, { role: roleFilter !== "all" ? roleFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined }), refetchInterval: 20_000 } }
  );

  const updateMutation = useUpdateMyAvailability();

  const updateMyStatus = async (status: AvailStatus) => {
    try {
      await updateMutation.mutateAsync({ clinicId, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListStaffAvailabilityQueryKey(clinicId) });
      toast({ title: "Your status updated", description: STATUS_CONFIG[status].label });
    } catch {
      toast({ variant: "destructive", title: "Failed to update status" });
    }
  };

  const isStaff = ["doctor", "nurse"].includes(myRole);
  const canViewAll = ["clinic_admin", "receptionist", "doctor", "nurse"].includes(myRole);

  const filtered = (staff ?? []).filter(m => {
    if (!search) return true;
    return m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.staffCode ?? "").toLowerCase().includes(search.toLowerCase());
  });

  const available = filtered.filter(m => m.availabilityStatus === "available").length;
  const busy = filtered.filter(m => ["busy", "in_consultation"].includes(m.availabilityStatus)).length;
  const offline = filtered.filter(m => ["offline", "on_break"].includes(m.availabilityStatus)).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Availability</h1>
          <p className="text-muted-foreground text-sm mt-1">Real-time status of doctors and nurses</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* My Status — visible only to doctor/nurse */}
      {isStaff && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RoleIcon role={myRole} />
              My Availability Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {MY_STATUSES.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    className={cn("gap-1.5 text-xs", cfg.badge, "border")}
                    onClick={() => updateMyStatus(s)}
                    disabled={updateMutation.isPending}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                    <Icon className="w-3 h-3" />
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{available}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Available</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{busy}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Busy / In Consult</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-gray-500">{offline}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Offline / Break</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9"
            placeholder="Search staff..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as typeof roleFilter)}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="doctor">Doctors</SelectItem>
            <SelectItem value="nurse">Nurses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {MY_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Staff List */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Stethoscope className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No staff members found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(member => {
            const status = member.availabilityStatus as AvailStatus;
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
            const Icon = cfg.icon;
            return (
              <Card key={member.userId} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-primary">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className={cn("absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-background", cfg.dot)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{member.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RoleIcon role={member.role} />
                        <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                        {member.staffCode && (
                          <Badge variant="outline" className="text-[10px] font-mono py-0 px-1">{member.staffCode}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <StatusBadge status={status} />
                      </div>
                      {member.availabilityUpdatedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {formatDistanceToNow(new Date(member.availabilityUpdatedAt), { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
