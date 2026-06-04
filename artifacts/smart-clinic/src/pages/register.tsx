import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation, Link } from "wouter";
import { useRegister, useVerifyEmail, useResendOtp } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Info } from "lucide-react";
import { OtpVerifyScreen } from "@/components/OtpVerifyScreen";

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
  role: z.enum(["clinic_admin", "receptionist", "nurse", "doctor", "pharmacist", "lab_technician", "cashier"]),
  governmentIdType: z.enum(["SA_ID", "PASSPORT"]),
  governmentIdNumber: z.string().min(1, { message: "Please enter your ID or passport number" }),
  nationality: z.string().optional(),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();
  const verifyEmailMutation = useVerifyEmail();
  const resendOtpMutation = useResendOtp();

  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpError, setOtpError] = useState("");

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "doctor",
      governmentIdType: "SA_ID",
      governmentIdNumber: "",
      nationality: "",
    },
  });

  const watchIdType = form.watch("governmentIdType");

  async function onSubmit(values: z.infer<typeof registerSchema>) {
    try {
      const response = await registerMutation.mutateAsync({ data: values as any });
      if ("requiresVerification" in response && response.requiresVerification) {
        // Normal mode: show OTP verification screen
        setOtpEmail(response.email);
      } else if ("token" in response && response.token) {
        // Presentation mode: account activated immediately, log in and proceed
        login(response.token);
        toast({ title: "Account created!", description: "Welcome to Smart Clinic." });
        setLocation("/onboarding");
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error ?? error?.message ?? "Please check your information and try again.";
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: msg,
      });
    }
  }

  async function handleVerify(otp: string) {
    if (!otpEmail) return;
    setOtpError("");
    try {
      const response = await verifyEmailMutation.mutateAsync({ data: { email: otpEmail, otp } });
      login(response.token);
      toast({ title: "Email verified!", description: "Welcome to Smart Clinic." });
      setLocation("/onboarding");
    } catch (error: any) {
      const msg = error?.response?.data?.error ?? "Invalid code. Please try again.";
      setOtpError(msg);
    }
  }

  async function handleResend() {
    if (!otpEmail) return;
    await resendOtpMutation.mutateAsync({ data: { email: otpEmail } });
  }

  if (otpEmail) {
    return (
      <OtpVerifyScreen
        email={otpEmail}
        isVerifying={verifyEmailMutation.isPending}
        error={otpError}
        onVerify={handleVerify}
        onResend={handleResend}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Create a Staff Account
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Join Smart Clinic to manage your healthcare operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dr. Jane Smith" {...field} data-testid="input-name" />
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
                      <Input type="email" placeholder="jane.smith@clinic.com" {...field} data-testid="input-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-role">
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="doctor">Doctor</SelectItem>
                        <SelectItem value="nurse">Nurse</SelectItem>
                        <SelectItem value="receptionist">Receptionist</SelectItem>
                        <SelectItem value="pharmacist">Pharmacist</SelectItem>
                        <SelectItem value="lab_technician">Lab Technician</SelectItem>
                        <SelectItem value="cashier">Cashier</SelectItem>
                        <SelectItem value="clinic_admin">Clinic Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Government ID — required for all staff */}
              <div className="p-3 rounded-lg bg-muted/60 border border-border space-y-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">Identity document required.</strong> South African users should use their SA ID Number. Foreign nationals may use a Passport Number.
                  </p>
                </div>
                <FormField
                  control={form.control}
                  name="governmentIdType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">ID Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-id-type">
                            <SelectValue placeholder="Select ID type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="SA_ID">SA ID Number</SelectItem>
                          <SelectItem value="PASSPORT">Passport Number</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="governmentIdNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">
                        {watchIdType === "PASSPORT" ? "Passport Number" : "SA ID Number (13 digits)"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={watchIdType === "PASSPORT" ? "Passport number" : "e.g. 8001015009087"}
                          {...field}
                          data-testid="input-id-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nationality"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Nationality <span className="text-muted-foreground">(optional)</span></FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. South African" {...field} data-testid="input-nationality" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full font-medium mt-2"
                disabled={registerMutation.isPending}
                data-testid="button-submit-register"
              >
                {registerMutation.isPending ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-primary hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
