import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  inventoryItemsTable, suppliersTable, stockMovementsTable,
  clinicsTable,
} from "@workspace/db";
import { eq, and, sql, desc, lt } from "drizzle-orm";
import { requireAuth, requireClinicMember, requireRole, requireClinicModule } from "../lib/auth";
import { logActivity } from "../lib/activityLogger";
import { logOperationalAlert } from "../services/whatsapp/operationalAlerts.triggers";
import { z } from "zod";

const router: IRouter = Router();

const CreateSupplierBody = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
});

const CreateInventoryItemBody = z.object({
  supplierId: z.string().uuid().optional(),
  name: z.string().min(1),
  genericName: z.string().optional(),
  category: z.enum(["medication", "consumable", "equipment", "other"]).default("medication"),
  unit: z.string().default("units"),
  currentStock: z.number().int().min(0).default(0),
  minimumStock: z.number().int().min(0).default(10),
  unitPrice: z.number().min(0).default(0),
  sellingPrice: z.number().min(0).default(0),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
});

const AdjustStockBody = z.object({
  type: z.enum(["restock", "dispense", "adjustment", "expired", "damaged"]),
  quantity: z.number().int(),
  notes: z.string().optional(),
  referenceId: z.string().optional(),
});

// ===== SUPPLIERS =====

router.get(
  "/clinics/:clinicId/suppliers",
  requireAuth as any,
  requireClinicMember as any,
  requireClinicModule("inventory") as any,
  async (req, res): Promise<void> => {
    const clinicId = Array.isArray(req.params.clinicId)
      ? req.params.clinicId[0]
      : req.params.clinicId;

    const suppliers = await db
  .select()
  .from(suppliersTable)
  .where(
    and(
      eq(suppliersTable.clinicId, clinicId),
      eq(suppliersTable.isActive, true)
    )
  );

res.json(suppliers);
  }
);

router.post("/clinics/:clinicId/suppliers", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

  const parsed = CreateSupplierBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [supplier] = await db.insert(suppliersTable).values({
  clinicId,
  name: parsed.data.name,
  contactPerson: parsed.data.contactPerson ?? null,
  phone: parsed.data.phone ?? null,
  email: parsed.data.email ?? null,
  address: parsed.data.address ?? null,
}).returning();

  res.status(201).json(supplier);
});

router.patch("/clinics/:clinicId/suppliers/:supplierId", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const supplierId = Array.isArray(req.params.supplierId) ? req.params.supplierId[0] : req.params.supplierId;

  const parsed = CreateSupplierBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [supplier] = await db.update(suppliersTable)
    .set(parsed.data)
    .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.clinicId, clinicId)))
    .returning();

  if (!supplier) {
    res.status(404).json({ error: "Supplier not found" });
    return;
  }

  res.json(supplier);
});

router.delete("/clinics/:clinicId/suppliers/:supplierId", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const supplierId = Array.isArray(req.params.supplierId) ? req.params.supplierId[0] : req.params.supplierId;

  await db.update(suppliersTable)
    .set({ isActive: false })
    .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.clinicId, clinicId)));

  res.json({ success: true });
});

// ===== INVENTORY ITEMS =====

router.get("/clinics/:clinicId/inventory", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const lowStock = req.query.lowStock === "true";
  const category = req.query.category as string | undefined;

  const items = await db
    .select({
      id: inventoryItemsTable.id,
      clinicId: inventoryItemsTable.clinicId,
      supplierId: inventoryItemsTable.supplierId,
      supplierName: suppliersTable.name,
      name: inventoryItemsTable.name,
      genericName: inventoryItemsTable.genericName,
      category: inventoryItemsTable.category,
      unit: inventoryItemsTable.unit,
      currentStock: inventoryItemsTable.currentStock,
      minimumStock: inventoryItemsTable.minimumStock,
      unitPrice: inventoryItemsTable.unitPrice,
      sellingPrice: inventoryItemsTable.sellingPrice,
      batchNumber: inventoryItemsTable.batchNumber,
      expiryDate: inventoryItemsTable.expiryDate,
      isActive: inventoryItemsTable.isActive,
      createdAt: inventoryItemsTable.createdAt,
      updatedAt: inventoryItemsTable.updatedAt,
    })
    .from(inventoryItemsTable)
    .leftJoin(suppliersTable, eq(inventoryItemsTable.supplierId, suppliersTable.id))
    .where(
      and(
        eq(inventoryItemsTable.clinicId, clinicId),
        eq(inventoryItemsTable.isActive, true),
        category ? eq(inventoryItemsTable.category, category) : undefined,
        lowStock ? lt(inventoryItemsTable.currentStock, inventoryItemsTable.minimumStock) : undefined,
      )
    )
    .orderBy(inventoryItemsTable.name);

  res.json(items);
});

router.post("/clinics/:clinicId/inventory", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const user = (req as any).user;

  const parsed = CreateInventoryItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { expiryDate, supplierId, genericName, batchNumber, ...rest } = parsed.data;
  const [item] = await db.insert(inventoryItemsTable).values({
    clinicId,
    supplierId: supplierId ?? null,
    genericName: genericName ?? null,
    batchNumber: batchNumber ?? null,
    expiryDate: expiryDate ? new Date(expiryDate) : null,
    ...rest,
    currentStock: rest.currentStock ?? 0,
    minimumStock: rest.minimumStock ?? 10,
    unitPrice: String(rest.unitPrice ?? 0),
    sellingPrice: String(rest.sellingPrice ?? 0),
  }).returning();

  if (item.currentStock > 0) {
    await db.insert(stockMovementsTable).values({
      clinicId,
      inventoryItemId: item.id,
      userId: user.userId,
      type: "restock",
      quantity: item.currentStock,
      previousStock: 0,
      newStock: item.currentStock,
      notes: "Initial stock on item creation",
    });
  }

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "inventory",
    actionType: "stock_added",
    type: "stock_added",
    message: `Inventory item '${item.name}' added with stock: ${item.currentStock}`,
    entityId: item.id,
  });

  res.status(201).json(item);
});

router.patch("/clinics/:clinicId/inventory/:itemId", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;

  const parsed = CreateInventoryItemBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: any = { ...parsed.data };
  if (parsed.data.expiryDate) updateData.expiryDate = new Date(parsed.data.expiryDate);
  if (parsed.data.unitPrice !== undefined) updateData.unitPrice = String(parsed.data.unitPrice);
  if (parsed.data.sellingPrice !== undefined) updateData.sellingPrice = String(parsed.data.sellingPrice);

  const [item] = await db.update(inventoryItemsTable)
    .set(updateData)
    .where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.clinicId, clinicId)))
    .returning();

  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  res.json(item);
});

// Adjust stock (restock / dispense / adjustment)
router.post("/clinics/:clinicId/inventory/:itemId/stock", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, requireRole("clinic_admin", "pharmacist") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;
  const user = (req as any).user;

  const parsed = AdjustStockBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [item] = await db.select().from(inventoryItemsTable)
    .where(and(eq(inventoryItemsTable.id, itemId), eq(inventoryItemsTable.clinicId, clinicId)));

  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return;
  }

  const { type, quantity, notes, referenceId } = parsed.data;
  const previousStock = item.currentStock;
  let delta = quantity;
  if (["dispense", "expired", "damaged"].includes(type)) delta = -Math.abs(quantity);
  else delta = Math.abs(quantity);

  const newStock = Math.max(0, previousStock + delta);

  await db.update(inventoryItemsTable)
    .set({ currentStock: newStock })
    .where(eq(inventoryItemsTable.id, itemId));

  const [movement] = await db.insert(stockMovementsTable).values({
    clinicId,
    inventoryItemId: itemId,
    userId: user.userId,
    type,
    quantity: Math.abs(delta),
    previousStock,
    newStock,
    notes: notes ?? null,
    referenceId: referenceId ?? null,
  }).returning();

  logActivity({
    clinicId,
    userId: user.userId,
    userRole: user.role,
    module: "inventory",
    actionType: "stock_adjusted",
    type: "stock_adjusted",
    message: `Stock ${type}: '${item.name}' ${delta > 0 ? "+" : ""}${delta} units (${previousStock} → ${newStock})`,
    entityId: itemId,
  });

  if (type === "restock" && delta > 0) {
    const [supplier] = item.supplierId
      ? await db.select({ name: suppliersTable.name }).from(suppliersTable).where(eq(suppliersTable.id, item.supplierId))
      : [];
    logActivity({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "inventory",
      actionType: "supplier_restock",
      type: "supplier_delivery",
      message: `Supplier delivery: ${delta} ${item.unit} of '${item.name}' restocked${supplier?.name ? ` from ${supplier.name}` : ""} (${previousStock} → ${newStock}).`,
      entityId: itemId,
    });
  }

  if (previousStock > 0 && newStock === 0) {
    logOperationalAlert({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "inventory",
      actionType: "op_alert_out_of_stock",
      message: `Out of stock: '${item.name}' has no remaining units.`,
      entityId: itemId,
    });
  } else if (previousStock >= item.minimumStock && newStock < item.minimumStock && newStock > 0) {
    logOperationalAlert({
      clinicId,
      userId: user.userId,
      userRole: user.role,
      module: "inventory",
      actionType: "op_alert_low_inventory",
      message: `Low stock alert: '${item.name}' is below minimum (${newStock}/${item.minimumStock} ${item.unit}).`,
      entityId: itemId,
    });
  }

  res.status(201).json({ movement, currentStock: newStock, lowStock: newStock < item.minimumStock });
});

// Stock movements for an item
router.get("/clinics/:clinicId/inventory/:itemId/stock", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;
  const itemId = Array.isArray(req.params.itemId) ? req.params.itemId[0] : req.params.itemId;

  const movements = await db.select().from(stockMovementsTable)
    .where(and(eq(stockMovementsTable.inventoryItemId, itemId), eq(stockMovementsTable.clinicId, clinicId)))
    .orderBy(desc(stockMovementsTable.createdAt))
    .limit(50);

  res.json(movements);
});

// Low stock summary
router.get("/clinics/:clinicId/inventory/alerts", requireAuth as any, requireClinicMember as any, requireClinicModule("inventory") as any, async (req, res): Promise<void> => {
  const clinicId = Array.isArray(req.params.clinicId) ? req.params.clinicId[0] : req.params.clinicId;

  const lowStockItems = await db.select().from(inventoryItemsTable)
    .where(
      and(
        eq(inventoryItemsTable.clinicId, clinicId),
        eq(inventoryItemsTable.isActive, true),
        lt(inventoryItemsTable.currentStock, inventoryItemsTable.minimumStock),
      )
    )
    .orderBy(inventoryItemsTable.currentStock);

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const expiringItems = await db.select().from(inventoryItemsTable)
    .where(
      and(
        eq(inventoryItemsTable.clinicId, clinicId),
        eq(inventoryItemsTable.isActive, true),
        sql`${inventoryItemsTable.expiryDate} IS NOT NULL AND ${inventoryItemsTable.expiryDate} <= ${thirtyDaysFromNow}`,
      )
    );

  res.json({ lowStock: lowStockItems, expiringSoon: expiringItems });
});

export default router;
