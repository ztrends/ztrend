import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";
const router=Router();
router.use(requireAuth,allowRoles("FOUNDER","ADMIN","ACCOUNTANT","ORDER_MANAGER","INVENTORY_MANAGER"));
router.get("/summary",async(_req,res,next)=>{
  try{
    const [sales,orders,products,customers,lowStock,recent]=await Promise.all([
      query("SELECT COALESCE(SUM(grand_total) FILTER(WHERE payment_status='PAID'),0) AS paid_revenue,COUNT(*) FILTER(WHERE created_at::date=CURRENT_DATE) AS today_orders FROM orders"),
      query("SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE status IN ('PENDING','CONFIRMED','PROCESSING')) AS open FROM orders"),
      query("SELECT COUNT(*) AS total,COUNT(*) FILTER(WHERE stock<=5 AND status='ACTIVE') AS low_stock FROM products"),
      query("SELECT COUNT(*) AS total FROM customers"),
      query("SELECT id,name,sku,stock FROM products WHERE status='ACTIVE' AND stock<=5 ORDER BY stock ASC LIMIT 10"),
      query("SELECT id,order_number,status,payment_status,grand_total,created_at FROM orders ORDER BY created_at DESC LIMIT 8")
    ]);
    res.json({
      revenue:{paid:Number(sales.rows[0].paid_revenue)},
      orders:{total:Number(orders.rows[0].total),open:Number(orders.rows[0].open),today:Number(sales.rows[0].today_orders)},
      products:{total:Number(products.rows[0].total),lowStock:Number(products.rows[0].low_stock)},
      customers:{total:Number(customers.rows[0].total)},
      lowStock:lowStock.rows,recentOrders:recent.rows
    });
  }catch(error){next(error);}
});
export default router;
