import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useLookupClinic, useCreateJoinRequest, JoinRequestInputRequestedRole, getLookupClinicQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Users, ArrowLeft, Search, CheckCircle2 } from "lucide-react";

const lookupSchema = z.object({
  code: z.string().min(5, { message: "Please enter a valid clinic code" }),
});

const joinSchema = z.object({
  requestedRole: z.nativeEnum(JoinRequestInputRequestedRole),
  message: z.string().optional(),
});

export default function JoinClinic() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [clinicCode, setClinicCode] = useState("");
  const [success, setSuccess] = useState(false);

  const { data: clinic, isLoading: isLookingUp, error: lookupError, refetch: performLookup } = useLookupClinic(
    { code: clinicCode },
    { query: { enabled: false, retry: false, queryKey: getLookupClinicQueryKey({ code: clinicCode }) } }
  );

  const createJoinRequestMutation = useCreateJoinRequest();

  const lookupForm = useForm<z.infer<typeof lookupSchema>>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      code: "",
    },
  });

  const joinForm = useForm<z.infer<typeof joinSchema>>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      requestedRole: JoinRequestInputRequestedRole.doctor,
      message: "",
    },
  });

  async function onLookupSubmit(values: z.infer<typeof lookupSchema>) {
    setClinicCode(values.code);
    setTimeout(() => performLookup(), 0);
  }

  async function onJoinSubmit(values: z.infer<typeof joinSchema>) {
    if (!clinic) return;

    try {
      await createJoinRequestMutation.mutateAsync({ clinicId: clinic.id, data: values });
      setSuccess(true);
      toast({
        title: "Request sent",
        description: "Your join request is pending admin approval.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to send request",
        description: error?.message || "You may have already requested to join this clinic.",
      });
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
        <Card className="w-full max-w-md shadow-lg border-primary/10 text-center">
          <CardContent className="pt-10 pb-10 space-y-6">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Request Sent</h2>
              <p className="text-muted-foreground">
                Your request to join <strong>{clinic?.name}</strong> has been sent. An administrator will review it shortly.
              </p>
            </div>
            <Button onClick={() => setLocation("/login")} variant="outline" className="mt-4">
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-1">
          <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setLocation("/onboarding")} data-testid="btn-back">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Join Clinic
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter a clinic code to request access
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!clinic ? (
            <Form {...lookupForm}>
              <form onSubmit={lookupForm.handleSubmit(onLookupSubmit)} className="space-y-4">
                <FormField
                  control={lookupForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clinic Code</FormLabel>
                      <div className="flex space-x-2">
                        <FormControl>
                          <Input placeholder="SC-123456" {...field} data-testid="input-clinic-code" />
                        </FormControl>
                        <Button type="submit" disabled={isLookingUp} data-testid="btn-lookup">
                          <Search className="h-4 w-4 mr-2" /> Find
                        </Button>
                      </div>
                      {lookupError && (
                        <p className="text-sm font-medium text-destructive mt-2">
                          Clinic not found. Check the code and try again.
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          ) : (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-lg border border-border">
                <h3 className="font-semibold text-lg">{clinic.name}</h3>
                <p className="text-sm text-muted-foreground">{clinic.city}{clinic.province ? `, ${clinic.province}` : ''}</p>
                <div className="mt-2">
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => { setClinicCode(""); performLookup(); }}>
                    Wrong clinic? Search again
                  </Button>
                </div>
              </div>

              <Form {...joinForm}>
                <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
                  <FormField
                    control={joinForm.control}
                    name="requestedRole"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>I am joining as a...</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-join-role">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="doctor">Doctor</SelectItem>
                            <SelectItem value="nurse">Nurse</SelectItem>
                            <SelectItem value="receptionist">Receptionist</SelectItem>
                            <SelectItem value="pharmacist">Pharmacist</SelectItem>
                            <SelectItem value="lab_technician">Lab Technician</SelectItem>
                            <SelectItem value="cashier">Cashier</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={joinForm.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Message (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="E.g., Hi, I'm the new nurse." {...field} data-testid="input-join-message" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full font-medium mt-2"
                    disabled={createJoinRequestMutation.isPending}
                    data-testid="btn-submit-join"
                  >
                    {createJoinRequestMutation.isPending ? "Sending..." : "Request to Join"}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
