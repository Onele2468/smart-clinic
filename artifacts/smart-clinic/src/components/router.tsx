import React, { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useClinicModules, type ClinicModules } from "@/hooks/useClinicModules";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ShieldOff } from "lucide-react";

import Login from "@/pages/login";
import Register from "@/pages/register";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import OnboardingIndex from "@/pages/onboarding/index";
import CreateClinic from "@/pages/onboarding/create-clinic";
import JoinClinic from "@/pages/onboarding/join-clinic";
import Demo from "@/pages/demo";
import Dashboard from "@/pages/dashboard";
import Queue from "@/pages/queue";
import Patients from "@/pages/patients/index";
import PatientDetail from "@/pages/patients/[id]";
import Appointments from "@/pages/appointments";
import ConsultationPage from "@/pages/consultations/[patientId]";
import Pharmacy from "@/pages/pharmacy";
import Lab from "@/pages/lab";
import Billing from "@/pages/billing";
import Inventory from "@/pages/inventory";
import Suppliers from "@/pages/suppliers";
import Staff from "@/pages/staff";
import Settings from "@/pages/settings";
import ActivityLogs from "@/pages/activity-logs";
import Analytics from "@/pages/analytics";
import Notifications from "@/pages/notifications";
import StaffAvailability from "@/pages/staff-availability";
import NotFound from "@/pages/not-found";

const routeRoles: Record<string, string[]> = {
  "/staff": ["clinic_admin"],
  "/settings": ["clinic_admin"],
  "/activity": ["clinic_admin"],
  "/analytics": ["clinic_admin"],
  "/queue": ["clinic_admin", "doctor", "nurse", "receptionist"],
  "/patients": ["clinic_admin", "doctor", "nurse", "receptionist", "cashier"],
  "/appointments": ["clinic_admin", "doctor", "receptionist"],
  "/consultations": ["clinic_admin", "doctor"],
  "/pharmacy": ["clinic_admin", "pharmacist", "nurse"],
  "/lab": ["clinic_admin", "lab_technician", "doctor"],
  "/billing": ["clinic_admin", "cashier", "receptionist"],
  "/inventory": ["clinic_admin", "pharmacist"],
  "/suppliers": ["clinic_admin", "pharmacist"],
  "/staff-availability": ["clinic_admin", "doctor", "nurse", "receptionist"],
  "/notifications": ["clinic_admin", "doctor", "nurse", "receptionist", "pharmacist", "lab_technician", "cashier"],
};

function ProtectedRoute({
  component: Component,
  requireClinic = true,
  allowedRoles,
}: {
  component: React.ComponentType;
  requireClinic?: boolean;
  allowedRoles?: string[];
}) {
  const { user, clinicMembership, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        setLocation("/login");
      } else if (requireClinic && (!clinicMembership || clinicMembership.status !== "active")) {
        setLocation("/onboarding");
      } else if (allowedRoles && clinicMembership && !allowedRoles.includes(clinicMembership.role)) {
        setLocation("/dashboard");
      }
    }
  }, [user, clinicMembership, isLoading, location, requireClinic, allowedRoles, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!user) return null;
  if (requireClinic && (!clinicMembership || clinicMembership.status !== "active")) return null;
  if (allowedRoles && clinicMembership && !allowedRoles.includes(clinicMembership.role)) return null;

  return <Component />;
}

function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

function ModuleUnavailable({ moduleName }: { moduleName: string }) {
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="text-center py-20 space-y-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
          <ShieldOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold">Module Not Available</h2>
        <p className="text-muted-foreground">
          The <span className="font-semibold">{moduleName}</span> module is not part of your
          clinic's configuration. Government clinics operate without billing, pharmacy,
          laboratory, inventory, and supplier management.
        </p>
        <p className="text-xs text-muted-foreground">
          Contact your system administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

function ProtectedPage({
  component: Component,
  allowedRoles,
}: {
  component: React.ComponentType;
  allowedRoles?: string[];
}) {
  return (
    <ProtectedRoute
      component={() => (
        <MainLayout>
          <Component />
        </MainLayout>
      )}
      allowedRoles={allowedRoles}
    />
  );
}

/** Route that checks a clinic-type module flag before rendering the page. */
function ModuleRoute({
  component: Component,
  allowedRoles,
  moduleFlag,
  moduleName,
}: {
  component: React.ComponentType;
  allowedRoles?: string[];
  moduleFlag: keyof ClinicModules;
  moduleName: string;
}) {
  const modules = useClinicModules();
  if (!modules[moduleFlag]) {
    return (
      <ProtectedRoute
        component={() => (
          <MainLayout>
            <ModuleUnavailable moduleName={moduleName} />
          </MainLayout>
        )}
      />
    );
  }
  return <ProtectedPage component={Component} allowedRoles={allowedRoles} />;
}

export function AppRouter() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <Switch>
      {/* Demo Mode */}
      <Route path="/demo" component={Demo} />

      {/* Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* Onboarding Routes */}
      <Route path="/onboarding">
        <ProtectedRoute component={OnboardingIndex} requireClinic={false} />
      </Route>
      <Route path="/onboarding/create-clinic">
        <ProtectedRoute component={CreateClinic} requireClinic={false} />
      </Route>
      <Route path="/onboarding/join-clinic">
        <ProtectedRoute component={JoinClinic} requireClinic={false} />
      </Route>

      {/* Main App Routes */}
      <Route path="/">
        <ProtectedPage component={Dashboard} />
      </Route>
      <Route path="/dashboard">
        <ProtectedPage component={Dashboard} />
      </Route>
      <Route path="/queue">
        <ProtectedPage component={Queue} allowedRoles={routeRoles["/queue"]} />
      </Route>
      <Route path="/patients">
        <ProtectedPage component={Patients} allowedRoles={routeRoles["/patients"]} />
      </Route>
      <Route path="/patients/:id">
        <ProtectedPage component={PatientDetail} allowedRoles={routeRoles["/patients"]} />
      </Route>
      <Route path="/appointments">
        <ProtectedPage component={Appointments} allowedRoles={routeRoles["/appointments"]} />
      </Route>
      <Route path="/consultations/:patientId">
        <ProtectedPage component={ConsultationPage} allowedRoles={routeRoles["/consultations"]} />
      </Route>
      <Route path="/pharmacy">
        <ModuleRoute component={Pharmacy} allowedRoles={routeRoles["/pharmacy"]} moduleFlag="hasPharmacy" moduleName="Pharmacy" />
      </Route>
      <Route path="/lab">
        <ModuleRoute component={Lab} allowedRoles={routeRoles["/lab"]} moduleFlag="hasLaboratory" moduleName="Laboratory" />
      </Route>
      <Route path="/billing">
        <ModuleRoute component={Billing} allowedRoles={routeRoles["/billing"]} moduleFlag="hasBilling" moduleName="Billing" />
      </Route>
      <Route path="/inventory">
        <ModuleRoute component={Inventory} allowedRoles={routeRoles["/inventory"]} moduleFlag="hasInventory" moduleName="Inventory" />
      </Route>
      <Route path="/suppliers">
        <ModuleRoute component={Suppliers} allowedRoles={routeRoles["/suppliers"]} moduleFlag="hasSuppliers" moduleName="Suppliers" />
      </Route>
      <Route path="/staff">
        <ProtectedPage component={Staff} allowedRoles={routeRoles["/staff"]} />
      </Route>
      <Route path="/settings">
        <ProtectedPage component={Settings} allowedRoles={routeRoles["/settings"]} />
      </Route>
      <Route path="/analytics">
        <ProtectedPage component={Analytics} allowedRoles={routeRoles["/analytics"]} />
      </Route>
      <Route path="/activity">
        <ProtectedPage component={ActivityLogs} allowedRoles={routeRoles["/activity"]} />
      </Route>
      <Route path="/notifications">
        <ProtectedPage component={Notifications} allowedRoles={routeRoles["/notifications"]} />
      </Route>
      <Route path="/staff-availability">
        <ProtectedPage component={StaffAvailability} allowedRoles={routeRoles["/staff-availability"]} />
      </Route>

      {/* Fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}
