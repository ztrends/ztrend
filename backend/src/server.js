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
  await pool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url TEXT NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0");
  await pool.query("ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE");
  const defaultCategories = [
    ["Men","men","https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&auto=format&fit=crop&q=85",1],
    ["Women","women","https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&auto=format&fit=crop&q=85",2],
    ["Travel","travel","https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&auto=format&fit=crop&q=85",3],
    ["Hoodies","hoodies","https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=600&auto=format&fit=crop&q=85",4],
    ["Sweatshirts","sweatshirts","https://images.unsplash.com/photo-1578681994506-b8f463449011?w=600&auto=format&fit=crop&q=85",5],
    ["Jackets","jackets","https://images.unsplash.com/photo-1551028719-00167b16eac5?w=600&auto=format&fit=crop&q=85",6],
    ["Joggers","joggers","https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=600&auto=format&fit=crop&q=85",7]
  ];
  for (const [name,slug,imageUrl,position] of defaultCategories) {
    await pool.query("INSERT INTO categories(name,slug,image_url,position,is_active) VALUES($1,$2,$3,$4,TRUE) ON CONFLICT(slug) DO UPDATE SET image_url=CASE WHEN categories.image_url='' THEN EXCLUDED.image_url ELSE categories.image_url END,position=EXCLUDED.position",[name,slug,imageUrl,position]);
  }
  console.log("Category catalogue schema and defaults ready.");

  console.log("Store slider schema ready.");
} catch(error) {
  console.warn("Store slider schema migration deferred:", error.message);
}
const port = Number(process.env.PORT) || 4000;
const server = app.listen(port, () => console.log(`ZTrend API listening on ${port}`));
async function shutdown() { server.close(); await pool.end(); process.exit(0); }
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
