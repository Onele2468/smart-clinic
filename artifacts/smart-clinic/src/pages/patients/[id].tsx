import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetPatient,
  useListConsultationNotes,
  useCreateConsultationNote,
  useListPrescriptions,
  useCreatePrescription,
  useUpdatePrescription,
  useListNurseAssessments,
  useListLabRequests,
  useCreateLabRequest,
  useListAppointments,
  getGetPatientQueryKey,
  getListConsultationNotesQueryKey,
  getListPrescriptionsQueryKey,
  getListNurseAssessmentsQueryKey,
  getListLabRequestsQueryKey,
  getListAppointmentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Phone, Mail, Calendar, Activity, Plus, Stethoscope, FileText, Pill, Heart, CreditCard, ShieldCheck, FlaskConical, Thermometer, Clock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const noteSchema = z.object({
  chiefComplaint: z.string().optional(),
  vitalSigns: z.string().optional(),
  diagnosis: z.string().optional(),
  prescription: z.string().optional(),
  treatmentPlan: z.string().optional(),
  followUpInstructions: z.string().optional(),
  notes: z.string().optional(),
});

const prescriptionSchema = z.object({
  medicationName: z.string().min(1, "Medication name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
});

const prescriptionStatusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  dispensed: "bg-blue-100 text-blue-800 border-blue-200",
  collected: "bg-purple-100 text-purple-800 border-purple-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const labRequestSchema = z.object({
  testName: z.string().min(1, "Test name is required"),
  testCategory: z.enum(["blood", "urine", "stool", "imaging", "swab", "other"]).default("blood"),
  urgency: z.enum(["routine", "urgent", "stat"]).default("routine"),
  notes: z.string().optional(),
});

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const role = clinicMembership?.role || "";

  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
  const [isLabRequestOpen, setIsLabRequestOpen] = useState(false);

  const { data: patient, isLoading } = useGetPatient(
    clinicId, id,
    { query: { enabled: !!clinicId && !!id, queryKey: getGetPatientQueryKey(clinicId, id) } }
  );

  const { data: notes, isLoading: notesLoading } = useListConsultationNotes(
    clinicId, id,
    { query: { enabled: !!clinicId && !!id, queryKey: getListConsultationNotesQueryKey(clinicId, id) } }
  );

  const { data: prescriptions, isLoading: prescriptionsLoading } = useListPrescriptions(
    clinicId, id,
    { query: { enabled: !!clinicId && !!id, queryKey: getListPrescriptionsQueryKey(clinicId, id) } }
  );

  const { data: assessments } = useListNurseAssessments(
    clinicId, id,
    { query: { enabled: !!clinicId && !!id, queryKey: getListNurseAssessmentsQueryKey(clinicId, id) } }
  );

  const { data: labRequests, isLoading: labLoading } = useListLabRequests(
    clinicId, id,
    { query: { enabled: !!clinicId && !!id, queryKey: getListLabRequestsQueryKey(clinicId, id) } }
  );

  const { data: appointments } = useListAppointments(
    clinicId, {},
    { query: { enabled: !!clinicId && !!id, queryKey: getListAppointmentsQueryKey(clinicId, {}) } }
  );

  const patientAppointments = useMemo(
    () => (appointments ?? []).filter(a => a.patientId === id),
    [appointments, id]
  );

  // Build merged EMR timeline
  const emrTimeline = useMemo(() => {
    const events: Array<{ type: string; date: string; data: any }> = [];
    (notes ?? []).forEach(n => events.push({ type: "consultation", date: n.createdAt, data: n }));
    (prescriptions ?? []).forEach(p => events.push({ type: "prescription", date: p.createdAt, data: p }));
    (labRequests ?? []).forEach(l => events.push({ type: "lab", date: l.createdAt, data: l }));
    (assessments ?? []).forEach(a => events.push({ type: "assessment", date: a.createdAt, data: a }));
    patientAppointments.forEach(a => events.push({ type: "appointment", date: a.scheduledAt, data: a }));
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [notes, prescriptions, labRequests, assessments, patientAppointments]);

  const createNoteMutation = useCreateConsultationNote();
  const createPrescriptionMutation = useCreatePrescription();
  const updatePrescriptionMutation = useUpdatePrescription();
  const createLabRequestMutation = useCreateLabRequest();

  const noteForm = useForm<z.infer<typeof noteSchema>>({
    resolver: zodResolver(noteSchema),
    defaultValues: { chiefComplaint: "", vitalSigns: "", diagnosis: "", prescription: "", treatmentPlan: "", followUpInstructions: "", notes: "" },
  });

  const rxForm = useForm<z.infer<typeof prescriptionSchema>>({
    resolver: zodResolver(prescriptionSchema),
    defaultValues: { medicationName: "", dosage: "", frequency: "", duration: "", instructions: "" },
  });

  const labForm = useForm<z.infer<typeof labRequestSchema>>({
    resolver: zodResolver(labRequestSchema),
    defaultValues: { testName: "", testCategory: "blood", urgency: "routine", notes: "" },
  });

  const onSubmitNote = async (values: z.infer<typeof noteSchema>) => {
    try {
      await createNoteMutation.mutateAsync({ clinicId, patientId: id, data: values });
      queryClient.invalidateQueries({ queryKey: getListConsultationNotesQueryKey(clinicId, id) });
      toast({ title: "Consultation note saved" });
      setIsNoteOpen(false);
      noteForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to save note", description: error?.message });
    }
  };

  const onSubmitPrescription = async (values: z.infer<typeof prescriptionSchema>) => {
    try {
      await createPrescriptionMutation.mutateAsync({ clinicId, patientId: id, data: values });
      queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey(clinicId, id) });
      toast({ title: "Prescription issued successfully" });
      setIsPrescriptionOpen(false);
      rxForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to issue prescription", description: error?.message });
    }
  };

  const handleUpdatePrescriptionStatus = async (prescriptionId: string, status: string) => {
    try {
      await updatePrescriptionMutation.mutateAsync({ clinicId, patientId: id, prescriptionId, data: { status: status as any } });
      queryClient.invalidateQueries({ queryKey: getListPrescriptionsQueryKey(clinicId, id) });
      toast({ title: "Prescription updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to update prescription", description: error?.message });
    }
  };

  const onSubmitLabRequest = async (values: z.infer<typeof labRequestSchema>) => {
    try {
      await createLabRequestMutation.mutateAsync({ clinicId, patientId: id, data: values });
      queryClient.invalidateQueries({ queryKey: getListLabRequestsQueryKey(clinicId, id) });
      toast({ title: "Lab request created successfully" });
      setIsLabRequestOpen(false);
      labForm.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Failed to create lab request", description: error?.message });
    }
  };

  const canAddNotes = ["doctor", "clinic_admin"].includes(role);
  const canAddPrescriptions = ["doctor", "clinic_admin"].includes(role);
  const canOrderLab = ["doctor", "clinic_admin"].includes(role);

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
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
        <Button variant="link" asChild className="mt-4">
          <Link href="/patients">Back to patients</Link>
        </Button>
      </div>
    );
  }

  const patientDetail = patient as any;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/patients"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Patients</Link>
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{patient.firstName} {patient.lastName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="font-mono">{patient.patientCode}</Badge>
              <Badge variant={patient.status === "active" ? "default" : "secondary"}>{patient.status}</Badge>
              <span className="text-sm text-muted-foreground capitalize">{patient.gender} · {patient.dateOfBirth}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canAddNotes && (
            <Dialog open={isNoteOpen} onOpenChange={setIsNoteOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Add Note</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Consultation Note</DialogTitle>
                </DialogHeader>
                <Form {...noteForm}>
                  <form onSubmit={noteForm.handleSubmit(onSubmitNote)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField control={noteForm.control} name="chiefComplaint" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Chief Complaint</FormLabel>
                          <FormControl><Input placeholder="Reason for visit..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={noteForm.control} name="vitalSigns" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Vital Signs</FormLabel>
                          <FormControl><Input placeholder="BP: 120/80, HR: 72, Temp: 37°C..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={noteForm.control} name="diagnosis" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Diagnosis</FormLabel>
                          <FormControl><Textarea rows={2} placeholder="Clinical findings and diagnosis..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={noteForm.control} name="prescription" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prescription (brief)</FormLabel>
                          <FormControl><Textarea rows={3} placeholder="Medications prescribed..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={noteForm.control} name="treatmentPlan" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Treatment Plan</FormLabel>
                          <FormControl><Textarea rows={3} placeholder="Treatment and procedures..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={noteForm.control} name="followUpInstructions" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Follow-up Instructions</FormLabel>
                          <FormControl><Textarea rows={2} placeholder="Patient instructions and next steps..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={noteForm.control} name="notes" render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Additional Notes</FormLabel>
                          <FormControl><Textarea rows={2} placeholder="Any other clinical notes..." {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <Button type="submit" className="w-full" disabled={createNoteMutation.isPending}>
                      {createNoteMutation.isPending ? "Saving..." : "Save Consultation Note"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}

          {canOrderLab && (
            <Dialog open={isLabRequestOpen} onOpenChange={setIsLabRequestOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><FlaskConical className="w-4 h-4 mr-2" /> Request Lab</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>New Lab Request</DialogTitle>
                </DialogHeader>
                <Form {...labForm}>
                  <form onSubmit={labForm.handleSubmit(onSubmitLabRequest)} className="space-y-4">
                    <FormField control={labForm.control} name="testName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Test Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Full Blood Count, HbA1c..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={labForm.control} name="testCategory" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
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
                        <FormItem>
                          <FormLabel>Urgency</FormLabel>
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
                      <FormItem>
                        <FormLabel>Notes (optional)</FormLabel>
                        <FormControl><Textarea rows={2} placeholder="Clinical notes or special instructions..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <Button type="submit" className="w-full" disabled={createLabRequestMutation.isPending}>
                      {createLabRequestMutation.isPending ? "Requesting..." : "Create Lab Request"}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}

          {canAddPrescriptions && (
            <Dialog open={isPrescriptionOpen} onOpenChange={setIsPrescriptionOpen}>
              <DialogTrigger asChild>
                <Button><Pill className="w-4 h-4 mr-2" /> Issue Prescription</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Issue Prescription</DialogTitle>
                </DialogHeader>
                <Form {...rxForm}>
                  <form onSubmit={rxForm.handleSubmit(onSubmitPrescription)} className="space-y-4">
                    <FormField control={rxForm.control} name="medicationName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medication Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Amoxicillin 500mg" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={rxForm.control} name="dosage" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dosage</FormLabel>
                          <FormControl><Input placeholder="e.g. 500mg" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={rxForm.control} name="frequency" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Frequency</FormLabel>
                          <FormControl><Input placeholder="e.g. Twice daily" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <FormField control={rxForm.control} name="duration" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration</FormLabel>
                        <FormControl><Input placeholder="e.g. 7 days" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={rxForm.control} name="instructions" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Instructions (optional)</FormLabel>
                        <FormControl><Textarea rows={2} placeholder="e.g. Take with food, avoid alcohol..." {...field} /></FormControl>
                        <FormMessage />
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
      </div>

      <Tabs defaultValue="emr">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="emr">EMR Timeline</TabsTrigger>
          <TabsTrigger value="info">Patient Info</TabsTrigger>
          <TabsTrigger value="prescriptions">
            Prescriptions
            {prescriptions && prescriptions.length > 0 && (
              <Badge variant="secondary" className="ml-2">{prescriptions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="notes">
            Consultation Notes
            {notes && notes.length > 0 && <Badge variant="secondary" className="ml-2">{notes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="assessments">
            Nurse Assessments
            {assessments && assessments.length > 0 && <Badge variant="secondary" className="ml-2">{assessments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="lab">
            Lab Requests
            {labRequests && labRequests.length > 0 && <Badge variant="secondary" className="ml-2">{labRequests.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emr" className="mt-4">
          {emrTimeline.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No medical records yet</p>
                <p className="text-sm mt-1">Clinical events will appear here as the patient is seen.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative">
              <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4">
                {emrTimeline.map((event, idx) => {
                  const { type, date, data } = event;
                  const typeConfig = {
                    consultation: { icon: Stethoscope, color: "bg-blue-100 text-blue-700 border-blue-200", label: "Consultation" },
                    prescription: { icon: Pill, color: "bg-green-100 text-green-700 border-green-200", label: "Prescription" },
                    lab: { icon: FlaskConical, color: "bg-purple-100 text-purple-700 border-purple-200", label: "Lab Request" },
                    assessment: { icon: Activity, color: "bg-orange-100 text-orange-700 border-orange-200", label: "Nurse Assessment" },
                    appointment: { icon: Calendar, color: "bg-slate-100 text-slate-700 border-slate-200", label: "Appointment" },
                  }[type] ?? { icon: FileText, color: "bg-muted text-muted-foreground", label: type };

                  const Icon = typeConfig.icon;

                  return (
                    <div key={`${type}-${data.id}-${idx}`} className="relative flex gap-4 pl-10">
                      <div className={cn("absolute left-2.5 -translate-x-1/2 h-6 w-6 rounded-full border-2 bg-white flex items-center justify-center z-10", typeConfig.color)}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Card className="border shadow-none">
                          <CardContent className="py-3 px-4">
                            <div className="flex items-start justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={cn("text-xs", typeConfig.color)}>{typeConfig.label}</Badge>
                                {type === "consultation" && data.chiefComplaint && (
                                  <span className="text-sm font-semibold">{data.chiefComplaint}</span>
                                )}
                                {type === "prescription" && (
                                  <span className="text-sm font-semibold">{data.medicationName} · {data.dosage}</span>
                                )}
                                {type === "lab" && (
                                  <span className="text-sm font-semibold">{data.testName}
                                    <span className={cn("ml-1.5 text-xs", data.urgency === "stat" ? "text-red-600 font-bold" : data.urgency === "urgent" ? "text-orange-600 font-semibold" : "text-muted-foreground")}>
                                      ({data.urgency})
                                    </span>
                                  </span>
                                )}
                                {type === "assessment" && data.triageLevel && (
                                  <Badge variant="outline" className={cn("text-xs", data.triageLevel === "critical" ? "border-red-400 text-red-700 bg-red-50" : data.triageLevel === "urgent" ? "border-orange-400 text-orange-700 bg-orange-50" : "border-green-400 text-green-700 bg-green-50")}>
                                    {data.triageLevel.replace("_", " ").toUpperCase()}
                                  </Badge>
                                )}
                                {type === "appointment" && (
                                  <span className="text-sm font-semibold capitalize">{data.type?.replace("_", " ")} · Dr. {data.doctorName}</span>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground shrink-0">{format(new Date(date), "MMM d, yyyy · h:mm a")}</span>
                            </div>

                            {type === "consultation" && (
                              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                {data.diagnosis && <p><span className="font-medium text-foreground">Dx:</span> {data.diagnosis}</p>}
                                {data.prescription && <p><span className="font-medium text-foreground">Rx:</span> {data.prescription}</p>}
                                {data.doctorName && <p className="text-xs">Dr. {data.doctorName}</p>}
                              </div>
                            )}
                            {type === "prescription" && (
                              <p className="mt-1 text-xs text-muted-foreground">{data.frequency} for {data.duration} · {data.status}</p>
                            )}
                            {type === "lab" && (
                              <p className="mt-1 text-xs text-muted-foreground capitalize">{data.testCategory} · Status: {data.status?.replace("_", " ")}</p>
                            )}
                            {type === "assessment" && (
                              <div className="mt-2 flex gap-2 flex-wrap text-xs">
                                {data.bloodPressure && <span className="bg-muted px-2 py-0.5 rounded">BP: {data.bloodPressure}</span>}
                                {data.pulseRate && <span className="bg-muted px-2 py-0.5 rounded">HR: {data.pulseRate}</span>}
                                {data.temperature && <span className="bg-muted px-2 py-0.5 rounded">Temp: {data.temperature}°C</span>}
                                {data.oxygenSaturation && <span className="bg-muted px-2 py-0.5 rounded">SpO₂: {data.oxygenSaturation}%</span>}
                              </div>
                            )}
                            {type === "appointment" && data.visitReason && (
                              <p className="mt-1 text-xs text-muted-foreground italic">"{data.visitReason}"</p>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Personal Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Date of Birth</p>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {patient.dateOfBirth}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Gender</p>
                    <p className="text-sm capitalize">{patient.gender}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Contact Number</p>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {patient.contactNumber}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Email</p>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      {patient.email || "—"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Address</p>
                    <p className="text-sm">{patientDetail.address || "—"}</p>
                  </div>
                  {patientDetail.governmentIdType && (
                    <div className="col-span-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Government ID</p>
                      <div className="flex items-center gap-1.5 text-sm">
                        <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{patientDetail.governmentIdType}:</span>
                        <span className="font-mono">{patientDetail.governmentIdNumber || "—"}</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Heart className="h-4 w-4 text-red-500" /> Medical Overview
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Blood Type</p>
                    <div className="inline-flex items-center font-bold text-red-600 bg-red-50 dark:bg-red-900/20 px-2.5 py-1 rounded text-sm">
                      {patient.bloodType || "Unknown"}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Allergies</p>
                    <p className="text-sm bg-muted p-2 rounded border">{patient.allergies || "None recorded"}</p>
                  </div>
                  {patientDetail.chronicConditions && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Chronic Conditions</p>
                      <p className="text-sm bg-orange-50 dark:bg-orange-900/20 p-2 rounded border border-orange-100">{patientDetail.chronicConditions}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Emergency Contact</p>
                    <p className="text-sm font-medium">{patientDetail.emergencyContactName || "—"}</p>
                    {patientDetail.emergencyContactPhone && (
                      <p className="text-xs text-muted-foreground">{patientDetail.emergencyContactPhone}</p>
                    )}
                  </div>
                  {patientDetail.recentVisits !== undefined && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Completed Visits</p>
                      <p className="text-sm font-bold">{patientDetail.recentVisits}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {(patientDetail.medicalAidName || patientDetail.medicalAidNumber) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-500" /> Medical Aid
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {patientDetail.medicalAidName && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Provider</p>
                        <p className="text-sm font-semibold">{patientDetail.medicalAidName}</p>
                      </div>
                    )}
                    {patientDetail.medicalAidNumber && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">Member Number</p>
                        <p className="text-sm font-mono">{patientDetail.medicalAidNumber}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {(patientDetail.notes || patientDetail.medicalHistory) && (
              <Card className="md:col-span-3">
                <CardHeader>
                  <CardTitle className="text-base">Medical History & Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patientDetail.medicalHistory && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Medical History</p>
                      <p className="text-sm whitespace-pre-wrap">{patientDetail.medicalHistory}</p>
                    </div>
                  )}
                  {patientDetail.notes && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">General Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{patientDetail.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-4">
          {prescriptionsLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
            </div>
          ) : !prescriptions?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Pill className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No prescriptions issued yet</p>
                {canAddPrescriptions && (
                  <p className="text-sm mt-1">Click "Issue Prescription" to create the first prescription.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {prescriptions.map(rx => (
                <Card key={rx.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-base">{rx.medicationName}</span>
                          <Badge variant="outline" className="font-mono text-xs">{rx.prescriptionCode}</Badge>
                          <Badge className={`text-xs border ${prescriptionStatusColors[rx.status] ?? ""}`}>
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
                          <p className="text-sm text-muted-foreground bg-muted rounded p-2">{rx.instructions}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Prescribed by Dr. {rx.doctorName ?? "Unknown"} · {format(new Date(rx.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      {rx.status === "active" && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button size="sm" variant="outline" onClick={() => handleUpdatePrescriptionStatus(rx.id, "dispensed")}>
                            Mark Dispensed
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleUpdatePrescriptionStatus(rx.id, "cancelled")}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          {notesLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => <Skeleton key={i} className="h-40 w-full" />)}
            </div>
          ) : !notes?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Stethoscope className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No consultation notes yet</p>
                {canAddNotes && (
                  <p className="text-sm mt-1">Click "Add Note" to record the first consultation.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {notes.map(note => (
                <Card key={note.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">Dr. {note.doctorName ?? "Unknown"}</CardTitle>
                        <CardDescription className="text-xs">
                          {format(new Date(note.createdAt), "MMMM d, yyyy · h:mm a")}
                        </CardDescription>
                      </div>
                      {note.chiefComplaint && (
                        <Badge variant="outline" className="text-xs">{note.chiefComplaint}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {note.vitalSigns && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Activity className="h-3 w-3" /> Vital Signs
                        </p>
                        <p className="bg-muted rounded p-2">{note.vitalSigns}</p>
                      </div>
                    )}
                    {note.diagnosis && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Diagnosis
                        </p>
                        <p className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">{note.diagnosis}</p>
                      </div>
                    )}
                    {note.prescription && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                          <Pill className="h-3 w-3" /> Prescription Notes
                        </p>
                        <p className="bg-green-50 dark:bg-green-900/20 rounded p-2 whitespace-pre-wrap">{note.prescription}</p>
                      </div>
                    )}
                    {note.treatmentPlan && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Treatment Plan</p>
                        <p className="bg-muted rounded p-2">{note.treatmentPlan}</p>
                      </div>
                    )}
                    {note.followUpInstructions && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Follow-up Instructions</p>
                        <p className="bg-amber-50 dark:bg-amber-900/20 rounded p-2">{note.followUpInstructions}</p>
                      </div>
                    )}
                    {note.notes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Additional Notes</p>
                        <p className="text-muted-foreground">{note.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="assessments" className="mt-4">
          {!assessments?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Thermometer className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No nurse assessments recorded yet</p>
                <p className="text-sm mt-1">Vitals and triage are recorded by nurses during the queue.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {assessments.map(assessment => (
                <Card key={assessment.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          Nurse Assessment — {assessment.nurseName ?? "Unknown"}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {format(new Date(assessment.createdAt), "MMMM d, yyyy · h:mm a")}
                        </CardDescription>
                      </div>
                      {assessment.triageLevel && (
                        <Badge variant="outline" className={`text-xs capitalize ${
                          assessment.triageLevel === "emergency" ? "border-red-400 text-red-700 bg-red-50" :
                          assessment.triageLevel === "urgent" ? "border-amber-400 text-amber-700 bg-amber-50" :
                          "border-green-400 text-green-700 bg-green-50"
                        }`}>
                          {assessment.triageLevel.replace("_", " ")}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                      {assessment.bloodPressure && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Blood Pressure</p>
                          <p className="text-sm font-semibold">{assessment.bloodPressure}</p>
                        </div>
                      )}
                      {assessment.pulseRate && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Pulse Rate</p>
                          <p className="text-sm font-semibold">{assessment.pulseRate} bpm</p>
                        </div>
                      )}
                      {assessment.temperature && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Temperature</p>
                          <p className="text-sm font-semibold">{assessment.temperature} °C</p>
                        </div>
                      )}
                      {assessment.oxygenSaturation && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">SpO₂</p>
                          <p className="text-sm font-semibold">{assessment.oxygenSaturation}%</p>
                        </div>
                      )}
                      {assessment.weight && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Weight</p>
                          <p className="text-sm font-semibold">{assessment.weight} kg</p>
                        </div>
                      )}
                      {assessment.height && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Height</p>
                          <p className="text-sm font-semibold">{assessment.height} cm</p>
                        </div>
                      )}
                      {assessment.bloodSugar && (
                        <div className="bg-muted rounded-lg px-3 py-2">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Blood Sugar</p>
                          <p className="text-sm font-semibold">{assessment.bloodSugar} mmol/L</p>
                        </div>
                      )}
                    </div>
                    {assessment.symptoms && (
                      <div className="mb-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Chief Symptoms</p>
                        <p className="text-sm bg-muted rounded p-2">{assessment.symptoms}</p>
                      </div>
                    )}
                    {assessment.triageNotes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Triage Notes</p>
                        <p className="text-sm text-muted-foreground">{assessment.triageNotes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lab" className="mt-4">
          {labLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full" />)}
            </div>
          ) : !labRequests?.length ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FlaskConical className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No lab requests yet</p>
                {canOrderLab && (
                  <p className="text-sm mt-1">Click "Request Lab" to order a laboratory test.</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {labRequests.map(req => (
                <Card key={req.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{req.testName}</span>
                          <Badge variant="outline" className="font-mono text-xs">{req.requestCode}</Badge>
                          <Badge variant="secondary" className="text-xs capitalize">{req.testCategory}</Badge>
                          <Badge className={`text-xs capitalize ${
                            req.urgency === "stat" ? "bg-red-100 text-red-800" :
                            req.urgency === "urgent" ? "bg-amber-100 text-amber-800" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {req.urgency}
                          </Badge>
                          <Badge className={`text-xs ${
                            req.status === "completed" ? "bg-green-100 text-green-800" :
                            req.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                            "bg-amber-100 text-amber-800"
                          }`}>
                            {req.status.replace("_", " ")}
                          </Badge>
                        </div>
                        {req.notes && (
                          <p className="text-xs text-muted-foreground bg-muted rounded px-2 py-1">{req.notes}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Ordered by Dr. {req.doctorName ?? "Unknown"} · {format(new Date(req.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
