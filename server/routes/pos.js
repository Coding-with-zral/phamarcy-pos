import { first, all, run, json, authenticate } from '../utils/d1.js';

export async function posRoutes(request, env, path, db) {
  const parts = path.split('/').filter(Boolean);
  const method = request.method;
  const segment = parts[0] || '';
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  if (method === 'POST' && segment === 'sale') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const { items, customer_id, prescription_id, payment_method, discount_amount, vat_amount, notes, amount_paid, branch_id, loyalty_points_redeemed } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return json({ error: 'Items array is required' }, 400);
    }

    const now = new Date().toISOString();

    let subtotal = 0;
    const saleItemsData = [];

    for (const item of items) {
      const medicine = await first(db, 'SELECT id, brand_name, default_selling_price FROM medicines WHERE id = ? AND is_active = 1', [item.medicine_id]);
      if (!medicine) {
        return json({ error: `Medicine ${item.medicine_id} not found` }, 404);
      }

      const batches = await all(
        db,
        'SELECT id, selling_price, expiry_date, quantity FROM batches WHERE medicine_id = ? AND quantity > 0 ORDER BY expiry_date ASC',
        [item.medicine_id]
      );

      let remainingQty = item.quantity;
      const itemBatches = [];
      let itemTotalPrice = 0;

      for (const batch of batches) {
        if (remainingQty <= 0) break;
        const qty = Math.min(remainingQty, batch.quantity);
        remainingQty -= qty;

        const price = batch.selling_price || medicine.default_selling_price;

        itemBatches.push({
          batch_id: batch.id,
          quantity: qty,
          unit_price: price,
        });

        itemTotalPrice += qty * price;
      }

      if (remainingQty > 0) {
        return json({ error: `Insufficient stock for ${medicine.brand_name}. Available: ${item.quantity - remainingQty}, Requested: ${item.quantity}` }, 400);
      }

      subtotal += itemTotalPrice;

      for (const ib of itemBatches) {
        saleItemsData.push({
          medicine_id: item.medicine_id,
          batch_id: ib.batch_id,
          quantity: ib.quantity,
          unit_price: ib.unit_price,
          discount: 0,
          subtotal: ib.quantity * ib.unit_price,
        });
      }
    }

    const discountAmt = discount_amount ?? body.discount ?? 0;
    const vat = vat_amount ?? body.vat ?? 0;
    const total = subtotal - discountAmt + vat;
    const paidAmount = amount_paid || total;
    const changeAmount = Math.max(0, paidAmount - total);
    const invoiceNumber = 'INV-' + (1000 + Math.floor(Math.random() * 9000));

    const info = await run(
      db,
      `INSERT INTO sales (customer_id, user_id, branch_id, prescription_id, subtotal, vat_amount, discount_amount, total_amount, payment_method, amount_paid, change_amount, loyalty_points_earned, loyalty_points_redeemed, status, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'completed', ?, ?)`,
      [
        customer_id || null, authUser.id, branch_id || 1, prescription_id || null,
        subtotal, vat, discountAmt, total, payment_method || 'cash',
        paidAmount, changeAmount, loyalty_points_redeemed || 0,
        notes || null, now
      ]
    );

    const saleId = info.lastInsertRowid;

    // Record payment
    const paymentRef = (payment_method === 'mpesa')
      ? ('MP' + Math.random().toString(36).substring(2, 9).toUpperCase())
      : (payment_method === 'card' ? ('CARD-' + Math.floor(Math.random() * 89999 + 10000)) : ('CASH-' + saleId));

    await run(
      db,
      "INSERT INTO payments (sale_id, customer_id, amount, method, reference, status, created_at) VALUES (?, ?, ?, ?, ?, 'completed', ?)",
      [saleId, customer_id || null, total, payment_method || 'cash', paymentRef, now]
    );

    for (const item of saleItemsData) {
      await run(
        db,
        'INSERT INTO sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, discount, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [saleId, item.medicine_id, item.batch_id, item.quantity, item.unit_price, item.discount, item.subtotal]
      );

      await run(
        db,
        'UPDATE batches SET quantity = MAX(0, quantity - ?) WHERE id = ?',
        [item.quantity, item.batch_id]
      );

      await run(
        db,
        `INSERT INTO inventory_adjustments (medicine_id, batch_id, adjustment_type, quantity, reason, user_id, created_at)
         VALUES (?, ?, 'decrease', ?, ?, ?, ?)`,
        [item.medicine_id, item.batch_id, item.quantity, `Sale #${saleId}`, authUser.id, now]
      );
    }

    if (prescription_id) {
      await run(db, "UPDATE prescriptions SET status = 'dispensed' WHERE id = ?", [prescription_id]);
      await run(db, "UPDATE prescription_items SET quantity_dispensed = quantity_prescribed WHERE prescription_id = ?", [prescription_id]);
    }

    let loyaltyPointsEarned = 0;
    if (customer_id) {
      loyaltyPointsEarned = Math.floor(total / 100);
      await run(db, 'UPDATE customers SET loyalty_points = loyalty_points + ?, total_purchases = total_purchases + ? WHERE id = ?', [loyaltyPointsEarned, total, customer_id]);
      await run(db, 'UPDATE sales SET loyalty_points_earned = ? WHERE id = ?', [loyaltyPointsEarned, saleId]);
    }

    const sale = await first(db, 'SELECT * FROM sales WHERE id = ?', [saleId]);
    const fullItems = await all(
      db,
      `SELECT si.*, m.brand_name, m.generic_name, m.strength
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       WHERE si.sale_id = ?`,
      [saleId]
    );

    return json({ ...sale, invoice_number: invoiceNumber, payment_reference: paymentRef, items: fullItems }, 201);
  }

  if (method === 'GET' && segment === 'sales') {
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const userId = searchParams.get('user_id');

    let where = "WHERE s.status = 'completed'";
    const params = [];

    if (startDate) {
      where += ' AND s.created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      where += ' AND s.created_at <= ?';
      params.push(endDate + 'T23:59:59');
    }
    if (userId) {
      where += ' AND s.user_id = ?';
      params.push(parseInt(userId));
    }

    const countRow = await first(db, `SELECT COUNT(*) as total FROM sales s ${where}`, params);
    const total = countRow ? countRow.total : 0;

    const sales = await all(
      db,
      `SELECT s.*, u.full_name as user_name, c.name as customer_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN customers c ON c.id = s.customer_id
       ${where}
       ORDER BY s.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return json({ sales, total, page, limit, totalPages: Math.ceil(total / limit) });
  }

  if (method === 'GET' && segment === 'today-summary') {
    const today = new Date().toISOString().split('T')[0];

    const totalSales = await first(
      db,
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total, COALESCE(SUM(discount_amount), 0) as discounts, COALESCE(SUM(vat_amount), 0) as taxes
       FROM sales WHERE status = 'completed' AND DATE(created_at) = ?`,
      [today]
    );
    const paymentBreakdown = await all(
      db,
      `SELECT payment_method, COUNT(*) as count, SUM(amount_paid) as total
       FROM sales WHERE status = 'completed' AND DATE(created_at) = ?
       GROUP BY payment_method`,
      [today]
    );
    const itemsSold = await first(
      db,
      `SELECT COALESCE(SUM(si.quantity), 0) as count
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       WHERE s.status = 'completed' AND DATE(s.created_at) = ?`,
      [today]
    );

    return json({
      date: today,
      total_sales: totalSales.count,
      total_revenue: totalSales.total,
      total_discounts: totalSales.discounts,
      total_taxes: totalSales.taxes,
      items_sold: itemsSold.count,
      payment_methods: paymentBreakdown,
    });
  }

  if (method === 'GET' && segment === 'profit') {
    const startDate = searchParams.get('start_date') || new Date().toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || startDate;

    const revenue = await first(
      db,
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM sales WHERE status = 'completed' AND DATE(created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );
    const cost = await first(
      db,
      `SELECT COALESCE(SUM(si.subtotal), 0) as total
       FROM sale_items si
       JOIN sales s ON s.id = si.sale_id
       JOIN batches b ON b.id = si.batch_id
       WHERE s.status = 'completed' AND DATE(s.created_at) BETWEEN ? AND ?`,
      [startDate, endDate]
    );

    const profit = revenue.total - cost.total;

    return json({
      start_date: startDate,
      end_date: endDate,
      revenue: revenue.total,
      cost: cost.total,
      profit: profit,
      margin: revenue.total > 0 ? (profit / revenue.total * 100).toFixed(2) : 0,
    });
  }

  if (method === 'POST' && segment === 'void') {
    const authUser = await authenticate(request, env);
    if (!authUser) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const id = parts[1] ? parseInt(parts[1]) : null;
    if (!id) {
      return json({ error: 'Sale ID is required' }, 400);
    }

    const sale = await first(db, 'SELECT * FROM sales WHERE id = ?', [id]);
    if (!sale) {
      return json({ error: 'Sale not found' }, 404);
    }
    if (sale.status === 'voided') {
      return json({ error: 'Sale already voided' }, 400);
    }

    await run(db, "UPDATE sales SET status = 'voided' WHERE id = ?", [id]);

    const items = await all(db, 'SELECT * FROM sale_items WHERE sale_id = ?', [id]);
    for (const item of items) {
      if (item.batch_id) {
        await run(db, 'UPDATE batches SET quantity = quantity + ? WHERE id = ?', [item.quantity, item.batch_id]);
        await run(
          db,
          `INSERT INTO inventory_adjustments (medicine_id, batch_id, adjustment_type, quantity, reason, user_id, created_at)
           VALUES (?, ?, 'increase', ?, ?, ?, ?)`,
          [item.medicine_id, item.batch_id, item.quantity, `Sale #${id} voided`, authUser.id, new Date().toISOString()]
        );
      }
    }

    if (sale.customer_id && sale.loyalty_points_earned > 0) {
      await run(
        db,
        'UPDATE customers SET loyalty_points = MAX(0, loyalty_points - ?) WHERE id = ?',
        [sale.loyalty_points_earned, sale.customer_id]
      );
    }

    return json({ message: 'Sale voided successfully' });
  }

  if (method === 'GET' && segment && segment !== 'sales' && segment !== 'today-summary' && segment !== 'profit' && segment !== 'void') {
    const id = parseInt(segment);
    if (isNaN(id)) {
      return json({ error: 'Invalid ID' }, 400);
    }

    const sale = await first(
      db,
      `SELECT s.*, u.full_name as user_name, c.name as customer_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN customers c ON c.id = s.customer_id
       WHERE s.id = ?`,
      [id]
    );
    if (!sale) {
      return json({ error: 'Sale not found' }, 404);
    }

    const items = await all(
      db,
      `SELECT si.*, m.brand_name
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       WHERE si.sale_id = ?`,
      [id]
    );

    return json({ ...sale, items });
  }

  return json({ error: 'Not found' }, 404);
}
