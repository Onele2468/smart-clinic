import Layout from "@/components/Layout";
import { useListPatientPortalLabRequests, getListPatientPortalLabRequestsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical, Clock, User, AlertCircle, FileText } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border-blue-200",
  completed:   "bg-green-50 text-green-700 border-green-200",
  cancelled:   "bg-red-50 text-red-700 border-red-200",
};

const URGENCY_STYLES: Record<string, string> = {
  routine: "bg-muted text-muted-foreground",
  urgent:  "bg-orange-100 text-orange-700",
  stat:    "bg-red-100 text-red-700",
};

export default function LabResultsPage() {
  const { data: labRequests, isLoading, isError } = useListPatientPortalLabRequests({
    query: { queryKey: getListPatientPortalLabRequestsQueryKey() },
  });

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-7">
          <h1 className="text-2xl font-semibold text-foreground">Lab Results</h1>
          <p className="text-muted-foreground mt-0.5">Laboratory tests requested by your care team.</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Failed to load lab results. Please refresh.
          </div>
        )}

        {!isLoading && !isError && (
          <div className="space-y-3" data-testid="list-lab-requests">
            {labRequests?.map((lr) => {
              const result = (lr as any).result as {
                resultText: string;
                resultNotes: string | null;
                resultStatus: string;
                technicianName: string | null;
                resultCreatedAt: string;
              } | null;
              return (
                <Card key={lr.id} data-testid={`card-lab-${lr.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FlaskConical className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-sm" data-testid={`text-lab-name-${lr.id}`}>{lr.testName}</p>
                            <p className="text-xs text-muted-foreground capitalize">{lr.testCategory} test</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", URGENCY_STYLES[lr.urgency ?? "routine"])}>
                              {lr.urgency ?? "routine"}
                            </span>
                            <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border", STATUS_STYLES[lr.status ?? "pending"])}>
                              {(lr.status ?? "pending").replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {lr.doctorName && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Dr. {lr.doctorName}
                            </span>
                          )}
                          {lr.createdAt && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Requested {format(new Date(lr.createdAt), "d MMM yyyy")}
                            </span>
                          )}
                          {lr.requestCode && (
                            <span className="font-mono">{lr.requestCode}</span>
                          )}
                        </div>
                        {lr.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 italic">{lr.notes}</p>
                        )}

                        {/* Result findings — shown only when a result has been submitted */}
                        {result && (
                          <div className="mt-3 pt-3 border-t border-green-100">
                            <div className="bg-green-50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-800 uppercase tracking-wide">
                                  <FileText className="w-3 h-3" />
                                  Test Findings
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium capitalize border border-green-200">
                                  {result.resultStatus ?? "final"}
                                </span>
                              </div>
                              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">{result.resultText}</p>
                              {result.resultNotes && (
                                <p className="text-xs text-muted-foreground italic">{result.resultNotes}</p>
                              )}
                              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-green-200">
                                {result.technicianName && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {result.technicianName}
                                  </span>
                                )}
                                {result.resultCreatedAt && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(result.resultCreatedAt), "d MMM yyyy, h:mm a")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {labRequests?.length === 0 && (
              <div className="text-center py-16 text-muted-foreground" data-testid="empty-lab-requests">
                <FlaskConical className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="font-medium">No lab tests yet</p>
                <p className="text-sm mt-1">Lab tests requested by your doctor will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
