import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Package, Plus, AlertTriangle, TrendingDown, RefreshCw, ArrowUpDown
} from "lucide-react";

const BASE = import.meta.env.BASE_URL;
const apiFetch = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}`, ...opts?.headers },
  }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Request failed"); return d; });

const addItemSchema = z.object({
  name: z.string().min(1, "Name required"),
  genericName: z.string().optional(),
  category: z.enum(["medication", "consumable", "equipment", "other"]),
  unit: z.string().min(1, "Unit required"),
  currentStock: z.coerce.number().int().min(0),
  minimumStock: z.coerce.number().int().min(0),
  unitPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const adjustStockSchema = z.object({
  type: z.enum(["restock", "dispense", "adjustment", "expired", "damaged"]),
  quantity: z.coerce.number().int().min(1),
  notes: z.string().optional(),
});

const categoryColor: Record<string, string> = {
  medication: "bg-blue-100 text-blue-800",
  consumable: "bg-green-100 text-green-800",
  equipment: "bg-purple-100 text-purple-800",
  other: "bg-gray-100 text-gray-800",
};

export default function Inventory() {
  const { clinicMembership } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const clinicId = clinicMembership?.clinicId ?? "";
  const role = clinicMembership?.role ?? "";

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all__");

  const canManage = ["clinic_admin", "pharmacist"].includes(role);

  const { data: items, isLoading } = useQuery({
    queryKey: ["inventory", clinicId, categoryFilter],
    queryFn: () => apiFetch(`/clinics/${clinicId}/inventory${categoryFilter !== "__all__" ? `?category=${categoryFilter}` : ""}`),
    enabled: !!clinicId,
  });

  const { data: alerts } = useQuery({
    queryKey: ["inventory-alerts", clinicId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/inventory/alerts`),
    enabled: !!clinicId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", clinicId],
    queryFn: () => apiFetch(`/clinics/${clinicId}/suppliers`),
    enabled: !!clinicId,
  });

  const form = useForm<z.infer<typeof addItemSchema>>({
    resolver: zodResolver(addItemSchema),
    defaultValues: { name: "", category: "medication", unit: "units", currentStock: 0, minimumStock: 10, unitPrice: 0, sellingPrice: 0 },
  });

  const adjustForm = useForm<z.infer<typeof adjustStockSchema>>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { type: "restock", quantity: 1, notes: "" },
  });

  const addItemMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/clinics/${clinicId}/inventory`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts", clinicId] });
      toast({ title: "Item added to inventory" });
      setIsAddOpen(false);
      form.reset();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to add item", description: e.message }),
  });

  const adjustStockMutation = useMutation({
    mutationFn: (data: any) => apiFetch(`/clinics/${clinicId}/inventory/${selectedItem?.id}/stock`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory", clinicId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-alerts", clinicId] });
      toast({ title: "Stock adjusted successfully" });
      setIsAdjustOpen(false);
      adjustForm.reset();
    },
    onError: (e: any) => toast({ variant: "destructive", title: "Failed to adjust stock", description: e.message }),
  });

  const filtered = (items ?? []).filter((it: any) =>
    search ? it.name?.toLowerCase().includes(search.toLowerCase()) || it.genericName?.toLowerCase().includes(search.toLowerCase()) : true
  );

  const lowStockCount = alerts?.lowStock?.length ?? 0;
  const expiringCount = alerts?.expiringSoon?.length ?? 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Track medicines and supplies.</p>
        </div>
        {canManage && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Add Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[540px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(d => addItemMutation.mutate(d))} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Item Name</FormLabel>
                        <FormControl><Input placeholder="e.g. Paracetamol 500mg" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="genericName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Generic Name</FormLabel>
                        <FormControl><Input placeholder="Generic..." {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="category" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="medication">Medication</SelectItem>
                            <SelectItem value="consumable">Consumable</SelectItem>
                            <SelectItem value="equipment">Equipment</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="unit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <FormControl><Input placeholder="units / tablets / ml" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="currentStock" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Stock</FormLabel>
                        <FormControl><Input type="number" min={0} {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="minimumStock" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Stock (alert)</FormLabel>
                        <FormControl><Input type="number" min={0} {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="unitPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Price</FormLabel>
                        <FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="sellingPrice" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Selling Price</FormLabel>
                        <FormControl><Input type="number" min={0} step={0.01} {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="batchNumber" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Batch #</FormLabel>
                        <FormControl><Input placeholder="Optional" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="expiryDate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiry Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <Button type="submit" className="w-full" disabled={addItemMutation.isPending}>
                    {addItemMutation.isPending ? "Adding..." : "Add to Inventory"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Alerts row */}
      {(lowStockCount > 0 || expiringCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {lowStockCount > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-orange-600 shrink-0" />
                <div>
                  <p className="font-semibold text-orange-900">{lowStockCount} Low Stock {lowStockCount === 1 ? "Alert" : "Alerts"}</p>
                  <p className="text-sm text-orange-700">Items below minimum stock level</p>
                </div>
              </CardContent>
            </Card>
          )}
          {expiringCount > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
                <div>
                  <p className="font-semibold text-red-900">{expiringCount} Expiring Soon</p>
                  <p className="text-sm text-red-700">Items expiring within 30 days</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Categories</SelectItem>
            <SelectItem value="medication">Medication</SelectItem>
            <SelectItem value="consumable">Consumable</SelectItem>
            <SelectItem value="equipment">Equipment</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Item Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-40 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No inventory items found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: any) => {
            const isLow = item.currentStock < item.minimumStock;
            const isOut = item.currentStock === 0;
            return (
              <Card key={item.id} className={isOut ? "border-red-300" : isLow ? "border-orange-300" : ""}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.name}</p>
                      {item.genericName && <p className="text-xs text-muted-foreground">{item.genericName}</p>}
                    </div>
                    <Badge variant="outline" className={`text-xs shrink-0 ${categoryColor[item.category]}`}>{item.category}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-2xl font-bold ${isOut ? "text-red-600" : isLow ? "text-orange-600" : "text-foreground"}`}>{item.currentStock}</p>
                      <p className="text-xs text-muted-foreground">{item.unit} in stock</p>
                    </div>
                    {isLow && (
                      <Badge variant="outline" className={isOut ? "bg-red-100 text-red-800 border-red-200" : "bg-orange-100 text-orange-800 border-orange-200"}>
                        {isOut ? "OUT OF STOCK" : "LOW STOCK"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex justify-between">
                    <span>Min: {item.minimumStock} {item.unit}</span>
                    {item.sellingPrice > 0 && <span>R {Number(item.sellingPrice).toFixed(2)} / {item.unit}</span>}
                  </div>
                  {canManage && (
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedItem(item); adjustForm.reset({ type: "restock", quantity: 1 }); setIsAdjustOpen(true); }}>
                      <ArrowUpDown className="w-3 h-3 mr-1" /> Adjust Stock
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader><DialogTitle>Adjust Stock — {selectedItem?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Current: <span className="font-semibold text-foreground">{selectedItem?.currentStock} {selectedItem?.unit}</span></p>
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(d => adjustStockMutation.mutate(d))} className="space-y-4">
              <FormField control={adjustForm.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Movement Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="restock">Restock (add)</SelectItem>
                      <SelectItem value="dispense">Dispense (remove)</SelectItem>
                      <SelectItem value="adjustment">Manual Adjustment</SelectItem>
                      <SelectItem value="expired">Expired (remove)</SelectItem>
                      <SelectItem value="damaged">Damaged (remove)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={adjustForm.control} name="quantity" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl><Input type="number" min={1} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={adjustForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl><Input placeholder="Reason for adjustment..." {...field} /></FormControl>
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={adjustStockMutation.isPending}>
                {adjustStockMutation.isPending ? "Saving..." : "Confirm Adjustment"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
