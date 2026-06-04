import React, { useEffect, useState } from "react";

interface InventoryItem {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  supplierName?: string;
  unitPrice: string;
  sellingPrice: string;
  batchNumber?: string;
  expiryDate?: string;
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const clinicId = localStorage.getItem("clinicId");

  async function loadInventory() {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `/api/clinics/${clinicId}/inventory`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await res.json();

      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  if (loading) {
    return <div className="p-6">Loading inventory...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">
            Inventory
          </h1>

          <p className="text-gray-500">
            Manage clinic inventory and stock.
          </p>
        </div>

        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          Add Item
        </button>
      </div>

      <div className="grid gap-4">
        {items.map((item) => {
          const lowStock =
            item.currentStock < item.minimumStock;

          return (
            <div
              key={item.id}
              className="border rounded-xl p-5 bg-white shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {item.name}
                  </h2>

                  {item.genericName && (
                    <p className="text-gray-500">
                      {item.genericName}
                    </p>
                  )}

                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      Category: {item.category}
                    </p>

                    <p>
                      Supplier: {item.supplierName || "N/A"}
                    </p>

                    <p>
                      Stock: {item.currentStock}
                    </p>

                    <p>
                      Minimum Stock: {item.minimumStock}
                    </p>

                    <p>
                      Unit Price: R{item.unitPrice}
                    </p>

                    <p>
                      Selling Price: R{item.sellingPrice}
                    </p>
                  </div>
                </div>

                <div>
                  {lowStock ? (
                    <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm">
                      Low Stock
                    </span>
                  ) : (
                    <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                      In Stock
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}