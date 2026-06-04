import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Heart, MailCheck, RotateCcw, ShieldCheck } from "lucide-react";

interface OtpVerifyScreenProps {
  email: string;
  isVerifying?: boolean;
  error?: string;
  onVerify: (otp: string) => void;
  onResend: () => Promise<void>;
}

export function OtpVerifyScreen({ email, isVerifying, error, onVerify, onResend }: OtpVerifyScreenProps) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) refs.current[index + 1]?.focus();
    if (next.every((d) => d !== "")) {
      onVerify(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!text) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) next[i] = text[i] ?? "";
    setDigits(next);
    refs.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) onVerify(text);
  };

  const handleResend = useCallback(async () => {
    setResending(true);
    setResendMessage("");
    try {
      await onResend();
      setCountdown(60);
      setDigits(["", "", "", "", "", ""]);
      setResendMessage("A new code has been sent to your email.");
      refs.current[0]?.focus();
    } catch {
      setResendMessage("Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }, [onResend]);

  const otp = digits.join("");

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex flex-col w-2/5 bg-primary p-12 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Smart Clinic</span>
        </div>
        <div>
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-6">
            <MailCheck className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-white text-2xl font-light leading-relaxed mb-3">One more step to secure your account.</h2>
          <p className="text-white/60 text-sm leading-relaxed">We sent a 6-digit code to your email. Enter it to verify your identity and activate your patient portal account.</p>
        </div>
        <p className="text-white/50 text-xs">Your data is encrypted and kept private.</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold">Smart Clinic — Patient Portal</span>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-foreground">Verify your email</h1>
            <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">Enter 6-digit code</label>
              <div className="flex gap-2" onPaste={handlePaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { refs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    data-testid={`otp-digit-${i}`}
                    className={`flex-1 h-14 text-center text-xl font-bold rounded-lg border-2 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                      error ? "border-destructive" : d ? "border-primary" : "border-input"
                    }`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <p className="text-destructive text-sm" data-testid="otp-error">{error}</p>
            )}

            {resendMessage && (
              <p className="text-primary text-sm">{resendMessage}</p>
            )}

            <Button
              className="w-full"
              disabled={otp.length < 6 || isVerifying}
              onClick={() => onVerify(otp)}
              data-testid="button-verify-otp"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isVerifying ? "Verifying..." : "Verify Email"}
            </Button>

            <div className="text-center">
              {countdown > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Resend code in <span className="font-medium tabular-nums">{countdown}s</span>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="text-xs text-primary hover:underline flex items-center gap-1 mx-auto"
                  data-testid="button-resend-otp"
                >
                  <RotateCcw className="w-3 h-3" />
                  {resending ? "Sending..." : "Resend verification code"}
                </button>
              )}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
