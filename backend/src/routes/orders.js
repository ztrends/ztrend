import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../db.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";

const router = Router();
const staff = ["FOUNDER","ADMIN","ORDER_MANAGER"];
const orderReaders = [...staff,"ACCOUNTANT"];
const checkoutSchema = z.object({
  items: z.array(z.object({ productId:z.string().uuid(), quantity:z.coerce.number().int().min(1).max(50) })).min(1).max(30),
  paymentMethod: z.enum(["RAZORPAY","UPI","COD"]),
  shippingAddress: z.record(z.any()),
  notes: z.string().max(1000).optional()
});

router.post("/", requireAuth, async (req,res,next) => {
  const client = await pool.connect();
  try {
    const data = checkoutSchema.parse(req.body);
    await client.query("BEGIN");
    const userResult = await client.query("SELECT id,name,email FROM users WHERE id=$1 AND status='ACTIVE'",[req.user.sub]);
    if (!userResult.rows[0]) { await client.query("ROLLBACK"); return res.status(401).json({error:"Account unavailable"}); }
    const user = userResult.rows[0];
    const customerResult = await client.query(
      "INSERT INTO customers(user_id) VALUES($1) ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING id",
      [user.id]
    );
    let subtotal=0;
    const lines=[];
    for (const item of data.items) {
      const p = await client.query("SELECT id,name,sku,price,cost_price,stock,status FROM products WHERE id=$1 FOR UPDATE",[item.productId]);
      const product=p.rows[0];
      if (!product || product.status!=="ACTIVE") throw Object.assign(new Error("A selected product is unavailable"),{status:409});
      if (product.stock < item.quantity) throw Object.assign(new Error(`Insufficient stock for ${product.name}`),{status:409});
      const price=Number(product.price), cost=Number(product.cost_price);
      subtotal += price*item.quantity;
      lines.push({product,quantity:item.quantity,price,cost});
    }
    const orderResult=await client.query(
      `INSERT INTO orders(customer_id,status,payment_status,payment_method,subtotal,grand_total,shipping_address,notes)
       VALUES($1,'PENDING','PENDING',$2,$3,$3,$4,$5) RETURNING id,order_number,status,payment_status,grand_total,created_at`,
      [customerResult.rows[0].id,data.paymentMethod,subtotal,JSON.stringify(data.shippingAddress),data.notes||null]
    );
    const order=orderResult.rows[0];
    for (const line of lines) {
      await client.query(
        "INSERT INTO order_items(order_id,product_id,product_name,sku,quantity,unit_price,unit_cost,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
        [order.id,line.product.id,line.product.name,line.product.sku,line.quantity,line.price,line.cost,line.price*line.quantity]
      );
      await client.query("UPDATE products SET stock=stock-$1,updated_at=NOW() WHERE id=$2",[line.quantity,line.product.id]);
      await client.query(
        "INSERT INTO stock_movements(product_id,user_id,movement_type,quantity,reference,note) VALUES($1,$2,'SALE',$3,$4,'Stock reserved for order')",
        [line.product.id,user.id,-line.quantity,String(order.order_number)]
      );
    }
    await client.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES($1,'ORDER_CREATED','ORDER',$2)",[user.id,order.id]);
    await client.query("COMMIT");
    res.status(201).json({order});
  } catch(error) {
    await client.query("ROLLBACK");
    if (error.status) return res.status(error.status).json({error:error.message});
    next(error);
  } finally { client.release(); }
});

router.get("/mine",requireAuth,async(req,res,next)=>{
  try {
    const result=await query(
      `SELECT o.id,o.order_number,o.status,o.payment_status,o.grand_total,o.created_at,
       COALESCE(json_agg(json_build_object('name',i.product_name,'sku',i.sku,'quantity',i.quantity,'unitPrice',i.unit_price)) FILTER(WHERE i.id IS NOT NULL),'[]') AS items
       FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN order_items i ON i.order_id=o.id
       WHERE c.user_id=$1 GROUP BY o.id ORDER BY o.created_at DESC`,[req.user.sub]);
    res.json({orders:result.rows});
  } catch(error){next(error);}
});

router.get("/",requireAuth,allowRoles(...orderReaders),async(req,res,next)=>{
  try {
    const result=await query(
      `SELECT o.id,o.order_number,o.status,o.payment_status,o.payment_method,o.grand_total,o.created_at,
       COALESCE(NULLIF(o.shipping_address->>'fullName',''),NULLIF(o.shipping_address->>'name',''),u.name,'Customer') AS customer_name,
       u.email AS customer_email,COALESCE(NULLIF(c.phone,''),NULLIF(o.shipping_address->>'phone',''),NULLIF(o.shipping_address->>'mobile',''),NULLIF(o.shipping_address->>'phoneNumber','')) AS customer_phone,
       COUNT(i.id)::int AS item_count
       FROM orders o
       LEFT JOIN customers c ON c.id=o.customer_id
       LEFT JOIN users u ON u.id=c.user_id
       LEFT JOIN order_items i ON i.order_id=o.id
       GROUP BY o.id,u.name,u.email,c.phone
       ORDER BY o.created_at DESC LIMIT 200`);
    res.json({orders:result.rows});
  } catch(error){next(error);}
});

router.get("/:id",requireAuth,allowRoles(...orderReaders),async(req,res,next)=>{
  try {
    const parsed=z.string().uuid().safeParse(req.params.id);
    if(!parsed.success) return res.status(400).json({error:"Invalid order ID"});
    const result=await query(
      `SELECT o.id,o.order_number,o.status,o.payment_status,o.payment_method,
       o.subtotal,o.discount_total,o.tax_total,o.shipping_total,o.grand_total,
       o.shipping_address,o.notes,o.created_at,o.updated_at,
       COALESCE(NULLIF(o.shipping_address->>'fullName',''),NULLIF(o.shipping_address->>'name',''),u.name,'Customer') AS customer_name,
       u.email AS customer_email,
       COALESCE(NULLIF(c.phone,''),NULLIF(o.shipping_address->>'phone',''),NULLIF(o.shipping_address->>'mobile',''),NULLIF(o.shipping_address->>'phoneNumber','')) AS customer_phone,
       c.gstin AS customer_gstin,
       c.billing_address,
       COALESCE(json_agg(json_build_object(
         'id',i.id,'productId',i.product_id,'name',i.product_name,'sku',i.sku,
         'quantity',i.quantity,'unitPrice',i.unit_price,'unitCost',i.unit_cost,'lineTotal',i.line_total
       )) FILTER(WHERE i.id IS NOT NULL),'[]'::json) AS items
       FROM orders o
       LEFT JOIN customers c ON c.id=o.customer_id
       LEFT JOIN users u ON u.id=c.user_id
       LEFT JOIN order_items i ON i.order_id=o.id
       WHERE o.id=$1
       GROUP BY o.id,u.name,u.email,c.phone,c.gstin,c.billing_address`,
      [parsed.data]
    );
    if(!result.rows[0]) return res.status(404).json({error:"Order not found"});
    res.json({order:result.rows[0]});
  } catch(error){next(error);}
});

router.patch("/:id/status",requireAuth,allowRoles(...staff),async(req,res,next)=>{
  try {
    const status=z.enum(["CONFIRMED","PROCESSING","SHIPPED","DELIVERED","CANCELLED","RETURN_REQUESTED","RETURNED"]).parse(req.body.status);
    const result=await query("UPDATE orders SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,order_number,status,payment_status",[status,req.params.id]);
    if(!result.rows[0]) return res.status(404).json({error:"Order not found"});
    await query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'ORDER',$3)",[req.user.sub,"ORDER_STATUS_"+status,req.params.id]);
    res.json({order:result.rows[0]});
  }catch(error){next(error);}
});
export default router;
