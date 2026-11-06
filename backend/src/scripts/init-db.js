import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool, query } from "../db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const schema = await fs.readFile(path.resolve(here, "../../database/schema.sql"), "utf8");
  await query(schema);
  console.log("ZTrend database schema initialized.");
  if (process.env.FOUNDER_EMAIL && process.env.FOUNDER_PASSWORD) {
    const email = process.env.FOUNDER_EMAIL.trim().toLowerCase();
    const password = process.env.FOUNDER_PASSWORD;
    if (password.length < 12) throw new Error("FOUNDER_PASSWORD must be at least 12 characters.");
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users(name,email,password_hash,role,status)
       VALUES($1,$2,$3,'FOUNDER','ACTIVE')
       ON CONFLICT(email) DO NOTHING RETURNING id,email`,
      [process.env.FOUNDER_NAME || "ZTrend Founder", email, hash]
    );
    console.log(result.rowCount ? "Founder account created." : "Founder account already exists; no password changed.");
  }
} catch (error) {
  console.error("Database initialization failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
