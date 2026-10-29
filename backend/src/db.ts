
import pg from 'pg';
import dotenv from 'dotenv';
import type { QueryResultRow } from 'pg';

dotenv.config();

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: true }
    : undefined,
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
) {
  return pool.query<T>(sql, params);
}

export async function audit(
  actorId: string | null,
  action: string,
  module: string,
  recordId: string | null,
  req?: any,
  oldValue?: unknown,
  newValue?: unknown,
) {
  await query(
    `INSERT INTO audit_logs
      (actor_id, action, module, record_id, previous_value, new_value, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      actorId,
      action,
      module,
      recordId,
      oldValue ?? null,
      newValue ?? null,
      req?.ip ?? null,
      req?.get?.('user-agent') ?? null,
    ],
  );
}
  
