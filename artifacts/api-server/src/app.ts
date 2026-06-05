import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import whatsappWebhookRouter from "./routes/whatsapp_webhook";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust one upstream proxy so express-rate-limit can use forwarded client IPs.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(
  "/api/webhooks/whatsapp",
  express.raw({ type: "application/json" }),
  whatsappWebhookRouter,
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Skip rate limiting in test mode or for localhost/internal callers
const skipRateLimit = (req: express.Request) => {
  if (process.env.NODE_ENV === "test") return true;
  const ip = req.ip ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

// Stricter rate limit on auth routes — 20 per 15 minutes per IP
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes and try again." },
  skip: skipRateLimit,
});

// Global rate limit — 500 requests per 15 minutes per IP
const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
  skip: skipRateLimit,
});

app.use(globalRateLimit);
app.use("/api/auth/login", authRateLimit);
app.use("/api/auth/register", authRateLimit);
app.use("/api/auth/verify-email", authRateLimit);
app.use("/api/auth/resend-otp", authRateLimit);
app.use("/api/auth/forgot-password", authRateLimit);
app.use("/api/auth/reset-password", authRateLimit);
app.use("/api", router);

// 404 — route not matched; must return JSON, never HTML
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — catches ALL unhandled exceptions from any route.
// Must have exactly 4 parameters so Express recognises it as an error handler.
// Without this, Express 5 falls back to its built-in HTML error page.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  // PostgreSQL unique-constraint violation (code 23505) → 409 Conflict.
  // Drizzle wraps PG errors as _DrizzleQueryError; the real PG error is on .cause.
  const pgErr = (err as Record<string, unknown>)?.["cause"] as Record<string, unknown> | undefined;
  const pgCode = pgErr?.["code"] ?? (err as Record<string, unknown>)?.["code"];
  const errMsg = String((err as Record<string, unknown>)?.["message"] ?? "");

  if (pgCode === "23505" || errMsg.includes("unique constraint")) {
    let message = "A record with this value already exists.";
    if (errMsg.includes("email") || errMsg.includes("users_email_unique")) message = "Email already registered.";
    else if (errMsg.includes("government_id_number")) message = "An account with this ID number is already registered.";
    else if (errMsg.includes("staff_code")) message = "Staff code conflict — please try again.";
    res.status(409).json({ error: message });
    return;
  }

  // Log the full error server-side
  logger.error({ err, method: req.method, url: req.url }, "Unhandled error in route handler");

  // Never expose internal details to the client
  const status = typeof (err as Record<string, unknown>)?.["status"] === "number"
    ? ((err as Record<string, unknown>)["status"] as number)
    : 500;

  res.status(status >= 400 && status < 600 ? status : 500).json({
    error: "An unexpected server error occurred. Please try again.",
  });
});

export default app;
