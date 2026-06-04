import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetPatient,
  useListConsultationNotes,
  useCreateConsultationNote,
  useUpdateConsultationNote,
  useListNurseAssessments,
  useListPrescriptions,
  useCreatePrescription,
  useListLabRequests,
  useCreateLabRequest,
  getListConsultationNotesQueryKey,
  getListPrescriptionsQueryKey,
  getListLabRequestsQueryKey,
  getGetPatientQueryKey,
  getListNurseAssessmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useSearch, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  ArrowLeft, Save, CheckCircle, Stethoscope, Activity, Pill, FlaskConical,
  ThermometerSun, Heart, Droplets, Wind, User, AlertCircle, Plus, FileText
} from "lucide-react";
import { cn } from "@/lib/utils";

const noteSchema = z.object({
  chiefComplaint: z.string().optional(),
  symptoms: z.string().optional(),
  diagnosis: z.string().optional(),
  prescription: z.string().optional(),
  treatmentPlan: z.string().optional(),
  followUpInstructions: z.string().optional(),
  notes: z.string().optional(),
});

const rxSchema = z.object({
  medicationName: z.string().min(1, "Required"),
  dosage: z.string().min(1, "Required"),
  frequency: z.string().min(1, "Required"),
  duration: z.string().min(1, "Required"),
  instructions: z.string().optional(),
});

const labSchema = z.object({
  testName: z.string().min(1, "Required"),
  testCategory: z.enum(["blood", "urine", "stool", "imaging", "swab", "other"]),
  urgency: z.enum(["routine", "urgent", "stat"]),
  notes: z.string().optional(),
});

function VitalsCard({ assessment }: { assessment: any }) {
  const vitals = [
    { icon: Heart, label: "Blood Pressure", value: assessment.bloodPressure, unit: "mmHg", color: "text-red-500" },
    { icon: Activity, label: "Pulse", value: assessment.pulseRate, unit: "bpm", color: "text-pink-500" },
    { icon: ThermometerSun, label: "Temperature", value: assessment.temperature, unit: "°C", color: "text-orange-500" },
    { icon: Wind, label: "SpO₂", value: assessment.oxygenSaturation, unit: "%", color: "text-blue-500" },
    { icon: Droplets, label: "Blood Sugar", value: assessment.bloodSugar, unit: "mg/dL", color: "text-purple-500" },
    { icon: User, label: "Weight", value: assessment.weight, unit: "kg", color: "text-slate-500" },
  ];

  const triageColors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 border-red-200",
    urgent: "bg-orange-100 text-orange-800 border-orange-200",
    semi_urgent: "bg-yellow-100 text-yellow-800 border-yellow-200",
    non_urgent: "bg-green-100 text-green-800 border-green-200",
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-700">
            <Activity className="w-4 h-4" /> Nurse Assessment
          </CardTitle>
          <div className="flex items-center gap-2">
            {assessment.triageLevel && (
              <Badge variant="outline" className={cn("text-xs", triageColors[assessment.triageLevel] ?? "bg-gray-100 text-gray-700")}>
                {assessment.triageLevel.replace("_", " ").toUpperCase()}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">{format(new Date(assessment.createdAt), "MMM d, h:mm a")}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {vitals.filter(v => v.value).map(v => (
            <div key={v.label} className="flex items-center gap-2 bg-white rounded-lg p-2.5 border">
              <v.icon className={cn("w-4 h-4 shrink-0", v.color)} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{v.label}</p>
                <p className="font-semibold text-sm">{v.value} <span className="text-xs font-normal text-muted-foreground">{v.unit}</span></p>
              </div>
            </div>
          ))}
        </div>
        {assessment.symptoms && (
          <div className="bg-white rounded-lg p-2.5 border">
            <p className="text-xs text-muted-foreground mb-1">Symptoms Reported</p>
            <p className="text-sm">{assessment.symptoms}</p>
          </div>
        )}
        {assessment.triageNotes && (
          <div className="bg-white rounded-lg p-2.5 border">
            <p className="text-xs text-muted-foreground mb-1">Nurse Notes</p>
            <p className="text-sm">{assessment.triageNotes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConsultationPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const search = useSearch();
  const appointmentId = new URLSearchParams(search).get("appointmentId") ?? undefined;
  const { clinicMembership, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const role = clinicMembership?.role || "";

  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { data: patient, isLoading: patientLoading } = useGetPatient(
    clinicId, patientId,
    { query: { enabled: !!clinicId && !!patientId, queryKey: getGetPatientQueryKey(clinicId, patientId) } }
  );

  const { data: notes, isLoading: notesLoading } = useListConsultationNotes(
    clinicId, patientId,
    { query: { enabled: !!clinicId && !!patientId, queryKey: getListConsultationNotesQueryKey(clinicId, patientId) } }
  );

  const { data: assessments } = useListNurseAssessments(
    clinicId, patientId,
    { query: { enabled: !!clinicId && !!patientId, queryKey: getListNurseAssessmentsQueryKey(clinicId, patientId) } }
  );

  const { data: prescriptions } = useListPrescriptions(
    clinicId, patientId,
    { query: { enabled: !!clinicId && !!patientId, queryKey: getListPrescriptionsQueryKey(clinicId, patientId) } }
  );

  const { data: labRequests } = useListLabRequests(
    clinicId, patientId,
    { query: { enabled: !!clinicId && !!patientId, queryKey: getListLabRequestsQueryKey(clinicId, patientId) } }
  );

  const createNoteMutation = useCreateConsultationNote();
  const updateNoteMutation = useUpdateConsultationNote();
  const createPrescriptionMutation = useCreatePrescription();
  const createLabMutation = useCreateLabRequest();

  const noteForm = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { chiefComplaint: "", symptoms: "", diagnosis: "", prescription: "", treatmentPlan: "", followUpInstructions: "", notes: "" },
  });

  const rxForm = useForm<z.infer<typeof rxSchema>>({
    resolver: zodResolver(rxSchema),
    defaultValues: { medicationName: "", dosage: "", frequency: "", duration: "", instructions: "" },
  });

  const labForm = useForm<z.infer<typeof labSchema>>({
    resolver: zodResolver(labSchema),
    defaultValues: { testName: "", testCategory: "blood", urgency: "routine", notes: "" },
  });

  // Find today's active consultation note for this doctor
  const activeNote = notes?.find(n =>
    n.doctorId === user?.id &&
    (n.status === "in_progress") &&
    (appointmentId ? n.appointmentId === appointmentId : true)
  ) ?? null;

  // Pre-fill form when activeNote loads
  useEffect(() => {
    if (activeNote) {
      setActiveNoteId(activeNote.id);
      noteForm.reset({
        chiefComplaint: activeNote.chiefComplaint ?? "",
        symptoms: (activeNote as any).symptoms ?? "",
        diagnosis: activeNote.diagnosis ?? "",
        prescription: activeNote.prescription ?? "",
        treatmentPlan: activeNote.treatmentPlan ?? "",
        followUpInstructions: activeNote.followUpInstructions ?? "",
        notes: activeNote.notes ?? "",
      });
    }
  }, [activeNote?.id]);

  const latestAssessment = assessments?.[0] ?? null;

  const startConsultation = async () => {
    try {
      const note = await createNoteMutation.mutateAsync({
        clinicId, patientId,
        data: {
          chiefComplaint: "",
          status: "in_progress" as any,
          appointmentId: appointmentId ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListConsultationNotesQueryKey(clinicId, patientId) });
      setActiveNoteId((note as any).id);
      toast({ title: "Consultation started" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to start consultation", description: error?.message });
    }
  };

  const saveNote = async (values: z.infer<typeof noteSchema>, status?: string) => {
    if (!activeNoteId) return;
    setSaving(true);
    try {
      await updateNoteMutation.mutateAsync({
        clinicId, patientId, noteId: activeNoteId,
        data: { ...values, status: (status ?? "in_progress") as any },
      });
      queryClient.invalidateQueries({ queryKey: getListConsultationNotesQueryKey(clinicId, patientId) });
      if (status === "completed") {
        toast({ title: "Consultation completed", description: "Patient record updated." });
      } else {
        toast({ title: "Note saved" });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save failed", description: error?.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSave = (values: z.infer<typeof noteSchema>) => {
    if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
    const t = setTimeout(() => saveNote(values), 3000);
    setAutoSaveTimeout(t);
  };

  const onSubmitPrescription = async (values: z.infer<typeof rxSchema>) => {
    try {
      await createPrescriptionMutation.mutateAsync({ clinicId, patientId, data: values });
      queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey(clinicId, patientId) });
      toast({ title: "Prescription issued" });
      setIsPrescriptionOpen(false);
      rxForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error?.message });
    }
  };

  const onSubmitLab = async (values: z.infer<typeof labSchema>) => {
    try {
      await createLabMutation.mutateAsync({ clinicId, patientId, data: values });
      queryClient.invalidateQueries({ queryKey: getListLabRequestsQueryKey(clinicId, patientId) });
      toast({ title: "Lab request created" });
      setIsLabOpen(false);
      labForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed", description: error?.message });
    }
  };

  const isDoctor = ["doctor", "clinic_admin"].includes(role);

  if (patientLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-semibold">Patient not found</h2>
        <Button variant="link" asChild className="mt-4"><Link href="/patients">Back to patients</Link></Button>
      </div>
    );
  }

  const todayPrescriptions = prescriptions?.filter(p => {
    const d = new Date(p.createdAt);
    return d.toDateString() === new Date().toDateString();
  }) ?? [];

  const todayLabs = labRequests?.filter(l => {
    const d = new Date(l.createdAt);
    return d.toDateString() === new Date().toDateString();
  }) ?? [];

  const completedLabs = labRequests?.filter(l => l.status === "completed" && (l as any).result) ?? [];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/appointments"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{patient.firstName} {patient.lastName}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">{patient.patientCode}</span>
              <span>·</span>
              <span className="capitalize">{patient.gender}</span>
              <span>·</span>
              <span>{patient.dateOfBirth}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeNoteId && (
            <>
              <Button variant="outline" size="sm" onClick={() => saveNote(noteForm.getValues())} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" className="bg-green-600 hover:bg-green-700"
                onClick={() => saveNote(noteForm.getValues(), "completed")}>
                <CheckCircle className="w-4 h-4 mr-1" /> Complete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Patient flags */}
      {(patient.allergies || patient.chronicConditions) && (
        <div className="flex flex-wrap gap-2">
          {patient.allergies && (
            <div className="flex items-center gap-1.5 text-sm bg-red-50 text-red-700 border border-red-200 rounded-md px-3 py-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-medium">Allergies:</span> {patient.allergies}
            </div>
          )}
          {patient.chronicConditions && (
            <div className="flex items-center gap-1.5 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-md px-3 py-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="font-medium">Chronic:</span> {patient.chronicConditions}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — nurse vitals + prescriptions + labs */}
        <div className="space-y-4">
          {latestAssessment ? (
            <VitalsCard assessment={latestAssessment} />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-6 text-center text-muted-foreground text-sm">
                <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
                No nurse assessment recorded
              </CardContent>
            </Card>
          )}

          {/* Quick Prescription */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><Pill className="w-4 h-4 text-green-600" /> Today's Prescriptions</CardTitle>
                {isDoctor && (
                  <Dialog open={isPrescriptionOpen} onOpenChange={setIsPrescriptionOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>Issue Prescription</DialogTitle></DialogHeader>
                      <Form {...rxForm}>
                        <form onSubmit={rxForm.handleSubmit(onSubmitPrescription)} className="space-y-3">
                          <FormField control={rxForm.control} name="medicationName" render={({ field }) => (
                            <FormItem><FormLabel>Medication</FormLabel>
                              <FormControl><Input placeholder="e.g. Amoxicillin 500mg" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-3">
                            <FormField control={rxForm.control} name="dosage" render={({ field }) => (
                              <FormItem><FormLabel>Dosage</FormLabel>
                                <FormControl><Input placeholder="e.g. 500mg" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={rxForm.control} name="frequency" render={({ field }) => (
                              <FormItem><FormLabel>Frequency</FormLabel>
                                <FormControl><Input placeholder="e.g. Twice daily" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={rxForm.control} name="duration" render={({ field }) => (
                            <FormItem><FormLabel>Duration</FormLabel>
                              <FormControl><Input placeholder="e.g. 7 days" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={rxForm.control} name="instructions" render={({ field }) => (
                            <FormItem><FormLabel>Instructions (optional)</FormLabel>
                              <FormControl><Textarea rows={2} placeholder="Take with food, avoid alcohol..." {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <Button type="submit" className="w-full" disabled={createPrescriptionMutation.isPending}>
                            {createPrescriptionMutation.isPending ? "Issuing..." : "Issue Prescription"}
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {todayPrescriptions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No prescriptions today</p>
              ) : (
                <div className="space-y-2">
                  {todayPrescriptions.map(p => (
                    <div key={p.id} className="text-xs p-2 rounded border bg-green-50/50">
                      <p className="font-semibold">{p.medicationName}</p>
                      <p className="text-muted-foreground">{p.dosage} · {p.frequency} · {p.duration}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lab Requests */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="w-4 h-4 text-purple-600" /> Today's Lab Requests</CardTitle>
                {isDoctor && (
                  <Dialog open={isLabOpen} onOpenChange={setIsLabOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 text-xs"><Plus className="w-3 h-3 mr-1" /> Add</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>New Lab Request</DialogTitle></DialogHeader>
                      <Form {...labForm}>
                        <form onSubmit={labForm.handleSubmit(onSubmitLab)} className="space-y-3">
                          <FormField control={labForm.control} name="testName" render={({ field }) => (
                            <FormItem><FormLabel>Test Name</FormLabel>
                              <FormControl><Input placeholder="e.g. Full Blood Count, HbA1c..." {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <div className="grid grid-cols-2 gap-3">
                            <FormField control={labForm.control} name="testCategory" render={({ field }) => (
                              <FormItem><FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="blood">Blood</SelectItem>
                                    <SelectItem value="urine">Urine</SelectItem>
                                    <SelectItem value="stool">Stool</SelectItem>
                                    <SelectItem value="imaging">Imaging</SelectItem>
                                    <SelectItem value="swab">Swab</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                            <FormField control={labForm.control} name="urgency" render={({ field }) => (
                              <FormItem><FormLabel>Urgency</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                  <SelectContent>
                                    <SelectItem value="routine">Routine</SelectItem>
                                    <SelectItem value="urgent">Urgent</SelectItem>
                                    <SelectItem value="stat">STAT</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                          <FormField control={labForm.control} name="notes" render={({ field }) => (
                            <FormItem><FormLabel>Notes (optional)</FormLabel>
                              <FormControl><Textarea rows={2} placeholder="Special instructions..." {...field} /></FormControl>
                            </FormItem>
                          )} />
                          <Button type="submit" className="w-full" disabled={createLabMutation.isPending}>
                            {createLabMutation.isPending ? "Creating..." : "Create Lab Request"}
                          </Button>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {todayLabs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">No lab requests today</p>
              ) : (
                <div className="space-y-2">
                  {todayLabs.map(l => {
                    const result = (l as any).result;
                    return (
                      <div key={l.id} className="text-xs p-2 rounded border bg-purple-50/50">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p className="font-semibold truncate">{l.testName}</p>
                          <span className={cn("shrink-0 px-1.5 py-0.5 rounded-full font-medium capitalize",
                            l.status === "completed" ? "bg-green-100 text-green-700" :
                            l.status === "in_progress" ? "bg-blue-100 text-blue-700" :
                            "bg-amber-100 text-amber-700"
                          )}>{l.status.replace(/_/g, " ")}</span>
                        </div>
                        <p className="text-muted-foreground capitalize">{l.testCategory} · <span className={l.urgency === "stat" ? "text-red-600 font-semibold" : l.urgency === "urgent" ? "text-orange-600 font-medium" : ""}>{l.urgency}</span></p>
                        {result && (
                          <p className="text-green-700 mt-1 line-clamp-2 italic">{result.resultText}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Completed Lab Results */}
          {completedLabs.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" /> Completed Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {completedLabs.map(l => {
                    const result = (l as any).result;
                    return (
                      <div key={l.id} className="text-xs rounded-lg border overflow-hidden">
                        <div className="flex items-center justify-between bg-purple-50/50 px-2 py-1.5">
                          <span className="font-semibold truncate">{l.testName}</span>
                          <span className="font-mono text-muted-foreground shrink-0 ml-2">{l.requestCode}</span>
                        </div>
                        <div className="px-2 py-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground capitalize">{l.testCategory}</span>
                            <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium capitalize">
                              {result.resultStatus ?? "final"}
                            </span>
                          </div>
                          <div className="bg-white rounded border p-1.5">
                            <p className="font-medium text-foreground whitespace-pre-line leading-relaxed">{result.resultText}</p>
                          </div>
                          {result.resultNotes && (
                            <p className="text-muted-foreground italic">{result.resultNotes}</p>
                          )}
                          <div className="flex items-center justify-between text-muted-foreground pt-0.5 border-t">
                            {result.technicianName && <span>Lab: {result.technicianName}</span>}
                            {result.resultCreatedAt && (
                              <span>{format(new Date(result.resultCreatedAt), "d MMM, h:mm a")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — consultation notes */}
        <div className="lg:col-span-2 space-y-4">
          {notesLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : !activeNoteId && !activeNote ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <Stethoscope className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="font-semibold text-lg">No Active Consultation</h3>
                <p className="text-muted-foreground text-sm mt-1 mb-6">Start a new consultation to record clinical findings.</p>
                {isDoctor && (
                  <Button onClick={startConsultation} disabled={createNoteMutation.isPending}>
                    <Stethoscope className="w-4 h-4 mr-2" />
                    {createNoteMutation.isPending ? "Starting..." : "Start Consultation"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-primary" /> Consultation Notes
                  </CardTitle>
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200 text-xs">In Progress</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <form className="space-y-4"
                  onChange={() => {
                    if (activeNoteId) handleAutoSave(noteForm.getValues());
                  }}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Chief Complaint</label>
                      <Input placeholder="Primary reason for visit..." {...noteForm.register("chiefComplaint")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Symptoms</label>
                      <Textarea rows={2} placeholder="Describe all reported symptoms..." {...noteForm.register("symptoms")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Diagnosis</label>
                      <Textarea rows={3} placeholder="Clinical findings and diagnosis..." {...noteForm.register("diagnosis")} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Treatment Plan</label>
                      <Textarea rows={3} placeholder="Treatment and procedures..." {...noteForm.register("treatmentPlan")} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Prescription Notes</label>
                      <Textarea rows={3} placeholder="Brief medication notes..." {...noteForm.register("prescription")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Follow-up Instructions</label>
                      <Textarea rows={2} placeholder="Patient instructions and next steps..." {...noteForm.register("followUpInstructions")} />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-sm font-medium">Additional Notes</label>
                      <Textarea rows={2} placeholder="Other clinical observations..." {...noteForm.register("notes")} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => saveNote(noteForm.getValues(), "pending_lab")}>
                        <FlaskConical className="w-3.5 h-3.5 mr-1" /> Pending Lab
                      </Button>
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => saveNote(noteForm.getValues(), "pending_pharmacy")}>
                        <Pill className="w-3.5 h-3.5 mr-1" /> Pending Pharmacy
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => saveNote(noteForm.getValues())} disabled={saving}>
                        <Save className="w-3.5 h-3.5 mr-1" /> Save
                      </Button>
                      <Button type="button" size="sm" className="bg-green-600 hover:bg-green-700"
                        onClick={() => saveNote(noteForm.getValues(), "completed")} disabled={saving}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" /> Complete Consultation
                      </Button>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Previous consultations */}
          {notes && notes.filter(n => n.id !== activeNoteId && n.status === "completed").length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Previous Consultations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {notes.filter(n => n.id !== activeNoteId && n.status === "completed").slice(0, 3).map(n => (
                    <div key={n.id} className="p-3 rounded-lg border text-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-muted-foreground">{(n as any).consultationCode ?? "—"} · Dr. {n.doctorName}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(n.createdAt), "MMM d, yyyy")}</span>
                      </div>
                      {n.chiefComplaint && <p className="font-medium">{n.chiefComplaint}</p>}
                      {n.diagnosis && <p className="text-muted-foreground text-xs">{n.diagnosis}</p>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
