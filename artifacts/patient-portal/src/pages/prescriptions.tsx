import Layout from "@/components/Layout";
import { useListPatientPortalPrescriptions, getListPatientPortalPrescriptionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Pill, Clock, User, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  active:    { cls: "bg-green-50 text-green-700 border-green-200", label: "Active" },
  dispensed: { cls: "bg-blue-50 text-blue-700 border-blue-200", label: "Dispensed" },
  collected: { cls: "bg-gray-50 text-gray-600 border-gray-200", label: "Collected" },
  cancelled: { cls: "bg-red-50 text-red-700 border-red-200", label: "Cancelled" },
};

export default function PrescriptionsPage() {
  const { data: prescriptions, isLoading, isError } = useListPatientPortalPrescriptions({
    query: { queryKey: getListPatientPortalPrescriptionsQueryKey() },
  });

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-foreground">Prescriptions</h1>
          <p className="text-muted-foreground mt-0.5">Medications prescribed by your doctors.</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to load prescriptions. Please refresh.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="space-y-3" data-testid="list-prescriptions">
            {prescriptions?.map((rx) => {
              const style = STATUS_STYLES[rx.status ?? "active"];
              return (
                <Card key={rx.id} data-testid={`card-prescription-${rx.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                        <Pill className="w-5 h-5 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-sm" data-testid={`text-rx-name-${rx.id}`}>{rx.medicationName}</p>
                          <span className={cn("shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", style?.cls)}>
                            {style?.label ?? rx.status}
                          </span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                          <span><span className="font-medium text-foreground">Dosage:</span> {rx.dosage}</span>
                          <span><span className="font-medium text-foreground">Frequency:</span> {rx.frequency}</span>
                          <span><span className="font-medium text-foreground">Duration:</span> {rx.duration}</span>
                        </div>
                        {rx.instructions && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">{rx.instructions}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {rx.doctorName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Dr. {rx.doctorName}
                            </span>
                          )}
                          {rx.createdAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(rx.createdAt), "d MMM yyyy")}
                            </span>
                          )}
                          {rx.dispensedAt && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle className="w-3 h-3" />
                              Dispensed {format(new Date(rx.dispensedAt), "d MMM")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 font-mono">{rx.prescriptionCode}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {prescriptions?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground" data-testid="empty-prescriptions">
                <Pill className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="font-medium">No prescriptions yet</p>
                <p className="text-sm mt-1">Your prescribed medications will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
