import { Router } from "express";
import { query } from "../db.js";
import { requireAuth, allowRoles } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, allowRoles("FOUNDER","ADMIN","ACCOUNTANT","ORDER_MANAGER","INVENTORY_MANAGER"));

router.get("/summary", async (_req,res,next) => {
  try {
    const [sales,orders,products,customers,lowStock,recent,monthly,topProducts,payments,statuses,inventory] = await Promise.all([
      query(`SELECT
        COALESCE(SUM(grand_total) FILTER(WHERE payment_status='PAID'),0) AS paid_revenue,
        COALESCE(SUM(grand_total) FILTER(WHERE payment_status='PAID' AND created_at::date=CURRENT_DATE),0) AS today_revenue,
        COALESCE(SUM(grand_total) FILTER(WHERE payment_status='PAID' AND created_at >= date_trunc('month',CURRENT_DATE)),0) AS month_revenue,
        COUNT(*) FILTER(WHERE created_at::date=CURRENT_DATE) AS today_orders,
        COUNT(*) FILTER(WHERE created_at >= date_trunc('month',CURRENT_DATE)) AS month_orders,
        COALESCE(AVG(grand_total) FILTER(WHERE payment_status='PAID'),0) AS average_order_value,
        COALESCE((SELECT SUM((i.unit_price-i.unit_cost)*i.quantity) FROM order_items i JOIN orders paid_orders ON paid_orders.id=i.order_id WHERE paid_orders.payment_status='PAID'),0) AS gross_profit
        FROM orders`),
      query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER(WHERE status IN ('PENDING','CONFIRMED','PROCESSING')) AS open,
        COUNT(*) FILTER(WHERE status='DELIVERED') AS delivered,
        COUNT(*) FILTER(WHERE status='CANCELLED') AS cancelled
        FROM orders`),
      query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER(WHERE stock<=5 AND status='ACTIVE') AS low_stock,
        COUNT(*) FILTER(WHERE status='ACTIVE') AS active
        FROM products`),
      query("SELECT COUNT(*) AS total FROM customers"),
      query("SELECT id,name,sku,stock,price,cost_price AS \"costPrice\" FROM products WHERE status='ACTIVE' AND stock<=5 ORDER BY stock ASC LIMIT 10"),
      query(`SELECT o.id,o.order_number,o.status,o.payment_status,o.grand_total,o.created_at,
        u.name AS customer_name FROM orders o
        LEFT JOIN customers c ON c.id=o.customer_id LEFT JOIN users u ON u.id=c.user_id
        ORDER BY o.created_at DESC LIMIT 8`),
      query(`SELECT to_char(month_start,'Mon YY') AS month,
        COALESCE(SUM(grand_total) FILTER(WHERE payment_status='PAID'),0) AS revenue,
        COUNT(*) AS orders FROM generate_series(date_trunc('month',CURRENT_DATE)-interval '5 months',
        date_trunc('month',CURRENT_DATE),interval '1 month') AS months(month_start)
        LEFT JOIN orders o ON date_trunc('month',o.created_at)=months.month_start
        GROUP BY months.month_start ORDER BY months.month_start`),
      query(`SELECT i.product_name AS name,i.sku,SUM(i.quantity)::int AS units,
        SUM(i.line_total) AS revenue,SUM(i.unit_cost*i.quantity) AS estimated_cost
        FROM order_items i JOIN orders o ON o.id=i.order_id
        WHERE o.payment_status='PAID' AND o.created_at>=date_trunc('month',CURRENT_DATE)-interval '5 months'
        GROUP BY i.product_name,i.sku ORDER BY units DESC LIMIT 6`),
      query("SELECT payment_method AS method,COUNT(*) AS orders,COALESCE(SUM(grand_total) FILTER(WHERE payment_status='PAID'),0) AS paid FROM orders GROUP BY payment_method ORDER BY orders DESC"),
      query("SELECT status,COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC"),
      query(`SELECT COALESCE(SUM(stock),0) AS units,
        COALESCE(SUM(stock*cost_price),0) AS cost_value,
        COALESCE(SUM(stock*price),0) AS retail_value
        FROM products WHERE status='ACTIVE'`)
    ]);
    const s=sales.rows[0],o=orders.rows[0],p=products.rows[0],iv=inventory.rows[0];
    res.json({
      revenue:{paid:Number(s.paid_revenue),today:Number(s.today_revenue),month:Number(s.month_revenue),grossProfit:Number(s.gross_profit)},
      orders:{total:Number(o.total),open:Number(o.open),today:Number(s.today_orders),month:Number(s.month_orders),delivered:Number(o.delivered),cancelled:Number(o.cancelled),averageValue:Number(s.average_order_value)},
      products:{total:Number(p.total),active:Number(p.active),lowStock:Number(p.low_stock)},
      customers:{total:Number(customers.rows[0].total)},
      inventory:{units:Number(iv.units),costValue:Number(iv.cost_value),retailValue:Number(iv.retail_value)},
      monthly:monthly.rows.map(x=>({...x,revenue:Number(x.revenue),orders:Number(x.orders)})),
      topProducts:topProducts.rows.map(x=>({...x,units:Number(x.units),revenue:Number(x.revenue),estimated_cost:Number(x.estimated_cost)})),
      paymentMethods:payments.rows.map(x=>({...x,orders:Number(x.orders),paid:Number(x.paid)})),
      orderStatuses:statuses.rows.map(x=>({...x,count:Number(x.count)})),
      lowStock:lowStock.rows,recentOrders:recent.rows
    });
  } catch(error) { next(error); }
});
export default router;
