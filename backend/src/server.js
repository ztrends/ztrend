import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { z } from "zod";
import { pool } from "./db.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import adminRoutes from "./routes/admin.js";
import categoryRoutes from "./routes/categories.js";
import slideRoutes from "./routes/slides.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must be configured with at least 32 characters.");
  process.exit(1);
}

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:4000,https://ztrends.github.io").split(",").map(s=>s.trim());
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin not allowed by CORS"));
}, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req,res) => {
  try { await pool.query("SELECT 1"); res.json({ status:"ok", database:"connected" }); }
  catch { res.status(503).json({ status:"degraded", database:"unavailable" }); }
});
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/slides", slideRoutes);
app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error:"Validation failed", details:err.issues.map(i=>({path:i.path,message:i.message})) });
  if (err.code === "23505") return res.status(409).json({ error:"A record with these details already exists" });
  console.error(err);
  res.status(500).json({ error: process.env.NODE_ENV === "production" ? "Internal server error" : err.message });
});

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS store_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(180) NOT NULL DEFAULT '',
    subtitle VARCHAR(300) NOT NULL DEFAULT '',
    media_type VARCHAR(10) NOT NULL CHECK(media_type IN ('IMAGE','VIDEO')),
    media_url TEXT NOT NULL,
    cta_label VARCHAR(60) NOT NULL DEFAULT 'Shop now',
    cta_url VARCHAR(500) NOT NULL DEFAULT '#new',
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("CREATE INDEX IF NOT EXISTS store_slides_active_position_idx ON store_slides(is_active,position)");
  console.log("Store slider schema ready.");
} catch(error) {
  console.warn("Store slider schema migration deferred:", error.message);
}
const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => console.log(`ZTrend API listening on ${port}`));
async function shutdown() { server.close(); await pool.end(); process.exit(0); }
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
