import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation, Link } from "wouter";
import { useLogin, useVerifyEmail, useResendOtp } from "@workspace/api-client-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity } from "lucide-react";
import { OtpVerifyScreen } from "@/components/OtpVerifyScreen";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const verifyEmailMutation = useVerifyEmail();
  const resendOtpMutation = useResendOtp();

  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpError, setOtpError] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    try {
      const response = await loginMutation.mutateAsync({ data: values });
      login(response.token);
      setLocation("/");
    } catch (error: any) {
      const data = error?.response?.data;
      if (data?.requiresVerification && data?.email) {
        setOtpEmail(data.email);
        return;
      }
      toast({
        variant: "destructive",
        title: "Login failed",
        description: data?.error || error?.message || "Please check your credentials and try again.",
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
      setLocation("/");
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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Activity className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
            Smart Clinic
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your credentials to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="doctor@clinic.com"
                        {...field}
                        data-testid="input-email"
                      />
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
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full font-medium"
                disabled={loginMutation.isPending}
                data-testid="button-submit-login"
              >
                {loginMutation.isPending ? "Signing in..." : "Sign In"}
              </Button>

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors"
                  data-testid="link-forgot-password"
                >
                  Forgot your password?
                </Link>
              </div>
            </form>
          </Form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/register" className="font-medium text-primary hover:underline" data-testid="link-register">
              Register here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
