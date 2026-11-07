import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function reportRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'GET' && segment === 'dashboard') {
    const today = new Date().toISOString().split('T')[0];
    const threshold = parseInt(searchParams.get('threshold')) || 20;

    const todaySales = await first(
      db,
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
       FROM sales WHERE status = 'completed' AND DATE(created_at) = ?`,
      [today]
    );
    const totalSales = await first(
      db,
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total
       FROM sales WHERE status = 'completed'`
    );
    const totalCustomers = await first(db, 'SELECT COUNT(*) as count FROM customers WHERE is_active = 1');
    const totalMedicines = await first(db, 'SELECT COUNT(*) as count FROM medicines WHERE is_active = 1');

    // Accurate low stock query:
    const lowStockMedicines = await all(
      db,
      `SELECT m.id, m.brand_name, m.generic_name, m.strength, m.dosage_form, m.unit,
              m.default_selling_price as unit_price, m.purchase_price, m.barcode,
              mc.name as category_name,
              s.name as supplier_name, s.phone as supplier_phone, s.id as supplier_id,
              COALESCE(SUM(b.quantity), 0) as total_stock
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       LEFT JOIN suppliers s ON s.id = m.supplier_id
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       HAVING total_stock <= ?
       ORDER BY total_stock ASC`,
      [threshold]
    );

    const outOfStockCount = lowStockMedicines.filter(m => m.total_stock <= 0).length;
    const criticalCount = lowStockMedicines.filter(m => m.total_stock > 0 && m.total_stock <= 5).length;
    const lowStockCount = lowStockMedicines.length;

    // Enrich with suggested reorder calculation
    const enrichedLowStockItems = lowStockMedicines.map(m => {
      const suggestedReorder = Math.max(25, (threshold * 2) - m.total_stock);
      let urgency = 'low';
      if (m.total_stock <= 0) urgency = 'out_of_stock';
      else if (m.total_stock <= 5) urgency = 'critical';

      return {
        ...m,
        threshold,
        urgency,
        suggested_reorder: suggestedReorder,
        reorder_cost: suggestedReorder * (m.purchase_price || (m.unit_price * 0.65))
      };
    });

    const expiringBatches = await all(
      db,
      `SELECT b.id, b.batch_number, b.quantity, b.expiry_date,
              m.id as medicine_id, m.brand_name, m.generic_name, m.strength,
              s.name as supplier_name,
              CAST(julianday(b.expiry_date) - julianday('now') as INTEGER) as days_to_expiry
       FROM batches b
       JOIN medicines m ON m.id = b.medicine_id
       LEFT JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.quantity > 0 AND m.is_active = 1
       AND b.expiry_date <= date('now', '+90 days')
       ORDER BY b.expiry_date ASC
       LIMIT 10`
    );

    const expiringSoonCount = expiringBatches.length;

    const recentSales = await all(
      db,
      `SELECT s.*, u.full_name as user_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.status = 'completed'
       ORDER BY s.created_at DESC
       LIMIT 5`
    );

    const topMedicines = await all(
      db,
      `SELECT m.brand_name, SUM(si.quantity) as total_sold, SUM(si.subtotal) as revenue
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed'
       GROUP BY m.id
       ORDER BY total_sold DESC
       LIMIT 5`
    );

    return json({
      today: {
        sales_count: todaySales ? todaySales.count : 0,
        revenue: todaySales ? todaySales.total : 0,
      },
      all_time: {
        sales_count: totalSales ? totalSales.count : 0,
        revenue: totalSales ? totalSales.total : 0,
      },
      customers: totalCustomers ? totalCustomers.count : 0,
      medicines: totalMedicines ? totalMedicines.count : 0,
      threshold,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount,
      critical_count: criticalCount,
      expiring_soon_count: expiringSoonCount,
      low_stock_items: enrichedLowStockItems,
      expiring_batches: expiringBatches,
      recent_sales: recentSales,
      top_medicines: topMedicines,
    });
  }

  if (method === 'GET' && segment === 'sales-report') {
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || startDate;

    const salesByDay = await all(
      db,
      `SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total_amount) as revenue, SUM(discount_amount) as discounts
       FROM sales
       WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [startDate, endDate]
    );

    const salesByPayment = await all(
      db,
      `SELECT payment_method, COUNT(*) as count, SUM(amount_paid) as total
       FROM sales
       WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY payment_method`,
      [startDate, endDate]
    );

    const salesByUser = await all(
      db,
      `SELECT u.full_name, COUNT(*) as count, SUM(s.total_amount) as revenue
       FROM sales s
       JOIN users u ON u.id = s.user_id
       WHERE s.status = 'completed' AND DATE(s.created_at) BETWEEN ? AND ?
       GROUP BY s.user_id
       ORDER BY revenue DESC`,
      [startDate, endDate]
    );

    const topMedicines = await all(
      db,
      `SELECT m.brand_name, SUM(si.quantity) as quantity_sold, SUM(si.subtotal) as revenue
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND DATE(s.created_at) BETWEEN ? AND ?
       GROUP BY m.id
       ORDER BY revenue DESC
       LIMIT 10`,
      [startDate, endDate]
    );

    return json({
      start_date: startDate,
      end_date: endDate,
      sales_by_day: salesByDay,
      sales_by_payment: salesByPayment,
      sales_by_user: salesByUser,
      top_medicines: topMedicines,
    });
  }

  if (method === 'GET' && segment === 'inventory-report') {
    const stockByCategory = await all(
      db,
      `SELECT mc.name as category_name,
              COUNT(DISTINCT m.id) as medicine_count,
              COALESCE(SUM(b.quantity), 0) as total_stock,
              COALESCE(SUM(b.quantity * b.purchase_price), 0) as stock_value
       FROM medicines m
       LEFT JOIN medicine_categories mc ON mc.id = m.category_id
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY mc.id
       ORDER BY stock_value DESC`
    );

    const lowStockItems = await all(
      db,
      `SELECT m.id, m.brand_name, m.barcode,
              COALESCE(SUM(b.quantity), 0) as current_stock
       FROM medicines m
       LEFT JOIN batches b ON b.medicine_id = m.id AND b.quantity > 0
       WHERE m.is_active = 1
       GROUP BY m.id
       HAVING current_stock <= 10
       ORDER BY current_stock ASC`
    );

    const expiringItems = await all(
      db,
      `SELECT b.*, m.brand_name
       FROM batches b
       JOIN medicines m ON m.id = b.medicine_id
       WHERE b.quantity > 0 AND m.is_active = 1
       AND b.expiry_date <= date('now', '+90 days')
       ORDER BY b.expiry_date ASC`
    );

    return json({
      stock_by_category: stockByCategory,
      low_stock_items: lowStockItems,
      expiring_items: expiringItems,
    });
  }

  if (method === 'GET' && segment === 'financial-report') {
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || startDate;

    const revenue = await first(
      db,
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM sales WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const costData = await first(
      db,
      `SELECT COALESCE(SUM(b.purchase_price * si.quantity), 0) as total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN batches b ON b.id = si.batch_id
       WHERE s.status = 'completed' AND DATE(s.created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const expenses = await first(
      db,
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM expenses WHERE date BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const revenueTotal = revenue ? revenue.total : 0;
    const costTotal = costData ? costData.total : 0;
    const expensesTotal = expenses ? expenses.total : 0;
    const profit = revenueTotal - costTotal;
    const netProfit = profit - expensesTotal;

    return json({
      start_date: startDate,
      end_date: endDate,
      revenue: revenueTotal,
      cost_of_goods: costTotal,
      gross_profit: profit,
      expenses: expensesTotal,
      net_profit: netProfit,
      gross_margin: revenueTotal > 0 ? (profit / revenueTotal * 100).toFixed(2) : 0,
      net_margin: revenueTotal > 0 ? (netProfit / revenueTotal * 100).toFixed(2) : 0,
    });
  }

  if (method === 'GET' && segment === 'cash-summary') {
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || startDate;

    const summary = await all(
      db,
      `SELECT payment_method,
              COUNT(*) as transaction_count,
              SUM(amount_paid) as total_received,
              SUM(total_amount) as total_sales
       FROM sales
       WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY payment_method`,
      [startDate, endDate]
    );

    const total = await first(
      db,
      `SELECT COALESCE(SUM(amount_paid), 0) as total
       FROM sales WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    return json({
      start_date: startDate,
      end_date: endDate,
      methods: summary,
      grand_total: total ? total.total : 0,
    });
  }

  if (method === 'GET' && segment === 'expenses') {
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const category = searchParams.get('category');

    let where = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      where += ' AND date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND date <= ?';
      params.push(endDate);
    }
    if (category) {
      where += ' AND category = ?';
      params.push(category);
    }

    const expenses = await all(db, `SELECT * FROM expenses ${where} ORDER BY created_at DESC`, params);
    return json(expenses);
  }

  if (method === 'POST' && segment === 'expenses') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { category, description, amount, date, branch_id, receipt } = body;

    if (!description || !amount) {
      return json({ error: 'description and amount are required' }, 400);
    }

    const now = new Date().toISOString();
    const info = await run(
      db,
      `INSERT INTO expenses (category, description, amount, date, user_id, branch_id, receipt, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category || null, description, amount,
        date || now.split('T')[0], authUser.id,
        branch_id || null, receipt || null, now
      ]
    );

    const expense = await first(db, 'SELECT * FROM expenses WHERE id = ?', [info.lastInsertRowid]);
    return json(expense, 201);
  }

  return json({ error: 'Not found' }, 404);
}
