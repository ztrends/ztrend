import { Router } from "express";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";

const router = Router();
const staff = [ "FOUNDER", "ADMIN", "INVENTORY_MANAGER" ];
const productSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().min(2).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().max(10000).optional().default(""),
  sku: z.string().trim().min(2).max(80),
  price: z.coerce.number().nonnegative(),
  compareAtPrice: z.coerce.number().nonnegative().optional().nullable(),
  costPrice: z.coerce.number().nonnegative().optional().default(0),
  stock: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(["DRAFT","ACTIVE","ARCHIVED"]).default("DRAFT"),
  imageUrl: z.string().url().optional().nullable()
});

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const search = String(req.query.search || "").trim().slice(0,100);
    const result = await query(
      `SELECT id,name,slug,description,sku,price,compare_at_price AS "compareAtPrice",stock,status,image_url AS "imageUrl"
       FROM products WHERE status='ACTIVE' AND ($1='' OR name ILIKE '%' || $1 || '%' OR sku ILIKE '%' || $1 || '%')
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [search, limit, (page-1)*limit]
    );
    res.json({ products: result.rows, page, limit });
  } catch (error) { next(error); }
});

router.get("/admin/all", requireAuth, allowRoles(...staff), async (_req, res, next) => {
  try {
    const result = await query(`SELECT id,name,slug,description,sku,price,compare_at_price AS "compareAtPrice",cost_price AS "costPrice",stock,status,image_url AS "imageUrl",created_at AS "createdAt" FROM products ORDER BY created_at DESC`);
    res.json({ products: result.rows });
  } catch (error) { next(error); }
});

router.post("/", requireAuth, allowRoles(...staff), async (req, res, next) => {
  try {
    const p = productSchema.parse(req.body);
    const result = await query(
      `INSERT INTO products(name,slug,description,sku,price,compare_at_price,cost_price,stock,status,image_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id,name,slug,description,sku,price,compare_at_price AS "compareAtPrice",cost_price AS "costPrice",stock,status,image_url AS "imageUrl"`,
      [p.name,p.slug,p.description,p.sku,p.price,p.compareAtPrice ?? null,p.costPrice,p.stock,p.status,p.imageUrl ?? null]
    );
    res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "Product slug or SKU already exists" });
    next(error);
  }
});

router.patch("/:id", requireAuth, allowRoles(...staff), async (req, res, next) => {
  try {
    const p = productSchema.partial().parse(req.body);
    const fields = {name:"name",slug:"slug",description:"description",sku:"sku",price:"price",compareAtPrice:"compare_at_price",costPrice:"cost_price",stock:"stock",status:"status",imageUrl:"image_url"};
    const keys = Object.keys(p);
    if (!keys.length) return res.status(400).json({ error: "No product fields supplied" });
    const values = keys.map(k => p[k] ?? null);
    const sets = keys.map((k,i) => `${fields[k]}=$${i+1}`);
    values.push(req.params.id);
    const result = await query(`UPDATE products SET ${sets.join(",")},updated_at=NOW() WHERE id=$${values.length} RETURNING id,name,slug,sku,price,stock,status,image_url AS "imageUrl"`, values);
    if (!result.rows[0]) return res.status(404).json({ error: "Product not found" });
    res.json({ product: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
