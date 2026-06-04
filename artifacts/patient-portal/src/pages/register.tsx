import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { usePatientPortalRegister, usePatientPortalVerifyEmail, usePatientPortalResendOtp } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, AlertCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { OtpVerifyScreen } from "@/components/OtpVerifyScreen";

const STEPS = ["Account", "Personal & ID", "Medical", "Clinic"];

export default function RegisterPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpError, setOtpError] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    clinicCode: "",
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "" as "male" | "female" | "other" | "",
    contactNumber: "",
    nationality: "",
    governmentIdType: "" as "SA_ID" | "PASSPORT" | "",
    governmentIdNumber: "",
    bloodType: "",
    allergies: "",
    medicalAidName: "",
    medicalAidNumber: "",
  });

  const register = usePatientPortalRegister();
  const verifyEmail = usePatientPortalVerifyEmail();
  const resendOtp = usePatientPortalResendOtp();

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    setError("");
    if (!form.governmentIdType || !form.governmentIdNumber) {
      setError("Please provide your government ID (SA ID Number or Passport Number) before submitting.");
      setStep(1);
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        password: form.password,
        clinicCode: form.clinicCode,
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as "male" | "female" | "other",
        contactNumber: form.contactNumber,
        governmentIdType: form.governmentIdType,
        governmentIdNumber: form.governmentIdNumber,
      };
      if (form.nationality) payload.nationality = form.nationality;
      if (form.bloodType) payload.bloodType = form.bloodType;
      if (form.allergies) payload.allergies = form.allergies;
      if (form.medicalAidName) payload.medicalAidName = form.medicalAidName;
      if (form.medicalAidNumber) payload.medicalAidNumber = form.medicalAidNumber;

      const result = await register.mutateAsync({ data: payload as any });
      if ("requiresVerification" in result && result.requiresVerification) {
        // Normal mode: show OTP verification screen
        setOtpEmail(result.email);
      } else if ("token" in result && result.token) {
        // Presentation mode: account activated immediately, log in and proceed
        login(result.token, result.user as any);
        setLocation("/");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Registration failed. Please try again.";
      setError(msg);
    }
  };

  const handleVerify = async (otp: string) => {
    if (!otpEmail) return;
    setOtpError("");
    try {
      const result = await verifyEmail.mutateAsync({ data: { email: otpEmail, otp } });
      login(result.token, result.user);
      setLocation("/");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Invalid code. Please try again.";
      setOtpError(msg);
    }
  };

  const handleResend = async () => {
    if (!otpEmail) return;
    await resendOtp.mutateAsync({ data: { email: otpEmail } });
  };

  if (otpEmail) {
    return (
      <OtpVerifyScreen
        email={otpEmail}
        isVerifying={verifyEmail.isPending}
        error={otpError}
        onVerify={handleVerify}
        onResend={handleResend}
      />
    );
  }

  const stepValid = (): boolean => {
    if (step === 0) return !!(form.name && form.email && form.password.length >= 8);
    if (step === 1) return !!(form.firstName && form.lastName && form.dateOfBirth && form.gender && form.contactNumber && form.governmentIdType && form.governmentIdNumber);
    if (step === 2) return true;
    if (step === 3) return !!form.clinicCode;
    return true;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col w-2/5 bg-primary p-12 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Smart Clinic</span>
        </div>
        <div>
          <h2 className="text-white text-2xl font-light leading-relaxed mb-4">
            Join your clinic's patient portal in minutes.
          </h2>
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors",
                  i < step ? "bg-white/80 text-primary" : i === step ? "bg-white text-primary" : "bg-white/20 text-white/60"
                )}>
                  {i + 1}
                </div>
                <span className={cn("text-sm", i <= step ? "text-white" : "text-white/60")}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/50 text-xs">Your data is encrypted and kept private.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Smart Clinic — Patient Portal</span>
          </div>

          <div className="mb-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Step {step + 1} of {STEPS.length}</p>
            <h1 className="text-2xl font-semibold text-foreground">{STEPS[step]}</h1>
          </div>

          <div className="flex gap-1 mb-6">
            {STEPS.map((_, i) => (
              <div key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-muted")} />
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-5" data-testid="error-register">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Step 0: Account */}
            {step === 0 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" placeholder="Your full name" value={form.name} onChange={(e) => update("name", e.target.value)} data-testid="input-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-email">Email address</Label>
                  <Input id="reg-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => update("email", e.target.value)} data-testid="input-email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="reg-password">Password <span className="text-muted-foreground text-xs">(min. 8 characters)</span></Label>
                  <Input id="reg-password" type="password" placeholder="Create a strong password" value={form.password} onChange={(e) => update("password", e.target.value)} data-testid="input-password" />
                </div>
              </>
            )}

            {/* Step 1: Personal & ID */}
            {step === 1 && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First name</Label>
                    <Input id="firstName" placeholder="First name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} data-testid="input-first-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input id="lastName" placeholder="Last name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} data-testid="input-last-name" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input id="dob" type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} data-testid="input-dob" />
                </div>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                    <SelectTrigger data-testid="select-gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact">Contact number</Label>
                  <Input id="contact" type="tel" placeholder="+27 81 234 5678" value={form.contactNumber} onChange={(e) => update("contactNumber", e.target.value)} data-testid="input-contact" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="nationality">Nationality <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input id="nationality" placeholder="e.g. South African" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} data-testid="input-nationality" />
                </div>

                {/* Identity document — required */}
                <div className="p-3 rounded-lg bg-muted/60 border border-border space-y-3">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      <strong className="text-foreground">Identity document required.</strong> South African users should use their ID Number. Foreign nationals may use a Passport Number.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>ID type <span className="text-destructive text-xs">*</span></Label>
                      <Select value={form.governmentIdType} onValueChange={(v) => update("governmentIdType", v)}>
                        <SelectTrigger data-testid="select-id-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SA_ID">SA ID Number</SelectItem>
                          <SelectItem value="PASSPORT">Passport Number</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="idNum">ID number <span className="text-destructive text-xs">*</span></Label>
                      <Input
                        id="idNum"
                        placeholder={form.governmentIdType === "PASSPORT" ? "Passport number" : "13-digit ID"}
                        value={form.governmentIdNumber}
                        onChange={(e) => update("governmentIdNumber", e.target.value)}
                        data-testid="input-id-number"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Medical (optional) */}
            {step === 2 && (
              <>
                <p className="text-xs text-muted-foreground -mt-1">All fields on this step are optional but help your clinic provide better care.</p>
                <div className="space-y-1.5">
                  <Label htmlFor="blood">Blood type</Label>
                  <Input id="blood" placeholder="e.g. O+" value={form.bloodType} onChange={(e) => update("bloodType", e.target.value)} data-testid="input-blood-type" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="allergies">Known allergies</Label>
                  <Input id="allergies" placeholder="e.g. Penicillin, Peanuts" value={form.allergies} onChange={(e) => update("allergies", e.target.value)} data-testid="input-allergies" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aidName">Medical aid name</Label>
                  <Input id="aidName" placeholder="e.g. Discovery Health" value={form.medicalAidName} onChange={(e) => update("medicalAidName", e.target.value)} data-testid="input-medical-aid-name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="aidNum">Medical aid number</Label>
                  <Input id="aidNum" placeholder="Membership number" value={form.medicalAidNumber} onChange={(e) => update("medicalAidNumber", e.target.value)} data-testid="input-medical-aid-number" />
                </div>
              </>
            )}

            {/* Step 3: Clinic */}
            {step === 3 && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="clinicCode">Clinic join code</Label>
                  <Input
                    id="clinicCode"
                    placeholder="e.g. SC-123456"
                    value={form.clinicCode}
                    onChange={(e) => update("clinicCode", e.target.value.toUpperCase())}
                    data-testid="input-clinic-code"
                  />
                  <p className="text-xs text-muted-foreground">Ask your clinic for their join code. It usually looks like SC-XXXXXX.</p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 mt-7">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1" data-testid="button-prev-step">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!stepValid()} className="flex-1" data-testid="button-next-step">
                Continue
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!stepValid() || register.isPending} className="flex-1" data-testid="button-submit-register">
                {register.isPending ? "Creating account..." : "Create account"}
              </Button>
            )}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium" data-testid="link-login">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
