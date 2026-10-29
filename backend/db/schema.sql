CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TYPE identity_type AS ENUM ('FOUNDER','ADMIN','CUSTOMER');
CREATE TYPE order_status AS ENUM ('PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED','RETURN_REQUESTED','RETURNED');
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL,
 email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 identity_type identity_type NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 force_password_change BOOLEAN NOT NULL DEFAULT FALSE,
 last_login TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS permission_groups (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL UNIQUE,
 description TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS permissions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 module TEXT NOT NULL,
 action TEXT NOT NULL,
 UNIQUE(module, action)
);
CREATE TABLE IF NOT EXISTS user_permissions (
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
 scope JSONB NOT NULL DEFAULT '{}'::jsonb,
 PRIMARY KEY(user_id, permission_id)
);
CREATE TABLE IF NOT EXISTS products (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 sku TEXT NOT NULL UNIQUE,
 name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'General',
 image_url TEXT,
 cost_price NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK(cost_price >= 0),
 selling_price NUMERIC(14,2) NOT NULL CHECK(selling_price >= 0),
 tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK(tax_rate >= 0 AND tax_rate <= 100),
 stock_qty NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(stock_qty >= 0),
 reorder_level NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(reorder_level >= 0),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS inventory_movements (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 product_id UUID NOT NULL REFERENCES products(id),
 movement_type TEXT NOT NULL CHECK(movement_type IN ('OPENING','SALE','RECEIPT','ISSUE','ADJUSTMENT','RETURN','RESERVATION','RELEASE')),
 quantity NUMERIC(14,3) NOT NULL CHECK(quantity > 0),
 reference TEXT NOT NULL,
 location TEXT NOT NULL DEFAULT 'Main Warehouse',
 actor_id UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inventory_product_date_idx ON inventory_movements(product_id, created_at DESC);
CREATE TABLE IF NOT EXISTS customers (
 id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 phone TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS suppliers (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 name TEXT NOT NULL,
 email TEXT,
 phone TEXT,
 active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS purchase_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 supplier_id UUID REFERENCES suppliers(id),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','CANCELLED','CLOSED')),
 total NUMERIC(14,2) NOT NULL DEFAULT 0,
 created_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS purchase_order_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id),
 quantity NUMERIC(14,3) NOT NULL CHECK(quantity > 0),
 received_qty NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK(received_qty >= 0),
 unit_cost NUMERIC(14,2) NOT NULL CHECK(unit_cost >= 0)
);
CREATE TABLE IF NOT EXISTS sales (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 invoice_number TEXT NOT NULL UNIQUE,
 customer_id UUID REFERENCES users(id),
 subtotal NUMERIC(14,2) NOT NULL,
 tax_total NUMERIC(14,2) NOT NULL,
 discount_total NUMERIC(14,2) NOT NULL DEFAULT 0,
 total NUMERIC(14,2) NOT NULL,
 payment_method TEXT NOT NULL,
 payment_status TEXT NOT NULL CHECK(payment_status IN ('PENDING','PAID','COD')),
 created_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sale_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id),
 quantity NUMERIC(14,3) NOT NULL CHECK(quantity > 0),
 unit_price NUMERIC(14,2) NOT NULL CHECK(unit_price >= 0),
 tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS online_orders (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_number TEXT NOT NULL UNIQUE,
 customer_id UUID NOT NULL REFERENCES users(id),
 status order_status NOT NULL DEFAULT 'PENDING',
 subtotal NUMERIC(14,2) NOT NULL,
 total NUMERIC(14,2) NOT NULL,
 payment_method TEXT NOT NULL DEFAULT 'COD',
 payment_status TEXT NOT NULL DEFAULT 'PENDING',
 shipping_address JSONB NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS online_order_items (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 order_id UUID NOT NULL REFERENCES online_orders(id) ON DELETE CASCADE,
 product_id UUID NOT NULL REFERENCES products(id),
 quantity NUMERIC(14,3) NOT NULL CHECK(quantity > 0),
 unit_price NUMERIC(14,2) NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 description TEXT NOT NULL,
 category TEXT NOT NULL,
 amount NUMERIC(14,2) NOT NULL CHECK(amount > 0),
 payment_method TEXT NOT NULL,
 expense_date DATE NOT NULL,
 created_by UUID REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 actor_id UUID REFERENCES users(id),
 action TEXT NOT NULL,
 module TEXT NOT NULL,
 record_id TEXT,
 previous_value JSONB,
 new_value JSONB,
 ip_address INET,
 user_agent TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_at_idx ON audit_logs(created_at DESC);
INSERT INTO permissions(module, action) VALUES
 ('dashboard','view'),('products','view'),('products','create'),('products','edit'),('products','delete'),
 ('inventory','view'),('inventory','receive'),('inventory','issue'),('inventory','adjust'),
 ('pos','view'),('pos','create'),('pos','discount'),('sales','view'),('sales','refund'),
 ('purchases','view'),('purchases','create'),('purchases','approve'),('finance','view'),
 ('expenses','view'),('expenses','create'),('reports','view'),('store','view'),('store','manage'),
 ('customers','view'),('customers','edit'),('audit','view'),('settings','manage'),('users','manage')
ON CONFLICT DO NOTHING;
