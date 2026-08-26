import { pgTable, text, timestamp, uuid, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clinicsTable } from "./clinics";
import { usersTable } from "./users";

export const suppliersTable = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const inventoryItemsTable = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  supplierId: uuid("supplier_id").references(() => suppliersTable.id),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  category: text("category").notNull().default("medication"), // medication | consumable | equipment | other
  unit: text("unit").notNull().default("units"),
  currentStock: integer("current_stock").notNull().default(0),
  minimumStock: integer("minimum_stock").notNull().default(10),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull().default("0"),
  sellingPrice: numeric("selling_price", { precision: 12, scale: 2 }).notNull().default("0"),
  batchNumber: text("batch_number"),
  expiryDate: timestamp("expiry_date", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const stockMovementsTable = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  clinicId: uuid("clinic_id").notNull().references(() => clinicsTable.id),
  inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItemsTable.id),
  userId: uuid("user_id").references(() => usersTable.id),
  type: text("type").notNull(), // restock | dispense | adjustment | expired | damaged
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  notes: text("notes"),
  referenceId: text("reference_id"), // link to prescription / lab request if dispensed
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItemsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertStockMovementSchema = createInsertSchema(stockMovementsTable).omit({ id: true, createdAt: true });

export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;
export type InventoryItem = typeof inventoryItemsTable.$inferSelect;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
