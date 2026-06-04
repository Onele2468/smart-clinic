import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Users, ArrowLeft } from "lucide-react";

export default function OnboardingIndex() {
  const { user, clinicMembership } = useAuth();
  const [, setLocation] = useLocation();

  // If already in a clinic, redirect to dashboard
  if (clinicMembership && clinicMembership.status === "active") {
    setLocation("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="max-w-3xl w-full space-y-8">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLocation("/login")}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </div>
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground text-lg">
            Let's get you set up with a clinic to start using the platform.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setLocation("/onboarding/create-clinic")} data-testid="card-create-clinic">
            <CardHeader>
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle>Create a New Clinic</CardTitle>
              <CardDescription>
                Set up a brand new clinic. You will be assigned as the Clinic Admin with full control over settings and staff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                Create Clinic
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setLocation("/onboarding/join-clinic")} data-testid="card-join-clinic">
            <CardHeader>
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <CardTitle>Join Existing Clinic</CardTitle>
              <CardDescription>
                Have a clinic code? Request to join an existing clinic team. An admin will need to approve your request.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">
                Join Clinic
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
