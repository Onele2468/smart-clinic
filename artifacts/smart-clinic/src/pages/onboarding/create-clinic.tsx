import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useLocation } from "wouter";
import { useCreateClinic, ClinicInputType } from "@workspace/api-client-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowLeft, Landmark, Heart, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const createClinicSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  type: z.nativeEnum(ClinicInputType),
  clinicType: z.enum(["private", "government", "ngo"]),
  address: z.string().min(5, { message: "Address is required" }),
  city: z.string().min(2, { message: "City is required" }),
  province: z.string().min(2, { message: "Province is required" }),
  contactNumber: z.string().min(5, { message: "Contact number is required" }),
  email: z.string().email({ message: "Valid email is required" }),
});

const clinicTypeOptions = [
  {
    value: "private",
    label: "Private Clinic",
    description: "Full billing enabled. Consultation, pharmacy, and lab fees apply.",
    icon: Shield,
    color: "border-blue-200 bg-blue-50 text-blue-900",
    selectedColor: "border-blue-500 ring-2 ring-blue-200",
  },
  {
    value: "government",
    label: "Government Clinic",
    description: "No billing. Services are free. Revenue analytics are hidden.",
    icon: Landmark,
    color: "border-green-200 bg-green-50 text-green-900",
    selectedColor: "border-green-500 ring-2 ring-green-200",
  },
  {
    value: "ngo",
    label: "NGO / Community",
    description: "Billing optional. Admin can choose whether services are free or paid.",
    icon: Heart,
    color: "border-purple-200 bg-purple-50 text-purple-900",
    selectedColor: "border-purple-500 ring-2 ring-purple-200",
  },
];

export default function CreateClinic() {
  const [, setLocation] = useLocation();
  const { refetchClinic } = useAuth();
  const { toast } = useToast();
  const createClinicMutation = useCreateClinic();

  const form = useForm<z.infer<typeof createClinicSchema>>({
    resolver: zodResolver(createClinicSchema),
    defaultValues: {
      name: "",
      type: "general",
      clinicType: "private",
      address: "",
      city: "",
      province: "",
      contactNumber: "",
      email: "",
    },
  });

  async function onSubmit(values: z.infer<typeof createClinicSchema>) {
    try {
      await createClinicMutation.mutateAsync({ data: values });
      toast({
        title: "Clinic created",
        description: "Your clinic has been successfully set up.",
      });
      refetchClinic();
      setLocation("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to create clinic",
        description: error?.message || "Please check your inputs and try again.",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 py-12">
      <Card className="w-full max-w-2xl shadow-lg border-primary/10">
        <CardHeader className="space-y-1">
          <Button variant="ghost" size="sm" className="w-fit mb-2" onClick={() => setLocation("/onboarding")} data-testid="btn-back">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
                Set Up New Clinic
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your clinic details to get started
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {/* Clinic Business Model */}
              <FormField
                control={form.control}
                name="clinicType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Model</FormLabel>
                    <div className="grid grid-cols-1 gap-3 mt-1">
                      {clinicTypeOptions.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = field.value === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => field.onChange(opt.value)}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                              opt.color,
                              isSelected ? opt.selectedColor : "opacity-70 hover:opacity-100"
                            )}
                          >
                            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-semibold text-sm">{opt.label}</p>
                              <p className="text-xs opacity-80 mt-0.5">{opt.description}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clinic Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Smart Health Clinic" {...field} data-testid="input-clinic-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specialty</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-clinic-type">
                            <SelectValue placeholder="Select specialty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="general">General Practice</SelectItem>
                          <SelectItem value="specialist">Specialist</SelectItem>
                          <SelectItem value="dental">Dental</SelectItem>
                          <SelectItem value="pediatric">Pediatric</SelectItem>
                          <SelectItem value="mental_health">Mental Health</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Medical Way" {...field} data-testid="input-clinic-address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Toronto" {...field} data-testid="input-clinic-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province / State</FormLabel>
                      <FormControl>
                        <Input placeholder="ON" {...field} data-testid="input-clinic-province" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} data-testid="input-clinic-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Email</FormLabel>
                      <FormControl>
                        <Input placeholder="info@clinic.com" type="email" {...field} data-testid="input-clinic-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full font-medium mt-6"
                disabled={createClinicMutation.isPending}
                data-testid="button-submit-create-clinic"
              >
                {createClinicMutation.isPending ? "Creating..." : "Create Clinic"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
