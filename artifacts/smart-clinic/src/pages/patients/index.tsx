import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useListPatients,
  useCreatePatient,
  getListPatientsQueryKey,
  PatientInputGender,
} from "@workspace/api-client-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { Search, Plus, User } from "lucide-react";

import { Link } from "wouter";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import * as z from "zod";

import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const registerPatientSchema = z.object({
  firstName: z.string().min(2, "First name is required"),

  lastName: z.string().min(2, "Surname is required"),

  nickname: z.string().optional(),

  dateOfBirth: z.string().min(1, "Date of birth is required"),

  gender: z.nativeEnum(PatientInputGender),

  contactNumber: z.string().min(5, "Contact number is required"),

  email: z.string().email().optional().or(z.literal("")),

  address: z.string().optional(),

  governmentIdType: z.string().optional(),

  governmentIdNumber: z.string().optional(),

  emergencyContactPhone: z.string().optional(),
});

export default function Patients() {
  const { clinicMembership } = useAuth();

  const clinicId = clinicMembership?.clinicId || "";

  const { toast } = useToast();

  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);

  const { data: patients, isLoading } = useListPatients(
    clinicId,
    { search: search || undefined },
    {
      query: {
        enabled: !!clinicId,
        queryKey: getListPatientsQueryKey(clinicId, {
          search: search || undefined,
        }),
      },
    }
  );

  const createPatientMutation = useCreatePatient();

  const form = useForm<z.infer<typeof registerPatientSchema>>({
    resolver: zodResolver(registerPatientSchema),

    defaultValues: {
      firstName: "",

      lastName: "",

      nickname: "",

      dateOfBirth: "",

      gender: "other",

      contactNumber: "",

      email: "",

      address: "",

      governmentIdType: "",

      governmentIdNumber: "",

      emergencyContactPhone: "",
    },
  });

  const onSubmit = async (
    values: z.infer<typeof registerPatientSchema>
  ) => {
    try {
      await createPatientMutation.mutateAsync({
        clinicId,
        data: values,
      });

      queryClient.invalidateQueries({
        queryKey: getListPatientsQueryKey(clinicId),
      });

      toast({
        title: "Patient registered successfully",
      });

      setIsRegisterOpen(false);

      form.reset();
    } catch (error: any) {
      toast({
        variant: "destructive",

        title: "Failed to register patient",

        description: error?.message,
      });
    }
  };

  return (
    <div className="p-8 space-y-6">

      <div className="flex items-center justify-between">

        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Patients
          </h1>

          <p className="text-muted-foreground mt-1">
            Manage patient records and histories.
          </p>
        </div>

        <Dialog
          open={isRegisterOpen}
          onOpenChange={setIsRegisterOpen}
        >

          <DialogTrigger asChild>
            <Button data-testid="btn-add-patient">
              <Plus className="w-4 h-4 mr-2" />
              Register Patient
            </Button>
          </DialogTrigger>

          <DialogContent className="max-w-3xl">

            <DialogHeader>
              <DialogTitle>
                Register New Patient
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>

              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >

                <div className="grid grid-cols-3 gap-4">

                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          First Name
                        </FormLabel>

                        <FormControl>
                          <Input {...field} />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Surname
                        </FormLabel>

                        <FormControl>
                          <Input {...field} />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nickname"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Nickname (Optional)
                        </FormLabel>

                        <FormControl>
                          <Input
                            placeholder="Preferred name"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <FormField
                    control={form.control}
                    name="dateOfBirth"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Date of Birth
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>

                        <FormLabel>
                          Gender
                        </FormLabel>

                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >

                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select gender" />
                            </SelectTrigger>
                          </FormControl>

                          <SelectContent>
                            <SelectItem value="male">
                              Male
                            </SelectItem>

                            <SelectItem value="female">
                              Female
                            </SelectItem>

                            <SelectItem value="other">
                              Other
                            </SelectItem>
                          </SelectContent>

                        </Select>

                        <FormMessage />

                      </FormItem>
                    )}
                  />

                </div>

                <div className="grid grid-cols-2 gap-4">

                  <FormField
                    control={form.control}
                    name="contactNumber"
                    render={({ field }) => (
                      <FormItem>

                        <FormLabel>
                          Contact Number
                        </FormLabel>

                        <FormControl>
                          <Input {...field} />
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

                        <FormLabel>
                          Email (Optional)
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="email"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />

                      </FormItem>
                    )}
                  />

                </div>

                <div className="grid grid-cols-3 gap-4">

                  <FormField
                    control={form.control}
                    name="governmentIdType"
                    render={({ field }) => (
                      <FormItem>

                        <FormLabel>
                          ID Type
                        </FormLabel>

                        <FormControl>
                          <Input
                            placeholder="Passport / National ID"
                            {...field}
                          />
                        </FormControl>

                        <FormMessage />

                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="governmentIdNumber"
                    render={({ field }) => (
                      <FormItem>

                        <FormLabel>
                          ID / Passport Number
                        </FormLabel>

                        <FormControl>
                          <Input {...field} />
                        </FormControl>

                        <FormMessage />

                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>

                        <FormLabel>
                          Emergency Contact Phone
                        </FormLabel>

                        <FormControl>
                          <Input
                            placeholder="Emergency contact number"
                            {...field}
                          />
                        </FormControl>

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

                      <FormLabel>
                        Address (Optional)
                      </FormLabel>

                      <FormControl>
                        <Input {...field} />
                      </FormControl>

                      <FormMessage />

                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createPatientMutation.isPending}
                >

                  {createPatientMutation.isPending
                    ? "Registering..."
                    : "Register Patient"}

                </Button>

              </form>

            </Form>

          </DialogContent>

        </Dialog>

      </div>

      <Card>

        <CardHeader className="py-4">

          <div className="relative w-full max-w-sm">

            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />

            <Input
              placeholder="Search patients by name or code..."
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-patients"
            />

          </div>

        </CardHeader>

        <CardContent>

          {isLoading ? (

            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton
                  key={i}
                  className="h-16 w-full"
                />
              ))}
            </div>

          ) : patients?.length === 0 ? (

            <div className="text-center py-8 text-muted-foreground">
              No patients found.
            </div>

          ) : (

            <div className="divide-y border rounded-md">

              {patients?.map((patient) => (

                <div
                  key={patient.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  data-testid={`patient-row-${patient.id}`}
                >

                  <div className="flex items-center space-x-4">

                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                      <User className="h-5 w-5 text-secondary-foreground" />
                    </div>

                    <div>

                      <Link
                        href={`/patients/${patient.id}`}
                        className="font-semibold hover:underline"
                      >
                        {patient.firstName} {patient.lastName}
                      </Link>

                      <div className="text-sm text-muted-foreground">
                        {patient.patientCode} • {patient.contactNumber}
                      </div>

                    </div>

                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                  >

                    <Link href={`/patients/${patient.id}`}>
                      View Details
                    </Link>

                  </Button>

                </div>

              ))}

            </div>

          )}

        </CardContent>

      </Card>

    </div>
  );
}