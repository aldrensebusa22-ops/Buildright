const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Database Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'buildright_hardware',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});

// Test database connection on startup
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database (buildright_hardware)');
    connection.release();
  })
  .catch(err => {
    console.error('Database connection failed:', err.message);
  });

// ==================== PRODUCTS ENDPOINTS ====================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (used for stock adjustments during sales)
app.put('/api/products/:id', async (req, res) => {
  try {
    const { product_name, unit_price, stock_quantity, reorder_level, unit_measure, barcode } = req.body;
    await pool.query(
      'UPDATE products SET product_name = ?, unit_price = ?, stock_quantity = ?, reorder_level = ?, unit_measure = ?, barcode = ? WHERE product_id = ?',
      [product_name, unit_price, stock_quantity, reorder_level, unit_measure, barcode, req.params.id]
    );
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE product_id = ?', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== CUSTOMERS ENDPOINTS ====================

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM customers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new customer
app.post('/api/customers', async (req, res) => {
  try {
    const customerName = req.body.name || req.body.customer_name;
    const contactNumber = req.body.contact_number || req.body.phone;
    const { address, customer_type, credit_limit, current_balance, payment_terms_days } = req.body;
    
    if (!customerName) {
      return res.status(400).json({ error: "Customer name is required" });
    }

    const [result] = await pool.query(
      `INSERT INTO customers 
      (name, contact_number, address, customer_type, credit_limit, current_balance, payment_terms_days) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        customerName, 
        contactNumber || 'N/A', 
        address || '', 
        customer_type || 'Homeowner', 
        credit_limit || 0.00, 
        current_balance || 0.00, 
        payment_terms_days || 0
      ]
    );
    res.json({ message: 'Customer added successfully', customer_id: result.insertId });
  } catch (err) {
    console.error("Database Insert Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});
// Delete Customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM customers WHERE customer_id = ?', [req.params.id]);
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SUPPLIERS ENDPOINTS ====================

// Get all suppliers
app.get('/api/suppliers', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Supplier
app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM suppliers WHERE supplier_id = ?', [req.params.id]);
    res.json({ message: 'Supplier deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TRANSACTIONS ENDPOINTS ====================

// Get all transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM transactions ORDER BY transaction_date DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new transaction and transaction items
app.post('/api/transactions', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { customer_id, total_amount, payment_method, user_id, cashier_name, items } = req.body;

    const [transResult] = await connection.query(
      'INSERT INTO transactions (customer_id, total_amount, payment_method, user_id, cashier_name, transaction_date) VALUES (?, ?, ?, ?, ?, NOW())',
      [customer_id, total_amount, payment_method, user_id || null, cashier_name || 'System Cashier']
    );

    const transactionId = transResult.insertId;

    if (items && items.length > 0) {
      for (const item of items) {
        await connection.query(
          'INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
          [transactionId, item.product_id, item.quantity, item.unit_price]
        );
      }
    }

    await connection.commit();
    connection.release();

    res.json({ message: 'Transaction recorded successfully', transaction_id: transactionId });
  } catch (err) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }
});

// Delete Transaction
app.delete('/api/transactions/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    await connection.query('DELETE FROM transaction_items WHERE transaction_id = ?', [req.params.id]);
    await connection.query('DELETE FROM transactions WHERE transaction_id = ?', [req.params.id]);

    await connection.commit();
    connection.release();

    res.json({ message: 'Transaction deleted successfully' });
  } catch (err) {
    await connection.rollback();
    connection.release();
    res.status(500).json({ error: err.message });
  }
});

// ==================== DELIVERIES ENDPOINTS ====================
// The `deliveries` table itself only stores order_id, delivery_address,
// dispatch_status, etc. — customer name/phone and item details live in
// `transactions`, `customers`, and `transaction_items`, so GET joins
// those in for display.

// Get all deliveries (with customer + item info joined in)
app.get('/api/deliveries', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        d.delivery_id,
        d.order_id,
        d.delivery_address,
        d.dispatch_status,
        d.scheduled_date,
        d.delivery_confirmation_notes,
        t.cashier_name,
        t.payment_method,
        c.name AS customer_name,
        c.contact_number AS customer_phone,
        GROUP_CONCAT(CONCAT(ti.quantity, 'x ', p.product_name) SEPARATOR ', ') AS item_summary
      FROM deliveries d
      LEFT JOIN transactions t ON d.order_id = t.transaction_id
      LEFT JOIN customers c ON t.customer_id = c.customer_id
      LEFT JOIN transaction_items ti ON ti.transaction_id = t.transaction_id
      LEFT JOIN products p ON ti.product_id = p.product_id
      GROUP BY d.delivery_id
      ORDER BY d.scheduled_date DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a delivery record (called right after a Delivery-type sale is recorded)
app.post('/api/deliveries', async (req, res) => {
  try {
    const { order_id, delivery_address, driver_user_id } = req.body;

    if (!delivery_address) {
      return res.status(400).json({ error: "delivery_address is required" });
    }

    const [result] = await pool.query(
      `INSERT INTO deliveries (order_id, driver_user_id, delivery_address, dispatch_status)
       VALUES (?, ?, ?, 'Pending')`,
      [order_id || null, driver_user_id || null, delivery_address]
    );
    res.json({ message: 'Delivery created successfully', delivery_id: result.insertId });
  } catch (err) {
    console.error("Database Insert Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Update a delivery's dispatch status (Pending / Dispatched / Delivered / Cancelled)
app.put('/api/deliveries/:id', async (req, res) => {
  try {
    const { dispatch_status, delivery_confirmation_notes } = req.body;
    const allowed = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
    if (!allowed.includes(dispatch_status)) {
      return res.status(400).json({ error: `dispatch_status must be one of: ${allowed.join(', ')}` });
    }

    await pool.query(
      'UPDATE deliveries SET dispatch_status = ?, delivery_confirmation_notes = ? WHERE delivery_id = ?',
      [dispatch_status, delivery_confirmation_notes || null, req.params.id]
    );
    res.json({ message: 'Delivery updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});