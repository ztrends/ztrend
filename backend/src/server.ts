import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { pool, query, audit } from './db.js';
import { authenticate, hashPassword, verifyPassword, issueSession, logout, requireIdentity, requirePermission } from './auth.js';

const app = express();
app.set('trust proxy', 1);
const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
app.use(cors({ origin: allowedOrigin, credentials: true }));
// CORS alone is not a CSRF defense for every request type. Reject browser writes from unknown origins.
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    if (origin && origin !== allowedOrigin) return res.status(403).json({error: 'Request origin is not allowed'});
  }
  next();
});
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req,res,next) => { res.setHeader('X-Content-Type-Options','nosniff'); res.setHeader('X-Frame-Options','DENY'); res.setHeader('Referrer-Policy','strict-origin-when-cross-origin'); next(); });

app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    console.error('DATABASE CONNECTION ERROR:', error);
    res.status(503).json({
      status: 'degraded',
      database: 'unavailable'
    });
  }
});

const loginSchema = z.object({ email:z.string().email().max(254), password:z.string().min(1).max(200), expectedType:z.enum(['FOUNDER','ADMIN','CUSTOMER']) });
app.post('/api/auth/login', async (req,res,next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await query<any>('SELECT id,name,email,password_hash,identity_type,active,force_password_change FROM users WHERE lower(email)=lower($1)', [input.email]);
    const user = result.rows[0];
    if (!user || !user.active || user.identity_type !== input.expectedType || !(await verifyPassword(input.password,user.password_hash))) return res.status(401).json({error:'Invalid credentials or access type'});
    await query('UPDATE users SET last_login=now() WHERE id=$1',[user.id]);
    issueSession(user,res);
    await audit(user.id,'LOGIN','auth',user.id,req);
    res.json({user:{id:user.id,name:user.name,email:user.email,identityType:user.identity_type,forcePasswordChange:user.force_password_change}});
  } catch(e){ next(e); }
});
app.post('/api/auth/logout', (_req,res) => { logout(res); res.json({ok:true}); });
app.get('/api/auth/me', authenticate, (req,res) => res.json({user:{id:req.user!.id,name:req.user!.name,email:req.user!.email,identityType:req.user!.identity_type,forcePasswordChange:req.user!.force_password_change,permissions:[...(req.permissions||[])]}}));

app.post('/api/auth/register', async (req,res,next) => {
 try {
  const d=z.object({name:z.string().trim().min(2).max(100),email:z.string().email().max(254),password:z.string().min(10).max(200),phone:z.string().max(30).optional()}).parse(req.body);
  const hash=await hashPassword(d.password);
  const client=await pool.connect();
  try { await client.query('BEGIN');
    const u=await client.query<any>(`INSERT INTO users(name,email,password_hash,identity_type) VALUES($1,lower($2),$3,'CUSTOMER') RETURNING id,name,email,identity_type,force_password_change`,[d.name,d.email,hash]);
    await client.query('INSERT INTO customers(id,phone) VALUES($1,$2)',[u.rows[0].id,d.phone||null]);
    await client.query('COMMIT'); issueSession(u.rows[0],res); res.status(201).json({user:{id:u.rows[0].id,name:u.rows[0].name,email:u.rows[0].email,identityType:'CUSTOMER'}});
  } catch(e){ await client.query('ROLLBACK'); throw e; } finally { client.release(); }
 }catch(e){next(e);}
});
app.post('/api/auth/change-password', authenticate, async(req,res,next)=>{
 try {
  const d=z.object({currentPassword:z.string(),newPassword:z.string().min(10).max(200)}).parse(req.body);
  const r=await query<any>('SELECT password_hash FROM users WHERE id=$1',[req.user!.id]);
  if(!(await verifyPassword(d.currentPassword,r.rows[0].password_hash))) return res.status(400).json({error:'Current password is incorrect'});
  await query('UPDATE users SET password_hash=$1,force_password_change=false WHERE id=$2',[await hashPassword(d.newPassword),req.user!.id]);
  await audit(req.user!.id,'PASSWORD_CHANGED','auth',req.user!.id,req); res.json({ok:true});
 }catch(e){next(e);}
});

app.get('/api/products', async(req,res,next)=>{ try{
 const q=String(req.query.q||'').slice(0,100);
 const r=await query<any>(`SELECT id,sku,name,description,category,image_url,selling_price,tax_rate,stock_qty,reorder_level FROM products WHERE active=true AND ($1='' OR name ILIKE '%'||$1||'%' OR sku ILIKE '%'||$1||'%') ORDER BY name LIMIT 100`,[q]);
 res.json({items:r.rows});
}catch(e){next(e);} });

app.get('/api/admin/summary',authenticate,requireIdentity('FOUNDER','ADMIN'),requirePermission('dashboard','view'),async(req,res,next)=>{try{
 const [sales,products,low,orders]=await Promise.all([
 query<any>("SELECT COALESCE(SUM(total),0) revenue,COUNT(*)::int orders FROM sales WHERE created_at >= date_trunc('month',now())"),
 query<any>("SELECT COUNT(*)::int count,COALESCE(SUM(stock_qty*cost_price),0) stock_value FROM products WHERE active=true"),
 query<any>("SELECT COUNT(*)::int count FROM products WHERE active=true AND stock_qty<=reorder_level"),
 query<any>("SELECT COUNT(*)::int count FROM online_orders WHERE status IN ('PENDING','CONFIRMED','PROCESSING')")
 ]);
 res.json({monthRevenue:Number(sales.rows[0].revenue),monthSales:sales.rows[0].orders,productCount:products.rows[0].count,stockValue:Number(products.rows[0].stock_value),lowStock:low.rows[0].count,pendingOnlineOrders:orders.rows[0].count});
}catch(e){next(e);} });

app.get('/api/admin/products',authenticate,requireIdentity('FOUNDER','ADMIN'),requirePermission('products','view'),async(_req,res,next)=>{try{res.json({items:(await query('SELECT * FROM products ORDER BY created_at DESC LIMIT 500')).rows});}catch(e){next(e);}});
app.post('/api/admin/products',authenticate,requireIdentity('FOUNDER','ADMIN'),requirePermission('products','create'),async(req,res,next)=>{try{
 const d=z.object({sku:z.string().trim().min(1).max(80),name:z.string().trim().min(1).max(200),description:z.string().max(5000).optional(),category:z.string().max(100).optional(),costPrice:z.number().nonnegative(),sellingPrice:z.number().nonnegative(),taxRate:z.number().min(0).max(100).default(0),openingStock:z.number().nonnegative().default(0),reorderLevel:z.number().nonnegative().default(0)}).parse(req.body);
 const c=await pool.connect(); try{await c.query('BEGIN');
 const p=await c.query<any>(`INSERT INTO products(sku,name,description,category,cost_price,selling_price,tax_rate,stock_qty,reorder_level) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[d.sku,d.name,d.description||'',d.category||'General',d.costPrice,d.sellingPrice,d.taxRate,d.openingStock,d.reorderLevel]);
 if(d.openingStock>0) await c.query(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference,actor_id) VALUES($1,'OPENING',$2,'OPENING-STOCK',$3)`,[p.rows[0].id,d.openingStock,req.user!.id]);
 await c.query('COMMIT'); await audit(req.user!.id,'PRODUCT_CREATED','products',p.rows[0].id,req,null,p.rows[0]);res.status(201).json({item:p.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){next(e);} });

app.post('/api/admin/inventory/receive',authenticate,requireIdentity('FOUNDER','ADMIN'),requirePermission('inventory','receive'),async(req,res,next)=>{try{
 const d=z.object({productId:z.string().uuid(),quantity:z.number().positive(),reference:z.string().min(1).max(100),location:z.string().max(100).default('Main Warehouse')}).parse(req.body);
 const c=await pool.connect();try{await c.query('BEGIN');
 const p=await c.query<any>('SELECT id,stock_qty FROM products WHERE id=$1 AND active=true FOR UPDATE',[d.productId]);
 if(!p.rowCount) {await c.query('ROLLBACK');return res.status(404).json({error:'Product not found'});}
 await c.query('UPDATE products SET stock_qty=stock_qty+$1 WHERE id=$2',[d.quantity,d.productId]);
 await c.query(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference,location,actor_id) VALUES($1,'RECEIPT',$2,$3,$4,$5)`,[d.productId,d.quantity,d.reference,d.location,req.user!.id]);
 await c.query('COMMIT'); await audit(req.user!.id,'STOCK_RECEIVED','inventory',d.productId,req,p.rows[0],{quantity:d.quantity});res.json({ok:true});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){next(e);} });

app.post('/api/admin/pos/sales',authenticate,requireIdentity('FOUNDER','ADMIN'),requirePermission('pos','create'),async(req,res,next)=>{try{
 const d=z.object({items:z.array(z.object({productId:z.string().uuid(),quantity:z.number().positive().max(100000)})).min(1).max(100),paymentMethod:z.enum(['CASH','UPI','CARD','COD','MANUAL']),paymentStatus:z.enum(['PENDING','PAID','COD']).default('PENDING'),discount:z.number().nonnegative().default(0)}).superRefine((value,ctx)=>{if(value.paymentStatus==='PAID' && value.paymentMethod!=='CASH')ctx.addIssue({code:z.ZodIssueCode.custom,path:['paymentStatus'],message:'Only cash sales can be marked paid until a payment provider is integrated'});if(value.paymentStatus==='COD' && value.paymentMethod!=='COD')ctx.addIssue({code:z.ZodIssueCode.custom,path:['paymentMethod'],message:'COD status requires the COD payment method'});}).parse(req.body);
 if(d.discount>0 && req.user!.identity_type!=='FOUNDER' && !req.permissions?.has('pos:discount')) return res.status(403).json({error:'Discount permission required'});
 const c=await pool.connect();try{await c.query('BEGIN');
 let subtotal=0,taxTotal=0; const rows:any[]=[];
 const mergedMap=new Map<string,{productId:string;quantity:number}>();for(const item of d.items){const current=mergedMap.get(item.productId);mergedMap.set(item.productId,{productId:item.productId,quantity:(current?.quantity||0)+item.quantity});}const mergedItems=[...mergedMap.values()];
 for(const item of mergedItems){
  const p=await c.query<any>('SELECT id,name,selling_price,tax_rate,stock_qty FROM products WHERE id=$1 AND active=true FOR UPDATE',[item.productId]);
  if(!p.rowCount) throw Object.assign(new Error('Product not found'),{status:404});
  const x=p.rows[0]; if(Number(x.stock_qty)<item.quantity) throw Object.assign(new Error(`Insufficient stock for ${x.name}`),{status:409});
  const line=Number(x.selling_price)*item.quantity; subtotal+=line; taxTotal+=line*Number(x.tax_rate)/100; rows.push({...item,price:Number(x.selling_price),tax:Number(x.tax_rate)});
 }
 if(d.discount>subtotal+taxTotal) throw Object.assign(new Error('Discount cannot exceed the bill total'),{status:400});
 const total=Math.max(0,subtotal+taxTotal-d.discount);
 const invoice='NX-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
 const sale=await c.query<any>(`INSERT INTO sales(invoice_number,subtotal,tax_total,discount_total,total,payment_method,payment_status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[invoice,subtotal,taxTotal,d.discount,total,d.paymentMethod,d.paymentStatus,req.user!.id]);
 for(const x of rows){await c.query('INSERT INTO sale_items(sale_id,product_id,quantity,unit_price,tax_rate) VALUES($1,$2,$3,$4,$5)',[sale.rows[0].id,x.productId,x.quantity,x.price,x.tax]);await c.query('UPDATE products SET stock_qty=stock_qty-$1 WHERE id=$2',[x.quantity,x.productId]);await c.query(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference,actor_id) VALUES($1,'SALE',$2,$3,$4)`,[x.productId,x.quantity,invoice,req.user!.id]);}
 await c.query('COMMIT');await audit(req.user!.id,'SALE_COMPLETED','pos',sale.rows[0].id,req,null,{invoice,total});res.status(201).json({sale:sale.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){next(e);} });

app.get('/api/admin/audit',authenticate,requireIdentity('FOUNDER','ADMIN'),requirePermission('audit','view'),async(req,res,next)=>{try{res.json({items:(await query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200')).rows});}catch(e){next(e);}});

app.get('/api/founder/admins',authenticate,requireIdentity('FOUNDER'),async(_req,res,next)=>{try{res.json({items:(await query(`SELECT id,name,email,active,last_login,created_at FROM users WHERE identity_type='ADMIN' ORDER BY created_at DESC`)).rows});}catch(e){next(e);}});
app.post('/api/founder/admins',authenticate,requireIdentity('FOUNDER'),async(req,res,next)=>{try{
 const d=z.object({name:z.string().min(2).max(100),email:z.string().email(),password:z.string().min(10).max(200),permissions:z.array(z.object({module:z.string(),action:z.string()})).max(200).default([])}).parse(req.body);
 const c=await pool.connect();try{await c.query('BEGIN');const u=await c.query<any>(`INSERT INTO users(name,email,password_hash,identity_type,force_password_change) VALUES($1,lower($2),$3,'ADMIN',true) RETURNING id,name,email`,[d.name,d.email,await hashPassword(d.password)]);
 for(const perm of d.permissions){const p=await c.query<any>('SELECT id FROM permissions WHERE module=$1 AND action=$2',[perm.module,perm.action]);if(p.rowCount)await c.query('INSERT INTO user_permissions(user_id,permission_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[u.rows[0].id,p.rows[0].id]);}
 await c.query('COMMIT');await audit(req.user!.id,'ADMIN_CREATED','users',u.rows[0].id,req);res.status(201).json({user:u.rows[0]});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){next(e);} });
app.patch('/api/founder/admins/:id/status',authenticate,requireIdentity('FOUNDER'),async(req,res,next)=>{try{
 const d=z.object({active:z.boolean()}).parse(req.body);
 const r=await query<any>(`UPDATE users SET active=$1 WHERE id=$2 AND identity_type='ADMIN' RETURNING id,name,email,active`,[d.active,req.params.id]);
 if(!r.rowCount)return res.status(404).json({error:'Admin not found'});await audit(req.user!.id,d.active?'ADMIN_ACTIVATED':'ADMIN_DEACTIVATED','users',req.params.id,req);res.json({user:r.rows[0]});
}catch(e){next(e);} });

app.get('/api/shop/orders',authenticate,requireIdentity('CUSTOMER'),async(req,res,next)=>{try{res.json({items:(await query('SELECT * FROM online_orders WHERE customer_id=$1 ORDER BY created_at DESC',[req.user!.id])).rows});}catch(e){next(e);}});
app.post('/api/shop/orders',authenticate,requireIdentity('CUSTOMER'),async(req,res,next)=>{try{
 const d=z.object({items:z.array(z.object({productId:z.string().uuid(),quantity:z.number().int().positive().max(100)})).min(1).max(50),shippingAddress:z.object({name:z.string().min(2),phone:z.string().min(7),line1:z.string().min(4),city:z.string().min(2),state:z.string().min(2),postalCode:z.string().min(4)}),paymentMethod:z.enum(['COD','MANUAL']).default('COD')}).parse(req.body);
 const c=await pool.connect();try{await c.query('BEGIN');let subtotal=0;const rows:any[]=[];
 const mergedMap=new Map<string,{productId:string;quantity:number}>();for(const item of d.items){const current=mergedMap.get(item.productId);mergedMap.set(item.productId,{productId:item.productId,quantity:(current?.quantity||0)+item.quantity});}const mergedItems=[...mergedMap.values()];
 for(const i of mergedItems){const p=await c.query<any>('SELECT id,name,selling_price,stock_qty FROM products WHERE id=$1 AND active=true FOR UPDATE',[i.productId]);if(!p.rowCount)throw Object.assign(new Error('Product unavailable'),{status:404});if(Number(p.rows[0].stock_qty)<i.quantity)throw Object.assign(new Error('Insufficient stock'),{status:409});subtotal+=Number(p.rows[0].selling_price)*i.quantity;rows.push({...i,price:Number(p.rows[0].selling_price)});}
 const number='NXO-'+Date.now().toString(36).toUpperCase();const o=await c.query<any>(`INSERT INTO online_orders(order_number,customer_id,subtotal,total,payment_method,payment_status,shipping_address) VALUES($1,$2,$3,$3,$4,'PENDING',$5) RETURNING *`,[number,req.user!.id,subtotal,d.paymentMethod,d.shippingAddress]);
 for(const i of rows){await c.query('INSERT INTO online_order_items(order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4)',[o.rows[0].id,i.productId,i.quantity,i.price]);await c.query('UPDATE products SET stock_qty=stock_qty-$1 WHERE id=$2',[i.quantity,i.productId]);await c.query(`INSERT INTO inventory_movements(product_id,movement_type,quantity,reference,actor_id) VALUES($1,'SALE',$2,$3,$4)`,[i.productId,i.quantity,number,req.user!.id]);}
 await c.query('COMMIT');res.status(201).json({order:o.rows[0],notice:'Order created. No online payment was charged.'});
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}catch(e){next(e);} });

app.use((err:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
 if(err instanceof z.ZodError) return res.status(400).json({error:'Validation failed',details:err.issues.map(i=>({path:i.path,message:i.message}))});
 if(err?.code==='23505') return res.status(409).json({error:'A record with that unique value already exists'});
 const status=Number(err?.status)||500;
 if(status>=500) console.error(err);
 res.status(status).json({error:status>=500?'Internal server error':err.message||'Request failed'});
});
const port=Number(process.env.PORT||4000);
if(process.env.NODE_ENV!=='test') app.listen(port,()=>console.log(`NEXORA API listening on ${port}`));
export default app;
