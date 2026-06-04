import React, { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListAppointments,
  useCreateAppointment,
  useCancelAppointment,
  useUpdateAppointment,
  useListPatients,
  useListClinicDoctors,
  AppointmentInputType,
  getListAppointmentsQueryKey,
  getListPatientsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, parseISO } from "date-fns";
import {
  Calendar as CalendarIcon, Check, ChevronsUpDown, Clock, Plus, User,
  LogIn, ChevronLeft, ChevronRight, List, CalendarDays, Stethoscope, XCircle, CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800 border-blue-200" },
  confirmed: { label: "Confirmed", color: "bg-purple-100 text-purple-800 border-purple-200" },
  checked_in: { label: "Checked In", color: "bg-amber-100 text-amber-800 border-amber-200" },
  waiting: { label: "Waiting", color: "bg-orange-100 text-orange-800 border-orange-200" },
  in_consultation: { label: "In Consultation", color: "bg-green-100 text-green-800 border-green-200" },
  completed: { label: "Completed", color: "bg-slate-100 text-slate-800 border-slate-200" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800 border-red-200" },
  no_show: { label: "No Show", color: "bg-gray-100 text-gray-800 border-gray-200" },
};

const createAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  scheduledAt: z.string().min(1, "Date and time are required"),
  type: z.nativeEnum(AppointmentInputType),
  visitReason: z.string().optional(),
  durationMinutes: z.coerce.number().min(5).default(30),
  notes: z.string().optional(),
});

function ComboboxField({
  value, onChange, options, placeholder, searchPlaceholder, emptyText,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string; sub?: string }[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selected ? (
            <span>{selected.label}{selected.sub && <span className="text-muted-foreground text-xs ml-1">({selected.sub})</span>}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(opt => (
                <CommandItem key={opt.value} value={opt.label} onSelect={() => { onChange(opt.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <div>
                    <p className="text-sm font-medium">{opt.label}</p>
                    {opt.sub && <p className="text-xs text-muted-foreground">{opt.sub}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function AppointmentCard({ apt, onCheckin, onStatus, onCancel, role }: {
  apt: any;
  onCheckin: (id: string) => void;
  onStatus: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  role: string;
}) {
  const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
  const canManage = ["clinic_admin", "doctor", "receptionist"].includes(role);
  const canConsult = ["clinic_admin", "doctor"].includes(role);

  return (
    <div className="flex items-start justify-between p-4 hover:bg-muted/30 transition-colors border-b last:border-0 gap-4">
      <div className="flex items-start gap-4">
        <div className={cn("h-12 w-12 rounded-lg flex flex-col items-center justify-center shrink-0 font-semibold",
          isToday(new Date(apt.scheduledAt)) ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
        )}>
          <span className="text-xs uppercase">{format(new Date(apt.scheduledAt), "MMM")}</span>
          <span className="text-lg leading-none">{format(new Date(apt.scheduledAt), "d")}</span>
        </div>
        <div className="flex-1 min-w-0">
          <Link href={`/patients/${apt.patientId}`}>
            <p className="font-semibold text-sm hover:underline cursor-pointer">{apt.patientName}</p>
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(apt.scheduledAt), "h:mm a")}</span>
            <span>·</span>
            <span className="flex items-center gap-1"><User className="w-3 h-3" />Dr. {apt.doctorName}</span>
            <span>·</span>
            <span className="capitalize">{apt.type.replace("_", " ")}</span>
            <span>·</span>
            <span>{apt.durationMinutes} min</span>
          </div>
          {apt.visitReason && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{apt.visitReason}"</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
        <Badge variant="outline" className={cn("text-xs", cfg.color)}>{cfg.label}</Badge>
        {canManage && apt.status === "scheduled" && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onCheckin(apt.id)}>
            <LogIn className="w-3 h-3 mr-1" /> Check In
          </Button>
        )}
        {canConsult && apt.status === "checked_in" && (
          <Button size="sm" className="h-7 text-xs" asChild>
            <Link href={`/consultations/${apt.patientId}?appointmentId=${apt.id}`}>
              <Stethoscope className="w-3 h-3 mr-1" /> Consult
            </Link>
          </Button>
        )}
        {canManage && ["checked_in", "in_consultation"].includes(apt.status) && (
          <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
            onClick={() => onStatus(apt.id, "completed")}>
            <CheckCircle className="w-3 h-3 mr-1" /> Complete
          </Button>
        )}
        {canManage && !["cancelled", "completed", "no_show"].includes(apt.status) && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onCancel(apt.id)}>
            <XCircle className="w-3 h-3 mr-1" /> Cancel
          </Button>
        )}
      </div>
    </div>
  );
}

function WeekCalendar({ appointments, weekStart, onCheckin, onStatus, onCancel, role }: {
  appointments: any[];
  weekStart: Date;
  onCheckin: (id: string) => void;
  onStatus: (id: string, status: string) => void;
  onCancel: (id: string) => void;
  role: string;
}) {
  const days = eachDayOfInterval({ start: weekStart, end: endOfWeek(weekStart, { weekStartsOn: 1 }) });

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px] grid grid-cols-7 border rounded-lg overflow-hidden">
        {days.map(day => {
          const dayApts = appointments.filter(a => isSameDay(new Date(a.scheduledAt), day));
          return (
            <div key={day.toISOString()} className={cn("border-r last:border-0 min-h-[200px]", isToday(day) && "bg-primary/5")}>
              <div className={cn("px-2 py-2 text-center border-b text-xs font-semibold", isToday(day) ? "text-primary" : "text-muted-foreground")}>
                <div className="uppercase">{format(day, "EEE")}</div>
                <div className={cn("mt-0.5 mx-auto w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold",
                  isToday(day) ? "bg-primary text-primary-foreground" : ""
                )}>{format(day, "d")}</div>
              </div>
              <div className="p-1 space-y-1">
                {dayApts.map(apt => {
                  const cfg = STATUS_CONFIG[apt.status] ?? STATUS_CONFIG.scheduled;
                  return (
                    <div key={apt.id} className={cn("rounded px-2 py-1.5 text-xs border", cfg.color)}>
                      <p className="font-semibold truncate">{apt.patientName}</p>
                      <p className="text-[10px] opacity-80">{format(new Date(apt.scheduledAt), "h:mm a")} · Dr. {apt.doctorName}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {apt.status === "scheduled" && ["clinic_admin", "doctor", "receptionist"].includes(role) && (
                          <button onClick={() => onCheckin(apt.id)}
                            className="text-[10px] px-1.5 py-0.5 bg-white/70 rounded border border-current font-medium hover:bg-white">
                            Check In
                          </button>
                        )}
                        {apt.status === "checked_in" && ["clinic_admin", "doctor"].includes(role) && (
                          <Link href={`/consultations/${apt.patientId}?appointmentId=${apt.id}`}>
                            <button className="text-[10px] px-1.5 py-0.5 bg-white/70 rounded border border-current font-medium hover:bg-white">
                              Consult
                            </button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Appointments() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId || "";
  const role = clinicMembership?.role || "";

  const [viewMode, setViewMode] = useState<"list" | "week">("list");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const queryDate = viewMode === "week" ? undefined : (dateFilter || undefined);
  const queryStatus = statusFilter === "__all__" ? undefined : statusFilter;

  const { data: appointments, isLoading } = useListAppointments(
    clinicId,
    { date: queryDate, status: queryStatus },
    { query: { enabled: !!clinicId, queryKey: getListAppointmentsQueryKey(clinicId, { date: queryDate, status: queryStatus }) } }
  );

  const { data: patients } = useListPatients(
    clinicId, {},
    { query: { enabled: !!clinicId && isDialogOpen, queryKey: getListPatientsQueryKey(clinicId, {}) } }
  );

  const { data: doctors } = useListClinicDoctors(
    clinicId,
    { query: { enabled: !!clinicId && isDialogOpen, queryKey: ["listClinicDoctors", clinicId] } }
  );

  const patientOptions = useMemo(() =>
    (patients ?? []).map(p => ({ value: p.id, label: `${p.firstName} ${p.lastName}`, sub: p.patientCode })),
    [patients]
  );

  const doctorOptions = useMemo(() =>
    (doctors ?? []).map(d => ({ value: d.id, label: d.name, sub: d.staffCode ?? d.role })),
    [doctors]
  );

  const createMutation = useCreateAppointment();
  const cancelMutation = useCancelAppointment();
  const updateMutation = useUpdateAppointment();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey(clinicId) });
  };

  const form = useForm<z.infer<typeof createAppointmentSchema>>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: {
      patientId: "", doctorId: "",
      scheduledAt: new Date().toISOString().slice(0, 16),
      type: "consultation", durationMinutes: 30,
      visitReason: "", notes: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof createAppointmentSchema>) => {
    try {
      await createMutation.mutateAsync({ clinicId, data: values as any });
      invalidate();
      toast({ title: "Appointment booked successfully" });
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Booking failed", description: error?.message });
    }
  };

  const handleCheckin = async (appointmentId: string) => {
    try {
      await updateMutation.mutateAsync({ clinicId, appointmentId, data: { status: "checked_in" as any } });
      invalidate();
      toast({ title: "Patient checked in" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Check-in failed", description: error?.message });
    }
  };

  const handleStatus = async (appointmentId: string, status: string) => {
    try {
      await updateMutation.mutateAsync({ clinicId, appointmentId, data: { status: status as any } });
      invalidate();
      toast({ title: `Appointment marked as ${status.replace("_", " ")}` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update failed", description: error?.message });
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (!confirm("Cancel this appointment?")) return;
    try {
      await cancelMutation.mutateAsync({ clinicId, appointmentId });
      invalidate();
      toast({ title: "Appointment cancelled" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Cancellation failed", description: error?.message });
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const stats = useMemo(() => {
    const all = appointments ?? [];
    return {
      total: all.length,
      scheduled: all.filter(a => a.status === "scheduled").length,
      checkedIn: all.filter(a => ["checked_in", "waiting"].includes(a.status)).length,
      inConsult: all.filter(a => a.status === "in_consultation").length,
      completed: all.filter(a => a.status === "completed").length,
    };
  }, [appointments]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage scheduled visits and patient check-ins.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="btn-book-appointment"><Plus className="w-4 h-4 mr-2" /> Book Appointment</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Book Appointment</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="patientId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <FormControl>
                      <ComboboxField value={field.value} onChange={field.onChange}
                        options={patientOptions} placeholder="Search patient..." searchPlaceholder="Type name or code..." emptyText="No patients found." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="doctorId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Doctor</FormLabel>
                    <FormControl>
                      <ComboboxField value={field.value} onChange={field.onChange}
                        options={doctorOptions} placeholder="Select doctor..." searchPlaceholder="Search doctors..." emptyText="No doctors found." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="scheduledAt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="consultation">Consultation</SelectItem>
                          <SelectItem value="follow_up">Follow Up</SelectItem>
                          <SelectItem value="procedure">Procedure</SelectItem>
                          <SelectItem value="checkup">Checkup</SelectItem>
                          <SelectItem value="walk_in">Walk-In</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="durationMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (min)</FormLabel>
                      <FormControl><Input type="number" min={5} step={5} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="visitReason" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visit Reason</FormLabel>
                    <FormControl><Input placeholder="e.g. Follow-up for hypertension..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl><Textarea rows={2} placeholder="Additional notes..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Booking..." : "Book Appointment"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, color: "text-foreground" },
          { label: "Scheduled", value: stats.scheduled, color: "text-blue-600" },
          { label: "Checked In", value: stats.checkedIn, color: "text-amber-600" },
          { label: "In Consultation", value: stats.inConsult, color: "text-green-600" },
          { label: "Completed", value: stats.completed, color: "text-slate-600" },
        ].map(s => (
          <Card key={s.label} className="py-3 px-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn("text-2xl font-bold mt-0.5", s.color)}>{s.value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Button variant={viewMode === "list" ? "default" : "outline"} size="sm"
                onClick={() => setViewMode("list")} className="gap-1.5">
                <List className="w-4 h-4" /> List
              </Button>
              <Button variant={viewMode === "week" ? "default" : "outline"} size="sm"
                onClick={() => setViewMode("week")} className="gap-1.5">
                <CalendarDays className="w-4 h-4" /> Week
              </Button>
            </div>

            {viewMode === "list" ? (
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => setDateFilter(todayStr)} className="text-xs">Today</Button>
                <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-[160px] h-8 text-sm" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="checked_in">Checked In</SelectItem>
                    <SelectItem value="in_consultation">In Consultation</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="no_show">No Show</SelectItem>
                  </SelectContent>
                </Select>
                {(dateFilter || statusFilter !== "__all__") && (
                  <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setDateFilter(""); setStatusFilter("__all__"); }}>Clear</Button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setWeekStart(w => {
                  const d = new Date(w); d.setDate(d.getDate() - 7); return d;
                })}><ChevronLeft className="w-4 h-4" /></Button>
                <span className="text-sm font-medium min-w-[180px] text-center">
                  {format(weekStart, "MMM d")} – {format(endOfWeek(weekStart, { weekStartsOn: 1 }), "MMM d, yyyy")}
                </span>
                <Button variant="outline" size="sm" onClick={() => setWeekStart(w => {
                  const d = new Date(w); d.setDate(d.getDate() + 7); return d;
                })}><ChevronRight className="w-4 h-4" /></Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
                  This Week
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : viewMode === "week" ? (
            <WeekCalendar
              appointments={appointments ?? []}
              weekStart={weekStart}
              onCheckin={handleCheckin}
              onStatus={handleStatus}
              onCancel={handleCancel}
              role={role}
            />
          ) : appointments?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
              <CalendarIcon className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="font-medium">No appointments found</p>
              <p className="text-sm mt-1">Try changing your filters or book a new appointment.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              {appointments?.map(apt => (
                <AppointmentCard key={apt.id} apt={apt} onCheckin={handleCheckin} onStatus={handleStatus} onCancel={handleCancel} role={role} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
