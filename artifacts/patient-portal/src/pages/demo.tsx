import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Heart, User, Loader2, Activity, Calendar, FlaskConical, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEMO_EMAIL = "patient@democlinic.com";
const DEMO_PASSWORD = "Demo@1234";

export default function DemoPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError("Demo data may not be seeded yet. Ask your clinic administrator to run the seed script.");
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="border-b px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Heart className="w-4 h-4 text-primary-foreground" />
        </div>
        <span className="font-semibold">Smart Clinic — Patient Portal Demo</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Demo Patient Account</h1>
            <p className="text-muted-foreground text-sm mt-2">
              Experience the patient portal as Zanele Sithole, a registered patient at MediCare Demo Clinic.
            </p>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Patient name</span>
              <span className="font-medium">Zanele Sithole</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="font-mono text-xs">{DEMO_EMAIL}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Password</span>
              <code className="font-mono text-xs text-primary">{DEMO_PASSWORD}</code>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-6">
            {[
              { icon: Calendar, label: "Appointments" },
              { icon: FlaskConical, label: "Lab Results" },
              { icon: Activity, label: "Medical Records" },
              { icon: Receipt, label: "Invoices" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-xs text-muted-foreground p-2.5 rounded-lg bg-muted/60 border">
                <Icon className="w-3.5 h-3.5 text-primary" />
                {label}
              </div>
            ))}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4 text-center">
              {error}
            </div>
          )}

          <Button className="w-full" onClick={handleLogin} disabled={loading} data-testid="button-demo-patient-login">
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Logging in...</>
            ) : (
              "Enter as Demo Patient"
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground mt-4">
            This is a demo account with fictional medical data.
          </p>
        </div>
      </div>
    </div>
  );
}
