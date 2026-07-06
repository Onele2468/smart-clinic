import { Router, type Request, type Response } from "express";
import { generateWithOllama } from "../services/ai/ollama.service.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.post("/ai/summary", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      res.status(400).json({
        success: false,
        message: "Prompt is required.",
      });
      return;
    }

    const result = await generateWithOllama(prompt);

    res.json({
      success: true,
      summary: result.response,
    });

    return;
  } catch (error) {
    logger.error({ error }, "AI summary generation failed");

    res.status(500).json({
      success: false,
      message: "Failed to generate AI summary.",
    });

    return;
  }
});

export default router;