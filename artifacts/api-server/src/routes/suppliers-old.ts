import { Router } from "express";

const router = Router();

// GET suppliers
router.get("/clinics/:clinicId/suppliers", async (req, res) => {
  try {
    const { clinicId } = req.params;

    const result = await (global as any).db.query(
      `
      SELECT *
      FROM suppliers
      WHERE clinic_id = $1
      ORDER BY created_at DESC
      `,
      [clinicId]
    );

    res.json(result.rows);

  } catch (error) {
    console.error("GET suppliers error:", error);

    res.status(500).json({
      error: "Failed to fetch suppliers",
    });
  }
});

// CREATE supplier
router.post("/clinics/:clinicId/suppliers", async (req, res) => {
  try {
    const { clinicId } = req.params;

    const {
  supplierName,
  contactPerson,
  phone,
  email,
  address,
} = req.body as {
  supplierName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
};

    const result = await (global as any).db.query(
      `
      INSERT INTO suppliers (
        clinic_id,
        supplier_name,
        contact_person,
        phone,
        email,
        address
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
  clinicId,
  supplierName,
  contactPerson,
  phone,
  email,
  address,
]
    );

    res.json(result.rows[0]);

  } catch (error) {
    console.error("CREATE supplier error:", error);

    res.status(500).json({
      error: "Failed to create supplier",
    });
  }
});

export default router;