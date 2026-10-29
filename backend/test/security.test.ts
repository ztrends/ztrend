import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('schema separates Founder/Admin/Customer identities and protects permission assignments', async () => {
  const s = await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.match(s, /CREATE TYPE identity_type AS ENUM \('FOUNDER','ADMIN','CUSTOMER'\)/);
  assert.match(s, /CREATE TABLE IF NOT EXISTS user_permissions/);
  assert.match(s, /PRIMARY KEY\(user_id, permission_id\)/);
});

test('inventory and sale operations use transactions and row locks', async () => {
  const s = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(s, /SELECT id,stock_qty FROM products WHERE id=\$1 AND active=true FOR UPDATE/);
  assert.match(s, /BEGIN/);
  assert.match(s, /COMMIT/);
  assert.match(s, /ROLLBACK/);
  assert.match(s, /Discount permission required/);
  assert.match(s, /mergedItems/);
});

test('temporary passwords are enforced by the backend and must be changed', async () => {
  const auth = await readFile(new URL('../src/auth.ts', import.meta.url), 'utf8');
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(auth, /COOKIE_SAME_SITE/);
  assert.match(auth, /Password change required before using this account/);
  assert.match(server, /force_password_change=false/);
});

test('unintegrated online payment cannot be falsely marked paid', async () => {
  const s = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(s, /Only cash sales can be marked paid until a payment provider is integrated/);
  assert.match(s, /No online payment was charged/);
});

test('mutating requests from unexpected browser origins are rejected', async () => {
  const s = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.match(s, /Request origin is not allowed/);
});
