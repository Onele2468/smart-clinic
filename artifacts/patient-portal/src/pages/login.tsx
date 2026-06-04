import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart, Eye, EyeOff, AlertCircle } from "lucide-react";
import { OtpVerifyScreen } from "@/components/OtpVerifyScreen";

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [otpError, setOtpError] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.status === 403 && data.requiresVerification) {
        setOtpEmail(data.email);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Login failed. Please check your credentials.");
        return;
      }
      login(data.token, data.user);
      setLocation("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (otp: string) => {
    if (!otpEmail) return;
    setOtpError("");
    setVerifying(true);
    try {
      const res = await fetch("/api/patient-portal/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: otpEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOtpError(data.error ?? "Invalid code. Please try again.");
        return;
      }
      login(data.token, data.user);
      setLocation("/");
    } catch {
      setOtpError("Something went wrong. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!otpEmail) return;
    const res = await fetch("/api/patient-portal/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: otpEmail }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to resend");
    }
  };

  if (otpEmail) {
    return (
      <OtpVerifyScreen
        email={otpEmail}
        isVerifying={verifying}
        error={otpError}
        onVerify={handleVerify}
        onResend={handleResend}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col w-1/2 bg-primary p-12 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Smart Clinic</span>
        </div>
        <div>
          <blockquote className="text-white/90 text-2xl font-light leading-relaxed">
            "Your health journey, always within reach. Access your records, track your appointments, and stay connected with your care team."
          </blockquote>
          <p className="text-white/60 mt-4 text-sm">Patient Portal — Secure &amp; Private</p>
        </div>
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-1 rounded-full bg-white/30 flex-1" />
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">Smart Clinic</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-foreground">Welcome back</h1>
            <p className="text-muted-foreground mt-1">Sign in to your patient portal</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-6" data-testid="error-message">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                data-testid="input-email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pr-10"
                  data-testid="input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="button-submit-login"
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            New patient?{" "}
            <Link href="/register" className="text-primary hover:underline font-medium" data-testid="link-register">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
