import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not configured. API database routes will be unavailable.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error:", error.message));

export async function query(text, params = []) {
  return pool.query(text, params);
}
