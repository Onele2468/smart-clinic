import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Phone, Mail, User, Trash2 } from "lucide-react";

const BASE = "http://localhost:3000";
const apiFetch = async (path: string, opts?: RequestInit) => {
  const response = await fetch(`${BASE}/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
      ...opts?.headers,
    },
  });

  const text = await response.text();

  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error("Invalid server response");
  }

  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data;
};

const supplierSchema = z.object({
  name: z.string().min(1, "Supplier name required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().optional(),
});

export default function Suppliers() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId ?? "";
  const role = clinicMembership?.role ?? "";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<any>(null);
  const [search, setSearch] = useState("");

  const canManage = ["clinic_admin", "pharmacist"].includes(role);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers", clinicId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/suppliers`),
    enabled: !!clinicId,
  });

  const form = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", address: "" },
  });

  const editForm = useForm<z.infer<typeof supplierSchema>>({
    resolver: zodResolver(supplierSchema),
    defaultValues: { name: "", contactPerson: "", phone: "", email: "", address: "" },
  });

 const addMutation = useMutation({
  mutationFn: (data: any) =>
    apiFetch(`/clinics/${clinicId}/suppliers`, {
      method: "POST",

      body: JSON.stringify({
  name: data.name,
  contactPerson: data.contactPerson,
  phone: data.phone,
  email: data.email,
  address: data.address,
}),
    }),

  onSuccess: () => {
    queryClient.invalidateQueries({
      queryKey: ["suppliers", clinicId],
    });

    toast({
      title: "Supplier added",
    });

    setIsAddOpen(false);

    form.reset();
  },

  onError: (e: any) =>
    toast({
      variant: "destructive",

      title: "Failed",

      description: e.message,
    }),
});

  const editMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/clinics/${clinicId}/suppliers/${editingSupplier?.id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", clinicId] });
      toast({ title: "Supplier updated" });
      setEditingSupplier(null);
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (supplierId: string) => apiFetch(`/clinics/${clinicId}/suppliers/${supplierId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers", clinicId] });
      toast({ title: "Supplier removed" });
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed", description: e.message }),
  });

  const filtered = (suppliers ?? []).filter((s: any) =>
    search ? s.name?.toLowerCase().includes(search.toLowerCase()) : true
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-1">Manage inventory suppliers and contacts.</p>
        </div>
        {canManage && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Supplier</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]">
              <DialogHeader><DialogTitle>Add Supplier</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => addMutation.mutate(d))} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supplier Name</FormLabel>
                      <FormControl><Input placeholder="e.g. MedPharma Wholesale" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contactPerson" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl><Input placeholder="Full name..." {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl><Input placeholder="+27..." {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="supplier@..." {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="address" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input placeholder="Physical address..." {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Adding..." : "Add Supplier"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div>
        <Input placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-sm" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
          <Truck className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No suppliers found. Add your first supplier.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((sup: any) => (
            <Card key={sup.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Truck className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{sup.name}</p>
                      {sup.contactPerson && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" /> {sup.contactPerson}
                        </p>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => { if (confirm("Remove this supplier?")) deleteMutation.mutate(sup.id); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {sup.phone && (
                    <p className="flex items-center gap-2"><Phone className="w-3 h-3 shrink-0" /> {sup.phone}</p>
                  )}
                  {sup.email && (
                    <p className="flex items-center gap-2 truncate"><Mail className="w-3 h-3 shrink-0" /> {sup.email}</p>
                  )}
                  {sup.address && (
                    <p className="text-xs">{sup.address}</p>
                  )}
                </div>
                {canManage && (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => {
                    setEditingSupplier(sup);
                    editForm.reset({ name: sup.name, contactPerson: sup.contactPerson ?? "", phone: sup.phone ?? "", email: sup.email ?? "", address: sup.address ?? "" });
                  }}>
                    Edit
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingSupplier} onOpenChange={open => !open && setEditingSupplier(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>Edit Supplier</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(d => editMutation.mutate(d))} className="space-y-4">
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Supplier Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="contactPerson" render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact Person</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
