import React, { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useGetMyClinic, useUpdateClinic, getGetMyClinicQueryKey } from "@workspace/api-client-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Copy, Building2, Receipt, MessageCircle, Bell, CalendarClock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const BASE = import.meta.env.BASE_URL;
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}`, ...opts?.headers },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Request failed"); return d; });

const updateClinicSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  address: z.string().min(5, { message: "Address is required" }),
  city: z.string().min(2, { message: "City is required" }),
  province: z.string().min(2, { message: "Province is required" }),
  contactNumber: z.string().min(5, { message: "Contact number is required" }),
  email: z.string().email({ message: "Valid email is required" }),
});

export default function Settings() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: clinic, isLoading } = useGetMyClinic({ query: { enabled: !!clinicMembership?.clinicId, queryKey: getGetMyClinicQueryKey() } });
  const updateClinicMutation = useUpdateClinic();
  const isAdmin = clinicMembership?.role === 'clinic_admin';

  const form = useForm<z.infer<typeof updateClinicSchema>>({
    resolver: zodResolver(updateClinicSchema),
    defaultValues: {
      name: "",
      address: "",
      city: "",
      province: "",
      contactNumber: "",
      email: "",
    },
  });

  const initialized = useRef(false);

  useEffect(() => {
    if (clinic && !initialized.current) {
      form.reset({
        name: clinic.name || "",
        address: clinic.address || "",
        city: clinic.city || "",
        province: clinic.province || "",
        contactNumber: clinic.contactNumber || "",
        email: clinic.email || "",
      });
      initialized.current = true;
    }
  }, [clinic, form]);

  const onSubmit = async (values: z.infer<typeof updateClinicSchema>) => {
    if (!clinic) return;
    try {
      await updateClinicMutation.mutateAsync({ clinicId: clinic.id, data: values });
      toast({ title: "Settings updated successfully" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update failed", description: error?.message });
    }
  };

  const billingMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/clinics/${clinic?.id}/billing/settings`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: getGetMyClinicQueryKey() }); toast({ title: "Billing settings updated" }); },
    onError: (e: any) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const [whatsappForm, setWhatsappForm] = React.useState({
    whatsappEnabled: false,
    whatsappProvider: "meta",
    whatsappPhoneNumberId: "",
    whatsappBusinessAccountId: "",
    whatsappAccessToken: "",
    hasAccessToken: false,
    whatsappAccessTokenMasked: null as string | null,
  });
  const whatsappFormInitialized = useRef(false);

  const { data: whatsappSettings, isLoading: whatsappLoading } = useQuery({
    queryKey: ["whatsapp-settings", clinic?.id],
    queryFn: () => apiFetch(`/clinics/${clinic!.id}/whatsapp/settings`),
    enabled: !!clinic?.id && isAdmin,
  });

  React.useEffect(() => {
    if (!whatsappSettings || whatsappFormInitialized.current) return;
    setWhatsappForm({
      whatsappEnabled: !!whatsappSettings.whatsappEnabled,
      whatsappProvider: whatsappSettings.whatsappProvider ?? "meta",
      whatsappPhoneNumberId: whatsappSettings.whatsappPhoneNumberId ?? "",
      whatsappBusinessAccountId: whatsappSettings.whatsappBusinessAccountId ?? "",
      whatsappAccessToken: "",
      hasAccessToken: !!whatsappSettings.hasAccessToken,
      whatsappAccessTokenMasked: whatsappSettings.whatsappAccessTokenMasked ?? null,
    });
    whatsappFormInitialized.current = true;
  }, [whatsappSettings]);

  const whatsappMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch(`/clinics/${clinic?.id}/whatsapp/settings`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: (data: any) => {
      whatsappFormInitialized.current = false;
      queryClient.setQueryData(["whatsapp-settings", clinic?.id], data);
      toast({ title: "WhatsApp settings updated" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const saveWhatsappSettings = () => {
    const payload: Record<string, unknown> = {
      whatsappEnabled: whatsappForm.whatsappEnabled,
      whatsappProvider: whatsappForm.whatsappProvider,
      whatsappPhoneNumberId: whatsappForm.whatsappPhoneNumberId || null,
      whatsappBusinessAccountId: whatsappForm.whatsappBusinessAccountId || null,
    };
    if (whatsappForm.whatsappAccessToken.trim()) {
      payload.whatsappAccessToken = whatsappForm.whatsappAccessToken.trim();
    }
    whatsappMutation.mutate(payload);
  };

  type SchedulingForm = {
    timezone: string;
    openingTime: string;
    closingTime: string;
    workingDays: number[];
    appointmentSlotDurationMinutes: number;
    bookingWindowDays: number;
    maxPatientsPerSlot: number;
    allowWalkins: boolean;
    onlineBookingEnabled: boolean;
    whatsappSelfServiceBookingEnabled: boolean;
  };

  const [schedulingForm, setSchedulingForm] = React.useState<SchedulingForm>({
    timezone: "Africa/Johannesburg",
    openingTime: "08:00",
    closingTime: "17:00",
    workingDays: [1, 2, 3, 4, 5],
    appointmentSlotDurationMinutes: 30,
    bookingWindowDays: 30,
    maxPatientsPerSlot: 1,
    allowWalkins: false,
    onlineBookingEnabled: true,
    whatsappSelfServiceBookingEnabled: true,
  });
  const schedulingInitialized = useRef(false);

  const { data: schedulingSettings, isLoading: schedulingLoading } = useQuery({
    queryKey: ["clinic-scheduling-settings", clinic?.id],
    queryFn: () => apiFetch(`/clinic-settings/${clinic!.id}`),
    enabled: !!clinic?.id && isAdmin,
  });

  React.useEffect(() => {
    if (!schedulingSettings || schedulingInitialized.current) return;
    setSchedulingForm({
      timezone: schedulingSettings.timezone ?? "Africa/Johannesburg",
      openingTime: schedulingSettings.openingTime ?? "08:00",
      closingTime: schedulingSettings.closingTime ?? "17:00",
      workingDays: Array.isArray(schedulingSettings.workingDays) ? schedulingSettings.workingDays : [1, 2, 3, 4, 5],
      appointmentSlotDurationMinutes: schedulingSettings.appointmentSlotDurationMinutes ?? 30,
      bookingWindowDays: schedulingSettings.bookingWindowDays ?? 30,
      maxPatientsPerSlot: schedulingSettings.maxPatientsPerSlot ?? 1,
      allowWalkins: !!schedulingSettings.allowWalkins,
      onlineBookingEnabled: schedulingSettings.onlineBookingEnabled ?? true,
      whatsappSelfServiceBookingEnabled: schedulingSettings.whatsappSelfServiceBookingEnabled ?? true,
    });
    schedulingInitialized.current = true;
  }, [schedulingSettings]);

  const schedulingMutation = useMutation({
    mutationFn: (data: SchedulingForm) =>
      apiFetch(`/clinic-settings/${clinic?.id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (data: SchedulingForm) => {
      schedulingInitialized.current = false;
      queryClient.setQueryData(["clinic-scheduling-settings", clinic?.id], data);
      toast({ title: "Clinic scheduling settings updated" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  type NotificationPreferencesForm = {
    appointmentBooked: boolean;
    appointmentReminder: boolean;
    appointmentCheckedIn: boolean;
    nurseAssessmentComplete: boolean;
    labRequested: boolean;
    labResultReady: boolean;
    prescriptionIssued: boolean;
    medicationReady: boolean;
    visitCompleted: boolean;
  };

  const defaultNotificationPreferences: NotificationPreferencesForm = {
    appointmentBooked: true,
    appointmentReminder: true,
    appointmentCheckedIn: true,
    nurseAssessmentComplete: true,
    labRequested: true,
    labResultReady: true,
    prescriptionIssued: true,
    medicationReady: true,
    visitCompleted: true,
  };
  const [notificationPrefs, setNotificationPrefs] = React.useState<NotificationPreferencesForm>(defaultNotificationPreferences);
  const notificationPrefsInitialized = useRef(false);

  const { data: notificationPreferenceSettings, isLoading: notificationPrefsLoading } = useQuery({
    queryKey: ["notification-preferences", clinic?.id],
    queryFn: () => apiFetch(`/clinic-settings/${clinic!.id}/notification-preferences`),
    enabled: !!clinic?.id && isAdmin,
  });

  React.useEffect(() => {
    if (!notificationPreferenceSettings || notificationPrefsInitialized.current) return;
    setNotificationPrefs({ ...defaultNotificationPreferences, ...notificationPreferenceSettings });
    notificationPrefsInitialized.current = true;
  }, [notificationPreferenceSettings]);

  const notificationPrefsMutation = useMutation({
    mutationFn: (data: NotificationPreferencesForm) =>
      apiFetch(`/clinic-settings/${clinic?.id}/notification-preferences`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: (data: NotificationPreferencesForm) => {
      notificationPrefsInitialized.current = false;
      queryClient.setQueryData(["notification-preferences", clinic?.id], data);
      toast({ title: "Notification preferences updated" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  type AlertToggle = { enabled: boolean; threshold?: number };
  type OperationalAlertsForm = {
    enabled: boolean;
    recipientPhone: string;
    patientRegistered: AlertToggle;
    queueThreshold: AlertToggle;
    lowInventory: AlertToggle;
    labRequestCreated: AlertToggle;
    unpaidInvoices: AlertToggle;
    staffJoinRequest: AlertToggle;
    highPatientVolume: AlertToggle;
  };

  const defaultOperationalAlerts: OperationalAlertsForm = {
    enabled: false,
    recipientPhone: "",
    patientRegistered: { enabled: true },
    queueThreshold: { enabled: true, threshold: 10 },
    lowInventory: { enabled: true },
    labRequestCreated: { enabled: true },
    unpaidInvoices: { enabled: true, threshold: 5 },
    staffJoinRequest: { enabled: true },
    highPatientVolume: { enabled: true, threshold: 50 },
  };

  const [operationalAlertsForm, setOperationalAlertsForm] = React.useState<OperationalAlertsForm>(defaultOperationalAlerts);
  const operationalAlertsInitialized = useRef(false);

  const { data: operationalAlertsSettings, isLoading: operationalAlertsLoading } = useQuery({
    queryKey: ["operational-alerts-settings", clinic?.id],
    queryFn: () => apiFetch(`/clinics/${clinic!.id}/whatsapp/operational-alerts`),
    enabled: !!clinic?.id && isAdmin,
  });

  React.useEffect(() => {
    if (!operationalAlertsSettings || operationalAlertsInitialized.current) return;
    setOperationalAlertsForm({
      enabled: !!operationalAlertsSettings.enabled,
      recipientPhone: operationalAlertsSettings.recipientPhone ?? "",
      patientRegistered: operationalAlertsSettings.patientRegistered ?? defaultOperationalAlerts.patientRegistered,
      queueThreshold: operationalAlertsSettings.queueThreshold ?? defaultOperationalAlerts.queueThreshold,
      lowInventory: operationalAlertsSettings.lowInventory ?? defaultOperationalAlerts.lowInventory,
      labRequestCreated: operationalAlertsSettings.labRequestCreated ?? defaultOperationalAlerts.labRequestCreated,
      unpaidInvoices: operationalAlertsSettings.unpaidInvoices ?? defaultOperationalAlerts.unpaidInvoices,
      staffJoinRequest: operationalAlertsSettings.staffJoinRequest ?? defaultOperationalAlerts.staffJoinRequest,
      highPatientVolume: operationalAlertsSettings.highPatientVolume ?? defaultOperationalAlerts.highPatientVolume,
    });
    operationalAlertsInitialized.current = true;
  }, [operationalAlertsSettings]);

  const operationalAlertsMutation = useMutation({
    mutationFn: (data: OperationalAlertsForm) =>
      apiFetch(`/clinics/${clinic?.id}/whatsapp/operational-alerts`, {
        method: "PATCH",
        body: JSON.stringify({
          ...data,
          recipientPhone: data.recipientPhone.trim() || null,
        }),
      }),
    onSuccess: (data: OperationalAlertsForm) => {
      operationalAlertsInitialized.current = false;
      queryClient.setQueryData(["operational-alerts-settings", clinic?.id], data);
      toast({ title: "Operational alert settings updated" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const updateAlertToggle = (
    key: keyof Omit<OperationalAlertsForm, "enabled" | "recipientPhone">,
    patch: Partial<AlertToggle>,
  ) => {
    setOperationalAlertsForm((f) => ({
      ...f,
      [key]: { ...f[key], ...patch },
    }));
  };

  const operationalAlertRows: Array<{
    key: keyof Omit<OperationalAlertsForm, "enabled" | "recipientPhone">;
    label: string;
    description: string;
    hasThreshold?: boolean;
  }> = [
    { key: "patientRegistered", label: "New patient registered", description: "Notify when a patient is registered." },
    { key: "queueThreshold", label: "Queue exceeds threshold", description: "Alert when waiting patients exceed the limit.", hasThreshold: true },
    { key: "lowInventory", label: "Low inventory stock", description: "Alert when stock falls below minimum level." },
    { key: "labRequestCreated", label: "New lab request", description: "Notify when a laboratory request is created." },
    { key: "unpaidInvoices", label: "Unpaid invoices exceed threshold", description: "Alert when unpaid/partial invoice count exceeds limit.", hasThreshold: true },
    { key: "staffJoinRequest", label: "New staff join request", description: "Notify when someone requests to join the clinic." },
    { key: "highPatientVolume", label: "High patient volume", description: "Alert when daily queue volume exceeds limit.", hasThreshold: true },
  ];

  const copyCode = () => {
    if (clinic?.code) {
      navigator.clipboard.writeText(clinic.code);
      toast({ title: "Clinic code copied to clipboard" });
    }
  };

  const clinicTypeLabel: Record<string, string> = { private: "Private", government: "Government", ngo: "NGO / Community" };
  const clinicTypeBadgeColor: Record<string, string> = { private: "bg-blue-100 text-blue-800", government: "bg-green-100 text-green-800", ngo: "bg-purple-100 text-purple-800" };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clinic Settings</h1>
        <p className="text-muted-foreground mt-1">Manage clinic profile and preferences.</p>
      </div>

      {clinic && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary"/>
              Clinic Code
              {(clinic as any).clinicType && (
                <Badge variant="outline" className={clinicTypeBadgeColor[(clinic as any).clinicType] ?? ""}>
                  {clinicTypeLabel[(clinic as any).clinicType] ?? (clinic as any).clinicType}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>Share this code with staff members so they can request to join.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="px-4 py-2 bg-background border rounded-md text-xl font-mono font-bold tracking-wider">
                {clinic.code}
              </div>
              <Button variant="outline" onClick={copyCode}><Copy className="w-4 h-4 mr-2" /> Copy Code</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp Configuration */}
      {isAdmin && clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> WhatsApp Configuration
            </CardTitle>
            <CardDescription>
              Patient notifications via WhatsApp Cloud API. Each clinic uses its own credentials.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {whatsappLoading && !whatsappFormInitialized.current ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">Enable WhatsApp</p>
                    <p className="text-xs text-muted-foreground">Send automated patient messages on clinic events</p>
                  </div>
                  <Switch
                    checked={whatsappForm.whatsappEnabled}
                    onCheckedChange={(checked) =>
                      setWhatsappForm((f) => ({ ...f, whatsappEnabled: checked }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Provider</p>
                  <Select
                    value={whatsappForm.whatsappProvider}
                    onValueChange={(v) => setWhatsappForm((f) => ({ ...f, whatsappProvider: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meta">WhatsApp Cloud API (Meta)</SelectItem>
                      <SelectItem value="twilio">Twilio (coming soon)</SelectItem>
                      <SelectItem value="360dialog">360dialog (coming soon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Phone Number ID</p>
                    <Input
                      value={whatsappForm.whatsappPhoneNumberId}
                      onChange={(e) =>
                        setWhatsappForm((f) => ({ ...f, whatsappPhoneNumberId: e.target.value }))
                      }
                      placeholder="Meta Phone Number ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Business Account ID</p>
                    <Input
                      value={whatsappForm.whatsappBusinessAccountId}
                      onChange={(e) =>
                        setWhatsappForm((f) => ({ ...f, whatsappBusinessAccountId: e.target.value }))
                      }
                      placeholder="WhatsApp Business Account ID"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Access Token</p>
                  {whatsappForm.hasAccessToken && whatsappForm.whatsappAccessTokenMasked && (
                    <p className="text-xs text-muted-foreground">
                      Current token: {whatsappForm.whatsappAccessTokenMasked}
                    </p>
                  )}
                  <Input
                    type="password"
                    value={whatsappForm.whatsappAccessToken}
                    onChange={(e) =>
                      setWhatsappForm((f) => ({ ...f, whatsappAccessToken: e.target.value }))
                    }
                    placeholder={whatsappForm.hasAccessToken ? "Leave blank to keep existing token" : "Paste access token"}
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  onClick={saveWhatsappSettings}
                  disabled={whatsappMutation.isPending}
                >
                  {whatsappMutation.isPending ? "Saving..." : "Save WhatsApp Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Operational Clinic Alerts */}
      {isAdmin && clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" /> Operational Clinic Alerts
            </CardTitle>
            <CardDescription>
              WhatsApp alerts to clinic management for operational events. Uses the same WhatsApp credentials above.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {operationalAlertsLoading && !operationalAlertsInitialized.current ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <div className="flex items-center justify-between py-2 border-b">
                  <div>
                    <p className="text-sm font-medium">Enable operational alerts</p>
                    <p className="text-xs text-muted-foreground">Master switch for clinic management WhatsApp alerts</p>
                  </div>
                  <Switch
                    checked={operationalAlertsForm.enabled}
                    onCheckedChange={(checked) =>
                      setOperationalAlertsForm((f) => ({ ...f, enabled: checked }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Alert recipient phone</p>
                  <Input
                    value={operationalAlertsForm.recipientPhone}
                    onChange={(e) =>
                      setOperationalAlertsForm((f) => ({ ...f, recipientPhone: e.target.value }))
                    }
                    placeholder="e.g. 0821234567 or 27821234567"
                  />
                  <p className="text-xs text-muted-foreground">
                    Clinic manager or duty phone that receives operational alerts for this clinic only.
                  </p>
                </div>
                {operationalAlertRows.map(({ key, label, description, hasThreshold }) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    {hasThreshold && (
                      <Input
                        type="number"
                        min={1}
                        className="w-20"
                        value={operationalAlertsForm[key].threshold ?? ""}
                        onChange={(e) =>
                          updateAlertToggle(key, { threshold: Math.max(1, parseInt(e.target.value, 10) || 1) })
                        }
                      />
                    )}
                    <Switch
                      checked={operationalAlertsForm[key].enabled}
                      onCheckedChange={(checked) => updateAlertToggle(key, { enabled: checked })}
                    />
                  </div>
                ))}
                <Button
                  type="button"
                  onClick={() => operationalAlertsMutation.mutate(operationalAlertsForm)}
                  disabled={operationalAlertsMutation.isPending}
                >
                  {operationalAlertsMutation.isPending ? "Saving..." : "Save Operational Alert Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5" /> Scheduling
            </CardTitle>
            <CardDescription>Controls appointment availability for reception and WhatsApp booking.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedulingLoading && !schedulingInitialized.current ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Timezone</p>
                    <Input value={schedulingForm.timezone} onChange={(e) => setSchedulingForm((f) => ({ ...f, timezone: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Opening Time</p>
                    <Input type="time" value={schedulingForm.openingTime} onChange={(e) => setSchedulingForm((f) => ({ ...f, openingTime: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Closing Time</p>
                    <Input type="time" value={schedulingForm.closingTime} onChange={(e) => setSchedulingForm((f) => ({ ...f, closingTime: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Working Days</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      ["Sun", 0], ["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6],
                    ].map(([label, day]) => {
                      const value = Number(day);
                      const active = schedulingForm.workingDays.includes(value);
                      return (
                        <Button
                          key={value}
                          type="button"
                          size="sm"
                          variant={active ? "default" : "outline"}
                          onClick={() => setSchedulingForm((f) => ({
                            ...f,
                            workingDays: active ? f.workingDays.filter((d) => d !== value) : [...f.workingDays, value].sort(),
                          }))}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Slot Duration</p>
                    <Input type="number" min={5} value={schedulingForm.appointmentSlotDurationMinutes} onChange={(e) => setSchedulingForm((f) => ({ ...f, appointmentSlotDurationMinutes: Math.max(5, parseInt(e.target.value, 10) || 5) }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Booking Window Days</p>
                    <Input type="number" min={1} value={schedulingForm.bookingWindowDays} onChange={(e) => setSchedulingForm((f) => ({ ...f, bookingWindowDays: Math.max(1, parseInt(e.target.value, 10) || 1) }))} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Max Patients Per Slot</p>
                    <Input type="number" min={1} value={schedulingForm.maxPatientsPerSlot} onChange={(e) => setSchedulingForm((f) => ({ ...f, maxPatientsPerSlot: Math.max(1, parseInt(e.target.value, 10) || 1) }))} />
                  </div>
                </div>
                {[
                  ["allowWalkins", "Allow Walk-ins"],
                  ["onlineBookingEnabled", "Enable Online Booking"],
                  ["whatsappSelfServiceBookingEnabled", "Enable Self-Service WhatsApp Booking"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                    <p className="text-sm font-medium">{label}</p>
                    <Switch checked={!!schedulingForm[key as keyof SchedulingForm]} onCheckedChange={(checked) => setSchedulingForm((f) => ({ ...f, [key]: checked }))} />
                  </div>
                ))}
                <Button type="button" onClick={() => schedulingMutation.mutate(schedulingForm)} disabled={schedulingMutation.isPending}>
                  {schedulingMutation.isPending ? "Saving..." : "Save Scheduling Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isAdmin && clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" /> Notification Settings
            </CardTitle>
            <CardDescription>Applies to WhatsApp, internal staff notifications, and future SMS integrations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {notificationPrefsLoading && !notificationPrefsInitialized.current ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                {[
                  ["appointmentBooked", "Appointment Booked"],
                  ["appointmentReminder", "Appointment Reminder"],
                  ["appointmentCheckedIn", "Appointment Checked In"],
                  ["nurseAssessmentComplete", "Nurse Assessment Complete"],
                  ["labRequested", "Lab Requested"],
                  ["labResultReady", "Lab Results Ready"],
                  ["prescriptionIssued", "Prescription Issued"],
                  ["medicationReady", "Medication Ready"],
                  ["visitCompleted", "Visit Completed"],
                ].map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                    <p className="text-sm font-medium">{label}</p>
                    <Switch checked={notificationPrefs[key as keyof NotificationPreferencesForm]} onCheckedChange={(checked) => setNotificationPrefs((f) => ({ ...f, [key]: checked }))} />
                  </div>
                ))}
                <Button type="button" onClick={() => notificationPrefsMutation.mutate(notificationPrefs)} disabled={notificationPrefsMutation.isPending}>
                  {notificationPrefsMutation.isPending ? "Saving..." : "Save Notification Settings"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Billing Settings */}
      {isAdmin && clinic && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Receipt className="w-5 h-5" /> Billing & Payments</CardTitle>
            <CardDescription>
              {(clinic as any).clinicType === "government"
                ? "Government clinics have billing disabled by default."
                : "Configure which services require payment."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "billingEnabled", label: "Enable Billing", description: "Master switch — disabling this hides billing from all staff." },
              { key: "consultationFeeEnabled", label: "Consultation Fees", description: "Charge patients for doctor consultations." },
              { key: "pharmacyBillingEnabled", label: "Pharmacy Billing", description: "Charge for dispensed medications." },
              { key: "labBillingEnabled", label: "Laboratory Billing", description: "Charge for lab tests and results." },
            ].map(({ key, label, description }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Switch
                  checked={!!(clinic as any)[key]}
                  onCheckedChange={(checked) => billingMutation.mutate({ [key]: checked })}
                  disabled={billingMutation.isPending}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
          <CardDescription>Update the clinic's public facing information.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Clinic Name</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!isAdmin} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input {...field} disabled={!isAdmin} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!isAdmin} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isAdmin && (
                <Button
                  type="submit"
                  className="mt-6"
                  disabled={updateClinicMutation.isPending}
                >
                  {updateClinicMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
