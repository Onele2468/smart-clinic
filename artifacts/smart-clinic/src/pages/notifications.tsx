import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, BellOff } from "lucide-react";
import { format } from "date-fns";

const TYPE_STYLES: Record<string, string> = {
  patient_registered: "bg-blue-50 text-blue-700 border-blue-200",
  appointment: "bg-purple-50 text-purple-700 border-purple-200",
  lab_request: "bg-orange-50 text-orange-700 border-orange-200",
  low_inventory: "bg-red-50 text-red-700 border-red-200",
  out_of_stock: "bg-red-100 text-red-800 border-red-300",
  payment: "bg-green-50 text-green-700 border-green-200",
  queue_threshold: "bg-amber-50 text-amber-700 border-amber-200",
  high_patient_volume: "bg-amber-50 text-amber-700 border-amber-200",
  staff_join_request: "bg-indigo-50 text-indigo-700 border-indigo-200",
  staff_approved: "bg-indigo-50 text-indigo-700 border-indigo-200",
  staff_rejected: "bg-slate-50 text-slate-700 border-slate-200",
  supplier_delivery: "bg-teal-50 text-teal-700 border-teal-200",
  whatsapp_failure: "bg-red-50 text-red-800 border-red-300",
  general: "bg-gray-50 text-gray-700 border-gray-200",
};

export default function Notifications() {
  const { clinicMembership } = useAuth();
  const clinicId = clinicMembership?.clinicId || "";
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useListNotifications(clinicId, {
    query: {
      enabled: !!clinicId,
      queryKey: getListNotificationsQueryKey(clinicId),
    }
  });

  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleMarkRead = async (notificationId: string) => {
    await markReadMutation.mutateAsync({ clinicId, notificationId });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey(clinicId) });
  };

  const handleMarkAllRead = async () => {
    await markAllReadMutation.mutateAsync({ clinicId });
    queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey(clinicId) });
  };

  const unread = notifications?.filter(n => !n.isRead) ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Clinic operational alerts and important events
            {unread.length > 0
              ? ` · ${unread.length} unread`
              : notifications?.length
                ? " · All caught up"
                : ""}
          </p>
        </div>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={markAllReadMutation.isPending}
            data-testid="button-mark-all-read"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            All Notifications
            {unread.length > 0 && (
              <Badge className="ml-1 text-xs">{unread.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !notifications?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellOff className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No operational alerts at the moment.</p>
              <p className="text-sm mt-1">You will see clinic management alerts here when they occur.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {notifications.map((n, idx) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 py-3.5 ${idx < notifications.length - 1 ? "border-b" : ""} ${!n.isRead ? "bg-primary/5 -mx-2 px-2 rounded-lg" : ""}`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className={`h-2 w-2 rounded-full mt-2 shrink-0 ${!n.isRead ? "bg-primary" : "bg-transparent"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{n.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize ${TYPE_STYLES[n.type] ?? TYPE_STYLES.general}`}>
                        {n.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-xs text-muted-foreground">{format(new Date(n.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                  </div>
                  {!n.isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs shrink-0"
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markReadMutation.isPending}
                    >
                      <CheckCheck className="h-3 w-3 mr-1" /> Read
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
