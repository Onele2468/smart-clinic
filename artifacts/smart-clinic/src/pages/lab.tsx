import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetLabQueue,
  useUpdateLabRequest,
  useSubmitLabResult,
  getGetLabQueueQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Clock, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const URGENCY_COLORS: Record<string, string> = {
  routine: "bg-gray-100 text-gray-700 border-gray-200",
  urgent: "bg-amber-100 text-amber-800 border-amber-200",
  stat: "bg-red-100 text-red-800 border-red-200",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const resultSchema = z.object({
  resultText: z.string().min(1, "Result is required"),
  resultNotes: z.string().optional(),
  status: z.enum(["preliminary", "final", "amended"]).default("final"),
});

interface SelectedRequest {
  id: string;
  patientId: string;
  testName: string;
  requestCode: string;
}

export default function Lab() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const role = clinicMembership?.role || "";

  const ALL_SENTINEL = "__all__";
  const [filterStatus, setFilterStatus] = useState<string>(ALL_SENTINEL);
  const [selectedRequest, setSelectedRequest] = useState<SelectedRequest | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const activeFilter = filterStatus === ALL_SENTINEL ? undefined : filterStatus;
  const { data: queue, isLoading } = useGetLabQueue(
    clinicId,
    { status: activeFilter },
    { query: { enabled: !!clinicId, queryKey: getGetLabQueueQueryKey(clinicId, { status: activeFilter }), refetchInterval: 20000 } }
  );

  const updateRequestMutation = useUpdateLabRequest();
  const submitResultMutation = useSubmitLabResult();

  const resultForm = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: { resultText: "", resultNotes: "", status: "final" },
  });

  const handleUpdateStatus = async (request: any, newStatus: string) => {
    try {
      await updateRequestMutation.mutateAsync({
        clinicId,
        patientId: request.patientId,
        requestId: request.id,
        data: { status: newStatus as any },
      });
      queryClient.invalidateQueries({ queryKey: getGetLabQueueQueryKey(clinicId, { status: activeFilter }) });
      toast({ title: `Request marked as ${newStatus.replace("_", " ")}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to update", description: error?.message });
    }
  };

  const openResultForm = (request: any) => {
    setSelectedRequest({ id: request.id, patientId: request.patientId, testName: request.testName, requestCode: request.requestCode });
    resultForm.reset({ resultText: "", resultNotes: "", status: "final" });
    setIsResultOpen(true);
  };

  const onSubmitResult = async (values: z.infer<typeof resultSchema>) => {
    if (!selectedRequest) return;
    try {
      await submitResultMutation.mutateAsync({
        clinicId,
        patientId: selectedRequest.patientId,
        requestId: selectedRequest.id,
        data: values,
      });
      queryClient.invalidateQueries({ queryKey: getGetLabQueueQueryKey(clinicId, { status: activeFilter }) });
      toast({ title: "Lab result submitted successfully" });
      setIsResultOpen(false);
      resultForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to submit result", description: error?.message });
    }
  };

  const canProcess = ["lab_technician", "clinic_admin"].includes(role);
  const canView = ["doctor", "clinic_admin", "lab_technician", "nurse"].includes(role);

  const pendingCount = queue?.filter(r => r.status === "pending").length ?? 0;
  const inProgressCount = queue?.filter(r => r.status === "in_progress").length ?? 0;
  const completedCount = queue?.filter(r => r.status === "completed").length ?? 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laboratory</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage lab requests and submit results</p>
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All requests" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>All Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Loader2 className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold">{inProgressCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50/40">
          <CardContent className="pt-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed Today</p>
              <p className="text-2xl font-bold">{completedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lab requests */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : !queue?.length ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No lab requests found</p>
            <p className="text-sm mt-1">Lab requests from doctors will appear here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map(req => (
            <Card key={req.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{req.testName}</span>
                      <Badge variant="outline" className="font-mono text-xs">{req.requestCode}</Badge>
                      <Badge className={`text-xs border ${URGENCY_COLORS[req.urgency] ?? ""}`}>
                        {req.urgency.toUpperCase()}
                      </Badge>
                      <Badge className={`text-xs ${STATUS_COLORS[req.status] ?? ""}`}>
                        {req.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="capitalize">Category: <span className="font-medium text-foreground">{req.testCategory}</span></span>
                      {req.patientName && (
                        <span>Patient: <span className="font-semibold text-foreground">{req.patientName}</span> · {req.patientCode}</span>
                      )}
                      <span>Requested by: Dr. {req.doctorName ?? "Unknown"}</span>
                    </div>
                    {req.notes && (
                      <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{req.notes}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
                    </p>
                  </div>

                  {canProcess && (
                    <div className="flex flex-col gap-2 shrink-0">
                      {req.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(req, "in_progress")}
                          disabled={updateRequestMutation.isPending}
                        >
                          Start Processing
                        </Button>
                      )}
                      {(req.status === "pending" || req.status === "in_progress") && (
                        <Button
                          size="sm"
                          onClick={() => openResultForm(req)}
                        >
                          <FlaskConical className="h-3 w-3 mr-1" /> Submit Result
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

      {/* Result submission dialog */}
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Lab Result</DialogTitle>
            {selectedRequest && (
              <p className="text-sm text-muted-foreground">
                {selectedRequest.testName} · {selectedRequest.requestCode}
              </p>
            )}
          </DialogHeader>
          <Form {...resultForm}>
            <form onSubmit={resultForm.handleSubmit(onSubmitResult)} className="space-y-4">
              <FormField control={resultForm.control} name="resultText" render={({ field }) => (
                <FormItem>
                  <FormLabel>Result</FormLabel>
                  <FormControl>
                    <Textarea rows={4} placeholder="Enter lab result findings..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={resultForm.control} name="resultNotes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Additional notes or observations..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={resultForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Result Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="preliminary">Preliminary</SelectItem>
                      <SelectItem value="final">Final</SelectItem>
                      <SelectItem value="amended">Amended</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={submitResultMutation.isPending}>
                {submitResultMutation.isPending ? "Submitting..." : "Submit Result"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
