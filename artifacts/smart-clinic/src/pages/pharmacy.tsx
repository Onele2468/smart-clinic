import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetPharmacyQueue,
  useDispensePrescription,
  getGetPharmacyQueueQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Pill, CheckCircle2, Package, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-amber-100 text-amber-800 border-amber-200",
  dispensed: "bg-blue-100 text-blue-800 border-blue-200",
  collected: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export default function Pharmacy() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const role = clinicMembership?.role || "";

  const ALL_SENTINEL = "__all__";
  const [filterStatus, setFilterStatus] = useState<string>("active");

  const activeFilter = filterStatus === ALL_SENTINEL ? undefined : filterStatus;
  const { data: queue, isLoading } = useGetPharmacyQueue(
    clinicId,
    { status: activeFilter },
    { query: { enabled: !!clinicId, queryKey: getGetPharmacyQueueQueryKey(clinicId, { status: activeFilter }), refetchInterval: 20000 } }
  );

  const dispenseMutation = useDispensePrescription();

  const handleDispense = async (prescriptionId: string, status: string) => {
    try {
      await dispenseMutation.mutateAsync({ clinicId, prescriptionId, data: { status: status as any } });
      queryClient.invalidateQueries({ queryKey: getGetPharmacyQueueQueryKey(clinicId, { status: activeFilter }) });
      toast({ title: `Prescription marked as ${status}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to update prescription", description: error?.message });
    }
  };

  const canDispense = ["pharmacist", "clinic_admin", "nurse"].includes(role);

  const stats = {
    pending: queue?.filter(p => p.status === "active").length ?? 0,
    dispensed: queue?.filter(p => p.status === "dispensed").length ?? 0,
    collected: queue?.filter(p => p.status === "collected").length ?? 0,
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pharmacy</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage prescriptions and dispensing
          </p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Pending</SelectItem>
            <SelectItem value="dispensed">Dispensed</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value={ALL_SENTINEL}>All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{stats.pending}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dispensed</p>
              <p className="text-2xl font-bold">{stats.dispensed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Collected</p>
              <p className="text-2xl font-bold">{stats.collected}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prescription queue */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !queue?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No prescriptions found</p>
            <p className="text-sm mt-1">All caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map(rx => (
            <Card key={rx.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{rx.medicationName}</span>
                      <Badge variant="outline" className="font-mono text-xs">{rx.prescriptionCode}</Badge>
                      <Badge className={`text-xs border ${STATUS_COLORS[rx.status] ?? ""}`}>
                        {rx.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Dosage</p>
                        <p className="font-medium">{rx.dosage}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Frequency</p>
                        <p className="font-medium">{rx.frequency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Duration</p>
                        <p className="font-medium">{rx.duration}</p>
                      </div>
                    </div>
                    {rx.instructions && (
                      <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{rx.instructions}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>Patient: <span className="font-semibold text-foreground">{rx.patientName}</span> · {rx.patientCode}</span>
                      <span>Prescribed by: Dr. {rx.doctorName ?? "Unknown"}</span>
                      <span>{format(new Date(rx.createdAt), "MMM d, h:mm a")}</span>
                    </div>
                    {rx.dispensedAt && (
                      <p className="text-xs text-blue-600">Dispensed: {format(new Date(rx.dispensedAt), "MMM d, h:mm a")}</p>
                    )}
                    {rx.collectedAt && (
                      <p className="text-xs text-green-600">Collected: {format(new Date(rx.collectedAt), "MMM d, h:mm a")}</p>
                    )}
                  </div>

                  {canDispense && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {rx.status === "active" && (
                        <Button
                          size="sm"
                          onClick={() => handleDispense(rx.id, "dispensed")}
                          disabled={dispenseMutation.isPending}
                        >
                          <Package className="h-3 w-3 mr-1" /> Dispense
                        </Button>
                      )}
                      {rx.status === "dispensed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => handleDispense(rx.id, "collected")}
                          disabled={dispenseMutation.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Collected
                        </Button>
                      )}
                      {rx.status === "active" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive text-xs"
                          onClick={() => handleDispense(rx.id, "cancelled")}
                          disabled={dispenseMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
