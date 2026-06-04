import React from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import AppointmentsPage from "@/pages/appointments";
import PrescriptionsPage from "@/pages/prescriptions";
import LabResultsPage from "@/pages/lab-results";
import MedicalRecordsPage from "@/pages/medical-records";
import InvoicesPage from "@/pages/invoices";
import ProfilePage from "@/pages/profile";
import ClinicCardPage from "@/pages/clinic-card";
import QueuePage from "@/pages/queue";
import DemoPage from "@/pages/demo";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: () => React.ReactElement | null }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function PublicRoute({ component: Component }: { component: () => React.ReactElement | null }) {
  const { user } = useAuth();
  if (user) return <Redirect to="/" />;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/demo" component={DemoPage} />
      <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
      <Route path="/register" component={() => <PublicRoute component={RegisterPage} />} />
      <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
      <Route path="/appointments" component={() => <ProtectedRoute component={AppointmentsPage} />} />
      <Route path="/prescriptions" component={() => <ProtectedRoute component={PrescriptionsPage} />} />
      <Route path="/lab-results" component={() => <ProtectedRoute component={LabResultsPage} />} />
      <Route path="/medical-records" component={() => <ProtectedRoute component={MedicalRecordsPage} />} />
      <Route path="/invoices" component={() => <ProtectedRoute component={InvoicesPage} />} />
      <Route path="/clinic-card" component={() => <ProtectedRoute component={ClinicCardPage} />} />
      <Route path="/queue" component={() => <ProtectedRoute component={QueuePage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
