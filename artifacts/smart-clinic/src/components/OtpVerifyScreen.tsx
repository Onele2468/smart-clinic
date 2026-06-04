import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Activity, MailCheck, RotateCcw, ShieldCheck } from "lucide-react";

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
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MailCheck className="w-8 h-8 text-primary" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Smart Clinic</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground mt-3">Check your email</h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            We sent a 6-digit verification code to<br />
            <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="bg-card border rounded-xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-foreground mb-3 text-center">Enter verification code</label>

          <div className="flex gap-2 justify-center mb-5" onPaste={handlePaste}>
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
                className={`w-11 h-14 text-center text-xl font-bold rounded-lg border-2 bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  error ? "border-destructive" : d ? "border-primary" : "border-input"
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-destructive text-sm text-center mb-4" data-testid="otp-error">{error}</p>
          )}

          {resendMessage && (
            <p className="text-primary text-sm text-center mb-4">{resendMessage}</p>
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

          <div className="mt-4 text-center">
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
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Didn't receive it? Check your spam folder or click resend above.
        </p>
      </div>
    </div>
  );
}
