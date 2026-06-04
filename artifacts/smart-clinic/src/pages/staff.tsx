import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListMembers, useListJoinRequests, useUpdateMember, useRemoveMember, useUpdateJoinRequest,
  getListMembersQueryKey, getListJoinRequestsQueryKey, MemberUpdateRole,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import {
  UserCog, CheckCircle, XCircle, MoreHorizontal, UserCheck, UserX, ShieldAlert,
  ShieldCheck, RefreshCw, Trash2, Search, Users, Clock, Activity,
} from "lucide-react";

const ALL_ROLES = [
  { value: "clinic_admin", label: "Clinic Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "lab_technician", label: "Lab Technician" },
  { value: "cashier", label: "Cashier" },
];

function getRoleLabel(role: string) {
  return ALL_ROLES.find(r => r.value === role)?.label ?? role.replace(/_/g, " ");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Active</Badge>;
  if (status === "suspended") return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Suspended</Badge>;
  return <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-gray-200">Inactive</Badge>;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    clinic_admin: "bg-purple-100 text-purple-800 border-purple-200",
    doctor: "bg-blue-100 text-blue-800 border-blue-200",
    nurse: "bg-pink-100 text-pink-800 border-pink-200",
    receptionist: "bg-cyan-100 text-cyan-800 border-cyan-200",
    pharmacist: "bg-emerald-100 text-emerald-800 border-emerald-200",
    lab_technician: "bg-orange-100 text-orange-800 border-orange-200",
    cashier: "bg-indigo-100 text-indigo-800 border-indigo-200",
  };
  return (
    <Badge variant="outline" className={`capitalize text-xs ${colors[role] ?? "bg-gray-100 text-gray-700"}`}>
      {getRoleLabel(role)}
    </Badge>
  );
}

type ActionType = "activate" | "deactivate" | "suspend" | "change_role" | "remove";

interface PendingAction {
  type: ActionType;
  memberId: string;
  memberName: string;
  currentRole?: string;
}

export default function Staff() {
  const { clinicMembership, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const isAdmin = clinicMembership?.role === "clinic_admin";
  const clinicType = clinicMembership?.clinicType ?? "private";

  // For government clinics, department-tied roles (cashier, pharmacist, lab_technician)
  // don't exist — filter them from all role selection UI.
  const GOVT_EXCLUDED = new Set(["cashier", "pharmacist", "lab_technician"]);
  const availableRoles = clinicType === "government"
    ? ALL_ROLES.filter(r => !GOVT_EXCLUDED.has(r.value))
    : ALL_ROLES;

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Confirmation dialog state
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [reason, setReason] = useState("");
  const [newRole, setNewRole] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const { data: members, isLoading: membersLoading } = useListMembers(
    clinicId,
    { query: { enabled: !!clinicId, queryKey: getListMembersQueryKey(clinicId) } }
  );

  const { data: requests, isLoading: requestsLoading } = useListJoinRequests(
    clinicId,
    { query: { enabled: !!clinicId && isAdmin, queryKey: getListJoinRequestsQueryKey(clinicId) } }
  );

  const updateMemberMutation = useUpdateMember();
  const removeMemberMutation = useRemoveMember();
  const updateJoinRequestMutation = useUpdateJoinRequest();

  // Derived counts
  const pendingRequests = useMemo(() => requests?.filter(r => r.status === "pending") ?? [], [requests]);
  const activeCount = useMemo(() => members?.filter(m => m.status === "active").length ?? 0, [members]);
  const inactiveCount = useMemo(() => members?.filter(m => m.status !== "active").length ?? 0, [members]);

  // Filtered members
  const filteredMembers = useMemo(() => {
    let list = members ?? [];
    if (statusFilter !== "all") list = list.filter(m => m.status === statusFilter);
    if (roleFilter !== "all") list = list.filter(m => m.role === roleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.userName?.toLowerCase().includes(q) ||
        m.userEmail?.toLowerCase().includes(q) ||
        m.staffCode?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [members, statusFilter, roleFilter, search]);

  const invalidateMembers = () => {
    queryClient.invalidateQueries({ queryKey: getListMembersQueryKey(clinicId) });
  };

  const handleJoinRequest = async (requestId: string, status: "approved" | "rejected") => {
    try {
      await updateJoinRequestMutation.mutateAsync({ clinicId, requestId, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListJoinRequestsQueryKey(clinicId) });
      invalidateMembers();
      toast({ title: status === "approved" ? "Request approved — member added" : "Request rejected" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action failed", description: error?.message });
    }
  };

  const openDialog = (action: ActionType, member: { id: string; userName?: string; role?: string }) => {
    setPendingAction({ type: action, memberId: member.id, memberName: member.userName ?? "Staff member", currentRole: member.role });
    setReason("");
    setNewRole(member.role ?? "");
  };

  const closeDialog = () => {
    setPendingAction(null);
    setReason("");
    setNewRole("");
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const { type, memberId } = pendingAction;

      if (type === "remove") {
        await removeMemberMutation.mutateAsync({ clinicId, userId: memberId });
        toast({ title: "Staff member removed from clinic access", description: "Historical records are preserved." });
      } else if (type === "activate") {
        await updateMemberMutation.mutateAsync({ clinicId, userId: memberId, data: { status: "active" } });
        toast({ title: "Staff member activated" });
      } else if (type === "deactivate") {
        await updateMemberMutation.mutateAsync({ clinicId, userId: memberId, data: { status: "inactive", reason } });
        toast({ title: "Staff member deactivated" });
      } else if (type === "suspend") {
        await updateMemberMutation.mutateAsync({ clinicId, userId: memberId, data: { status: "suspended", reason } });
        toast({ title: "Staff member suspended" });
      } else if (type === "change_role") {
        if (!newRole) { toast({ variant: "destructive", title: "Please select a role" }); return; }
        await updateMemberMutation.mutateAsync({ clinicId, userId: memberId, data: { role: newRole as MemberUpdateRole } });
        toast({ title: `Role changed to ${getRoleLabel(newRole)}` });
      }

      invalidateMembers();
      closeDialog();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Action failed", description: error?.response?.data?.error ?? error?.message });
    } finally {
      setActionLoading(false);
    }
  };

  const getDialogContent = () => {
    if (!pendingAction) return null;
    const { type, memberName } = pendingAction;
    const configs: Record<ActionType, { title: string; description: string; confirmLabel: string; variant: "default" | "destructive"; icon: React.ReactNode; showReason?: boolean; showRoleSelect?: boolean }> = {
      activate: {
        title: `Activate ${memberName}?`,
        description: "This will restore their access to the clinic dashboard and systems.",
        confirmLabel: "Activate",
        variant: "default",
        icon: <UserCheck className="w-5 h-5 text-green-600" />,
      },
      deactivate: {
        title: `Deactivate ${memberName}?`,
        description: "Their clinic access will be revoked. All historical records remain intact.",
        confirmLabel: "Deactivate",
        variant: "destructive",
        icon: <UserX className="w-5 h-5 text-red-600" />,
        showReason: true,
      },
      suspend: {
        title: `Suspend ${memberName}?`,
        description: "Access is temporarily blocked. You can reactivate at any time.",
        confirmLabel: "Suspend",
        variant: "destructive",
        icon: <ShieldAlert className="w-5 h-5 text-amber-600" />,
        showReason: true,
      },
      change_role: {
        title: `Change Role — ${memberName}`,
        description: "Select the new role for this staff member.",
        confirmLabel: "Change Role",
        variant: "default",
        icon: <RefreshCw className="w-5 h-5 text-blue-600" />,
        showRoleSelect: true,
      },
      remove: {
        title: `Remove ${memberName} from clinic?`,
        description: "Their clinic access will be permanently revoked. All medical records, prescriptions, and consultations remain traceable.",
        confirmLabel: "Remove from Clinic",
        variant: "destructive",
        icon: <Trash2 className="w-5 h-5 text-red-600" />,
        showReason: true,
      },
    };
    return configs[type];
  };

  const dialogConfig = getDialogContent();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-muted-foreground mt-1">Manage clinic personnel, roles, and access control.</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Staff</p>
            <p className="text-xl font-bold">{members?.length ?? 0}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-green-50 flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active</p>
            <p className="text-xl font-bold">{activeCount}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
            <Activity className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pending Requests</p>
            <p className="text-xl font-bold">{pendingRequests.length}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gray-50 flex items-center justify-center">
            <UserX className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Inactive / Suspended</p>
            <p className="text-xl font-bold">{inactiveCount}</p>
          </div>
        </Card>
      </div>

      {/* Pending Join Requests */}
      {isAdmin && pendingRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-800 dark:text-amber-500 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Join Requests ({pendingRequests.length})
            </CardTitle>
            <CardDescription>Review and approve staff requesting clinic access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {requestsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              pendingRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-background border rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 font-semibold text-sm">
                      {req.userName?.charAt(0)?.toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <p className="font-semibold">{req.userName} <span className="text-muted-foreground text-sm font-normal">({req.userEmail})</span></p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">Requested:</span>
                        <RoleBadge role={req.requestedRole} />
                        {req.message && <span className="text-xs text-muted-foreground italic">— "{req.message}"</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleJoinRequest(req.id, "approved")}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50" onClick={() => handleJoinRequest(req.id, "rejected")}>
                      <XCircle className="w-4 h-4 mr-1" /> Reject
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {/* Staff Directory */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="w-5 h-5" />
                Clinic Staff Directory
              </CardTitle>
              <CardDescription className="mt-1">
                {filteredMembers.length} of {members?.length ?? 0} staff member{members?.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or staff code…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[165px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {availableRoles.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {membersLoading ? (
            <div className="space-y-0 divide-y">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No staff members found</p>
              <p className="text-sm text-muted-foreground/60 mt-1">
                {search || statusFilter !== "all" || roleFilter !== "all" ? "Try adjusting your filters." : "No staff have joined yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredMembers.map(member => {
                const isSelf = member.userId === user?.id;
                const isLastAdmin = member.role === "clinic_admin" && members?.filter(m => m.role === "clinic_admin" && m.status === "active").length === 1;

                return (
                  <div key={member.id} className={`flex items-center justify-between p-4 hover:bg-muted/30 transition-colors ${member.status !== "active" ? "opacity-70" : ""}`}>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        member.status === "active" ? "bg-primary/10 text-primary" :
                        member.status === "suspended" ? "bg-amber-100 text-amber-700" :
                        "bg-gray-100 text-gray-500"
                      }`}>
                        {member.userName?.charAt(0)?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold truncate">{member.userName}</p>
                          {isSelf && <span className="text-xs text-muted-foreground">(you)</span>}
                          {member.staffCode && (
                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{member.staffCode}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{member.userEmail}</p>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            Joined {format(new Date(member.joinedAt), "MMM d, yyyy")}
                          </span>
                          {member.lastLoginAt && (
                            <>
                              <span className="text-muted-foreground/40 text-xs">·</span>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Last login {formatDistanceToNow(new Date(member.lastLoginAt), { addSuffix: true })}
                              </span>
                            </>
                          )}
                          {!member.lastLoginAt && (
                            <span className="text-xs text-muted-foreground/50">· Never logged in</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 ml-3 shrink-0">
                      <div className="hidden sm:flex items-center gap-2">
                        <StatusBadge status={member.status} />
                        <RoleBadge role={member.role} />
                      </div>

                      {isAdmin && !isSelf && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                              {member.userName}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            {member.status !== "active" && (
                              <DropdownMenuItem onClick={() => openDialog("activate", member)} className="text-green-700 focus:text-green-700">
                                <UserCheck className="w-4 h-4 mr-2" /> Activate
                              </DropdownMenuItem>
                            )}
                            {member.status === "active" && (
                              <DropdownMenuItem onClick={() => openDialog("deactivate", member)} className="text-red-600 focus:text-red-600" disabled={isLastAdmin}>
                                <UserX className="w-4 h-4 mr-2" /> Deactivate
                              </DropdownMenuItem>
                            )}
                            {member.status !== "suspended" && (
                              <DropdownMenuItem onClick={() => openDialog("suspend", member)} className="text-amber-600 focus:text-amber-600" disabled={isLastAdmin && member.status === "active"}>
                                <ShieldAlert className="w-4 h-4 mr-2" /> Suspend
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => openDialog("change_role", member)}>
                              <RefreshCw className="w-4 h-4 mr-2" /> Change Role
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              onClick={() => openDialog("remove", member)}
                              className="text-red-600 focus:text-red-600 focus:bg-red-50"
                              disabled={isLastAdmin}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Remove from Clinic
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={!!pendingAction} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-md">
          {dialogConfig && pendingAction && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {dialogConfig.icon}
                  {dialogConfig.title}
                </DialogTitle>
                <DialogDescription>{dialogConfig.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {dialogConfig.showRoleSelect && (
                  <div className="space-y-2">
                    <Label>New Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {dialogConfig.showReason && (
                  <div className="space-y-2">
                    <Label>Reason <span className="text-muted-foreground text-xs font-normal">(optional — recorded in audit log)</span></Label>
                    <Textarea
                      placeholder="e.g. Left clinic, Contract ended, Policy violation…"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  variant={dialogConfig.variant}
                  onClick={executeAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Processing…" : dialogConfig.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
