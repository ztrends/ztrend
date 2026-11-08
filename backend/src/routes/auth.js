import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(180).transform(v => v.toLowerCase()),
  password: z.string().min(10).max(100)
});
const loginSchema = z.object({
  email: z.string().trim().email().transform(v => v.toLowerCase()),
  password: z.string().min(1).max(100)
});

function issueToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, process.env.JWT_SECRET, { expiresIn: "30d", issuer: "ztrend-api", audience: "ztrend-app" });
}
function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status };
}

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const result = await query(
      "INSERT INTO users (name,email,password_hash,role,status) VALUES ($1,$2,$3,'CUSTOMER','ACTIVE') RETURNING id,name,email,role,status",
      [data.name, data.email, passwordHash]
    );
    const user = result.rows[0];
    res.status(201).json({ user: publicUser(user), token: issueToken(user) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists" });
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await query("SELECT id,name,email,password_hash,role,status FROM users WHERE email=$1", [data.email]);
    const user = result.rows[0];
    if (!user || user.status !== "ACTIVE" || !(await bcrypt.compare(data.password, user.password_hash))) {
      return res.status(401).json({ error: "Email or password is incorrect" });
    }
    res.json({ user: publicUser(user), token: issueToken(user) });
  } catch (error) { next(error); }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const result = await query("SELECT id,name,email,role,status FROM users WHERE id=$1", [req.user.sub]);
    if (!result.rows[0] || result.rows[0].status !== "ACTIVE") return res.status(401).json({ error: "Account unavailable" });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { next(error); }
});

export default router;
