import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLogin } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Activity, Stethoscope, UserCog, ClipboardList, Pill, FlaskConical, Receipt, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEMO_PASSWORD = "Demo@1234";
const DEMO_CLINIC = "MediCare Demo Clinic";

const DEMO_ACCOUNTS = [
  {
    email: "admin@democlinic.com",
    role: "Clinic Admin",
    name: "Dr. Sarah Johnson",
    icon: UserCog,
    color: "bg-violet-100 text-violet-700",
    badge: "bg-violet-100 text-violet-700",
    description: "Full platform access. Manage staff, analytics, settings, and all workflows.",
    highlights: ["Dashboard analytics", "Staff management", "Billing overview", "Clinic settings"],
  },
  {
    email: "doctor@democlinic.com",
    role: "Doctor",
    name: "Dr. Michael Chen",
    icon: Stethoscope,
    color: "bg-blue-100 text-blue-700",
    badge: "bg-blue-100 text-blue-700",
    description: "Manage consultations, prescriptions, and lab requests for your patients.",
    highlights: ["Consultation workflow", "Prescription writing", "Lab requests", "Patient EMR"],
  },
  {
    email: "nurse@democlinic.com",
    role: "Nurse",
    name: "Nurse Amara Dlamini",
    icon: Activity,
    color: "bg-green-100 text-green-700",
    badge: "bg-green-100 text-green-700",
    description: "Triage patients, record vitals, and manage the live queue.",
    highlights: ["Patient triage", "Vitals recording", "Queue management", "Patient check-in"],
  },
  {
    email: "reception@democlinic.com",
    role: "Receptionist",
    name: "Thandi Mokoena",
    icon: ClipboardList,
    color: "bg-cyan-100 text-cyan-700",
    badge: "bg-cyan-100 text-cyan-700",
    description: "Register patients, book appointments, and manage the front desk.",
    highlights: ["Patient registration", "Appointment booking", "Queue check-in", "Daily schedule"],
  },
  {
    email: "pharmacist@democlinic.com",
    role: "Pharmacist",
    name: "James Botha",
    icon: Pill,
    color: "bg-amber-100 text-amber-700",
    badge: "bg-amber-100 text-amber-700",
    description: "Dispense prescriptions and manage medication inventory and stock levels.",
    highlights: ["Prescription dispensing", "Inventory management", "Low stock alerts", "Stock movements"],
  },
  {
    email: "lab@democlinic.com",
    role: "Lab Technician",
    name: "Priya Naidoo",
    icon: FlaskConical,
    color: "bg-orange-100 text-orange-700",
    badge: "bg-orange-100 text-orange-700",
    description: "Process lab requests and submit test results for doctors to review.",
    highlights: ["Lab request queue", "Urgent test alerts", "Result submission", "Test tracking"],
  },
  {
    email: "cashier@democlinic.com",
    role: "Cashier",
    name: "Sipho Ndlovu",
    icon: Receipt,
    color: "bg-rose-100 text-rose-700",
    badge: "bg-rose-100 text-rose-700",
    description: "Process patient payments, manage invoices, and track billing.",
    highlights: ["Invoice management", "Payment processing", "Revenue tracking", "Billing reports"],
  },
];

export default function DemoPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const [loggingIn, setLoggingIn] = useState<string | null>(null);

  const handleLogin = async (email: string) => {
    setLoggingIn(email);
    try {
      const result = await loginMutation.mutateAsync({ data: { email, password: DEMO_PASSWORD } });
      login(result.token);
      setLocation("/dashboard");
    } catch {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: "Demo data may not be seeded. Run: npm run seed-demo -w @workspace/scripts",
      });
    } finally {
      setLoggingIn(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-lg">Smart Clinic</span>
              <Badge className="ml-2 bg-primary/10 text-primary border-0 text-xs">Demo Mode</Badge>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setLocation("/login")}>
            Staff Login <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
            Smart Clinic — Demo Environment
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Explore the full platform from any role. Click a card below to log in instantly as that user.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border text-sm">
            <span className="text-muted-foreground">Demo clinic:</span>
            <span className="font-semibold">{DEMO_CLINIC}</span>
            <span className="text-muted-foreground mx-2">·</span>
            <span className="text-muted-foreground">Password:</span>
            <code className="font-mono font-semibold text-primary">Demo@1234</code>
          </div>
        </div>

        {/* Account cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DEMO_ACCOUNTS.map((account) => {
            const Icon = account.icon;
            const isLoading = loggingIn === account.email;
            return (
              <div
                key={account.email}
                className="bg-background rounded-xl border shadow-sm hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${account.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm leading-tight">{account.name}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${account.badge}`}>
                        {account.role}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{account.description}</p>
                  <ul className="space-y-1">
                    {account.highlights.map((h) => (
                      <li key={h} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-primary shrink-0" />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 pt-0">
                  <p className="text-[11px] text-muted-foreground font-mono mb-2">{account.email}</p>
                  <Button
                    className="w-full h-8 text-sm"
                    onClick={() => handleLogin(account.email)}
                    disabled={!!loggingIn}
                    data-testid={`button-demo-login-${account.role.toLowerCase().replace(" ", "-")}`}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Logging in...</>
                    ) : (
                      <>Login as {account.role}</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-8">
          This is a demonstration environment. All data is fictional and for presentation purposes only.
        </p>
      </div>
    </div>
  );
}
