import Layout from "@/components/Layout";
import {
  useGetPatientPortalMe,
  getGetPatientPortalMeQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Heart, Printer, QrCode, User, Building2, Calendar, Droplets, AlertTriangle, CreditCard, BadgeCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const CLINIC_TYPE_LABEL: Record<string, string> = {
  private: "Private Clinic",
  government: "Government Clinic",
  ngo: "NGO Clinic",
};

const BLOOD_TYPE_COLOR: Record<string, string> = {
  "A+": "bg-red-50 text-red-700 border-red-200",
  "A-": "bg-red-50 text-red-700 border-red-200",
  "B+": "bg-orange-50 text-orange-700 border-orange-200",
  "B-": "bg-orange-50 text-orange-700 border-orange-200",
  "AB+": "bg-purple-50 text-purple-700 border-purple-200",
  "AB-": "bg-purple-50 text-purple-700 border-purple-200",
  "O+": "bg-blue-50 text-blue-700 border-blue-200",
  "O-": "bg-blue-50 text-blue-700 border-blue-200",
};

function InfoRow({ icon: Icon, label, value, highlight }: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  highlight?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-dashed border-border/60 last:border-0">
      <div className="flex-shrink-0 w-7 h-7 rounded-md bg-primary/8 flex items-center justify-center mt-0.5">
        <Icon className="w-3.5 h-3.5 text-primary/70" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
        <p className={cn("text-sm font-semibold mt-0.5", highlight ?? "text-foreground")}>{value || <span className="text-muted-foreground font-normal italic text-xs">Not provided</span>}</p>
      </div>
    </div>
  );
}

function BloodTypeBadge({ value }: { value?: string | null }) {
  if (!value) return <span className="text-muted-foreground font-normal italic text-xs">Not provided</span>;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded border text-sm font-bold", BLOOD_TYPE_COLOR[value] ?? "bg-muted text-foreground border-border")}>
      {value}
    </span>
  );
}

export default function ClinicCardPage() {
  const { data: profile, isLoading } = useGetPatientPortalMe({
    query: { queryKey: getGetPatientPortalMeQueryKey(), staleTime: 60_000 },
  });

  const patient = profile?.patient;
  const clinic = profile?.clinic;

  const handlePrint = () => window.print();

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Clinic Card</h1>
            <p className="text-muted-foreground mt-0.5 text-sm">Your digital patient identification card</p>
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 print:hidden">
            <Printer className="w-4 h-4" />
            Print Card
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-4 print:space-y-3">
            {/* Main Card */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 shadow-lg print:shadow-none print:border print:border-gray-300">
              {/* Card header strip */}
              <div className="bg-primary px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm leading-none">{clinic?.name ?? "Smart Clinic"}</p>
                    <p className="text-white/70 text-[10px] mt-0.5 uppercase tracking-wider">
                      {CLINIC_TYPE_LABEL[clinic?.clinicType ?? ""] ?? "Healthcare"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-[9px] uppercase tracking-wider">Patient Card</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <BadgeCheck className="w-3.5 h-3.5 text-white/80" />
                    <p className="text-white/80 text-[10px] font-mono">VERIFIED</p>
                  </div>
                </div>
              </div>

              {/* Patient identity section */}
              <div className="px-6 py-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl font-bold text-primary">
                    {patient?.firstName?.charAt(0)?.toUpperCase() ?? "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground leading-tight">
                    {patient?.firstName} {patient?.lastName}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono font-semibold">
                      <CreditCard className="w-3 h-3" />
                      {patient?.patientCode ?? "---"}
                    </span>
                    {patient?.bloodType && (
                      <BloodTypeBadge value={patient.bloodType} />
                    )}
                  </div>
                </div>
              </div>

              {/* Decorative barcode placeholder */}
              <div className="px-6 pb-4">
                <div className="flex items-center gap-1 opacity-20">
                  {Array.from({ length: 60 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-foreground rounded-sm"
                      style={{ width: i % 3 === 0 ? 3 : 1, height: i % 7 === 0 ? 28 : 20 }}
                    />
                  ))}
                </div>
                <p className="text-[9px] text-muted-foreground/50 font-mono mt-1 text-center tracking-widest">
                  {patient?.patientCode ?? "PATIENT-CODE"}
                </p>
              </div>
            </div>

            {/* Info table */}
            <div className="rounded-xl border bg-card shadow-sm">
              <div className="px-5 py-3 border-b bg-muted/30 rounded-t-xl">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Patient Information</h3>
              </div>
              <div className="px-5 py-2">
                <InfoRow icon={User} label="Full Name" value={`${patient?.firstName ?? ""} ${patient?.lastName ?? ""}`.trim()} />
                <InfoRow icon={CreditCard} label="Patient Code" value={patient?.patientCode} highlight="text-primary font-mono" />
                <InfoRow
                  icon={BadgeCheck}
                  label={patient?.governmentIdType === "PASSPORT" ? "Passport Number" : "ID Number"}
                  value={patient?.governmentIdNumber}
                />
                <InfoRow
                  icon={Droplets}
                  label="Blood Type"
                  value={<BloodTypeBadge value={patient?.bloodType} />}
                />
                <InfoRow
                  icon={AlertTriangle}
                  label="Known Allergies"
                  value={patient?.allergies}
                  highlight={patient?.allergies ? "text-orange-700" : undefined}
                />
                <InfoRow
                  icon={Calendar}
                  label="Registration Date"
                  value={patient?.createdAt ? format(new Date(patient.createdAt as string), "dd MMMM yyyy") : undefined}
                />
                <InfoRow
                  icon={Building2}
                  label="Clinic"
                  value={clinic?.name}
                />
                <InfoRow
                  icon={Building2}
                  label="Clinic Type"
                  value={CLINIC_TYPE_LABEL[clinic?.clinicType ?? ""] ?? clinic?.clinicType ?? "—"}
                />
              </div>
            </div>

            {/* QR Code placeholder */}
            <div className="rounded-xl border bg-card shadow-sm p-5 flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center flex-shrink-0 bg-muted/30">
                <QrCode className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-medium">QR Code</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Digital QR verification will be available in a future update.
                  Present this card to clinic staff for identification.
                </p>
              </div>
            </div>

            {/* Footer notice */}
            <p className="text-center text-xs text-muted-foreground pb-4 print:pb-1">
              This card is for identification purposes only. Keep your patient code confidential.
            </p>
          </div>
        )}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </Layout>
  );
}
