import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  res.json({
    success: true,
    message: "Suppliers route working",
  });
});

export default router;