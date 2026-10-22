import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './App.css';

function App() {
  // Navigation & Data States
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reportSubTab, setReportSubTab] = useState('all');

  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [deliveries, setDeliveries] = useState([]);

  // How many rows to show per table before a "Show More" click reveals
  // more — keeps long tables from forcing endless scrolling.
  const ROWS_PER_PAGE = 10;
  const [visibleProducts, setVisibleProducts] = useState(ROWS_PER_PAGE);
  const [visibleCustomers, setVisibleCustomers] = useState(ROWS_PER_PAGE);
  const [visibleSuppliers, setVisibleSuppliers] = useState(ROWS_PER_PAGE);
  const [visibleTransactions, setVisibleTransactions] = useState(ROWS_PER_PAGE);
  const [visibleDeliveries, setVisibleDeliveries] = useState(ROWS_PER_PAGE);
  const [visibleReports, setVisibleReports] = useState(ROWS_PER_PAGE);
  const [transactionPeriod, setTransactionPeriod] = useState('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Theme (dark / light) — persisted so it survives a refresh, and
  // applied as a data-attribute on <html> so every CSS var-driven
  // surface in App.css picks it up automatically.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('buildright-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('buildright-theme', theme);
    } catch {
      // localStorage unavailable — theme just won't persist, non-fatal
    }
  }, [theme]);

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // Mobile nav drawer — the sidebar becomes a slide-in panel under the
  // mobile breakpoint (see App.css), toggled by the hamburger button
  // in the topbar and closed on backdrop tap or nav selection.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Modal States
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [staffName, setStaffName] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');

  // Cashier POS Multi-Item Cart States
  const [cart, setCart] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [cartQuantity, setCartQuantity] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [cashPayment, setCashPayment] = useState('');
  const [orderType, setOrderType] = useState('Takeout');
  const [posSuccessMsg, setPosSuccessMsg] = useState('');

  // New Customer Modal State (for Cashier)
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Reports are computed live from transactions/products/deliveries below
  // (see `derivedReports`) rather than logged imperatively — this way any
  // sale placed from ANY session or app (cashier POS or the online
  // storefront) shows up here, not just ones made in this browser tab.
  // We only need to remember which entries the admin has dismissed.
  const [dismissedReportIds, setDismissedReportIds] = useState(new Set());

  const ADMIN_PIN = "1234";
  const CASHIER_PIN = "5678";
  const DELIVERY_PIN = "9012";

  const fetchDeliveries = () => {
    return axios.get('http://localhost:5000/api/deliveries')
      .then(res => setDeliveries(res.data))
      .catch(() => {}); // non-fatal — the rest of the app still works without it
  };

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(true);

      Promise.all([
        axios.get('http://localhost:5000/api/products').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/customers').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/suppliers').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/transactions').catch(() => ({ data: [] })),
        axios.get('http://localhost:5000/api/deliveries').catch(() => ({ data: [] }))
      ])
      .then(([prodRes, custRes, suppRes, transRes, delivRes]) => {
        setProducts(prodRes.data);
        setCustomers(custRes.data);
        setSuppliers(suppRes.data);
        setTransactions(transRes.data);
        setDeliveries(delivRes.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to fetch database records from backend server.');
        setLoading(false);
      });
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!staffName.trim()) {
      setLoginError('Please enter your staff name.');
      return;
    }

    if (pinInput === ADMIN_PIN) {
      setUserRole('admin');
      setIsAuthenticated(true);
      setActiveTab('dashboard');
      setLoginError('');
    } else if (pinInput === CASHIER_PIN) {
      setUserRole('cashier');
      setIsAuthenticated(true);
      setActiveTab('cashierPOS');
      setLoginError('');
    } else if (pinInput === DELIVERY_PIN) {
      setUserRole('delivery');
      setIsAuthenticated(true);
      setActiveTab('deliveryQueue');
      setLoginError('');
    } else {
      setLoginError('Incorrect PIN. Admin: 1234 | Cashier: 5678 | Delivery: 9012.');
    }
  };

  // Add Item to POS Cart
  const handleAddToCart = () => {
    if (!selectedProductId) {
      Swal.fire('Error', 'Please select a product to add.', 'error');
      return;
    }
    const product = products.find(p => p.product_id === Number(selectedProductId));
    if (!product) return;

    const qty = Number(cartQuantity);

    // Check if item is already in cart
    const existingIndex = cart.findIndex(item => item.product_id === product.product_id);
    let currentQtyInCart = existingIndex >= 0 ? cart[existingIndex].quantity : 0;

    if ((currentQtyInCart + qty) > product.stock_quantity) {
      Swal.fire('Error', `Cannot add more! Total requested quantity exceeds available stock (${product.stock_quantity}).`, 'error');
      return;
    }

    if (existingIndex >= 0) {
      const updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qty;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        product_id: product.product_id,
        product_name: product.product_name,
        unit_price: Number(product.unit_price),
        quantity: qty,
        stock_quantity: product.stock_quantity
      }]);
    }

    setSelectedProductId('');
    setCartQuantity(1);
    setPosSuccessMsg('');
  };

  // Remove single item from cart
  const handleRemoveFromCart = (productId) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  // Handle Adding New Customer from POS
  const handleAddCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim() || !newCustAddress.trim()) {
      Swal.fire('Error', 'Please fill in Name, Phone, and Address.', 'error');
      return;
    }

    try {
      const payload = {
        name: newCustName,
        contact_number: newCustPhone,
        address: newCustAddress,
        customer_type: 'Homeowner',
        credit_limit: 0.00,
        current_balance: 0.00,
        payment_terms_days: 0
      };

      const res = await axios.post('http://localhost:5000/api/customers', payload);
      const newCustomerRecord = {
        customer_id: res.data.customer_id || (customers.length > 0 ? Math.max(...customers.map(c => c.customer_id)) + 1 : 1),
        name: newCustName,
        contact_number: newCustPhone,
        address: newCustAddress,
        customer_type: 'Homeowner',
        credit_limit: 0.00,
        current_balance: 0.00,
        payment_terms_days: 0
      };

      setCustomers([...customers, newCustomerRecord]);
      setSelectedCustomerId(newCustomerRecord.customer_id);
      setShowNewCustomerModal(false);

      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');

      Swal.fire('Success!', 'Customer successfully added and saved to database!', 'success');
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to save customer to the database.', 'error');
    }
  };

  const handleDeleteCustomer = (customerId, customerName) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Are you sure you want to remove customer "${customerName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it!',
      cancelButtonText: 'Cancel'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`http://localhost:5000/api/customers/${customerId}`);
          setCustomers(customers.filter(c => c.customer_id !== customerId));
          Swal.fire('Deleted!', 'Customer has been removed successfully.', 'success');
        } catch (err) {
          console.error(err);
          Swal.fire('Error!', 'Failed to delete customer from backend server.', 'error');
        }
      }
    });
  };

  const handleDeleteProduct = (productId, productName) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Remove product "${productName}" from inventory?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`http://localhost:5000/api/products/${productId}`);
          setProducts(products.filter(p => p.product_id !== productId));
          Swal.fire('Deleted!', 'Product has been removed.', 'success');
        } catch (err) {
          Swal.fire('Error!', 'Failed to delete product.', 'error');
        }
      }
    });
  };

  const handleDeleteSupplier = (supplierId, supplierName) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Remove supplier "${supplierName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`http://localhost:5000/api/suppliers/${supplierId}`);
          setSuppliers(suppliers.filter(s => s.supplier_id !== supplierId));
          Swal.fire('Deleted!', 'Supplier has been removed.', 'success');
        } catch (err) {
          Swal.fire('Error!', 'Failed to delete supplier.', 'error');
        }
      }
    });
  };

  const handleDeleteTransaction = (transactionId) => {
    Swal.fire({
      title: 'Are you sure?',
      text: `Remove transaction record #${transactionId}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove it!'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await axios.delete(`http://localhost:5000/api/transactions/${transactionId}`);
          setTransactions(transactions.filter(t => t.transaction_id !== transactionId));
          Swal.fire('Deleted!', 'Transaction record has been removed.', 'success');
        } catch (err) {
          Swal.fire('Error!', 'Failed to delete transaction.', 'error');
        }
      }
    });
  };

  // Calculate Cart Totals
  const totalCartAmount = cart.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
  const changeDue = cashPayment ? Number(cashPayment) - totalCartAmount : 0;

  const handleCompleteSale = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      Swal.fire('Error', 'Your cart is empty. Please add items to purchase.', 'error');
      return;
    }
    if (!selectedCustomerId) {
      Swal.fire('Error', 'Please select a customer.', 'error');
      return;
    }
    if (Number(cashPayment) < totalCartAmount) {
      Swal.fire('Error', 'Insufficient cash payment amount!', 'error');
      return;
    }

    try {
      let updatedProductsList = [...products];

      // Update stock for each product in cart
      for (const item of cart) {
        const prodRef = products.find(p => p.product_id === item.product_id);
        const newStock = prodRef.stock_quantity - item.quantity;

        await axios.put(`http://localhost:5000/api/products/${item.product_id}`, {
          product_name: prodRef.product_name,
          unit_price: prodRef.unit_price,
          stock_quantity: newStock,
          reorder_level: prodRef.reorder_level,
          unit_measure: prodRef.unit_measure,
          barcode: prodRef.barcode
        });

        updatedProductsList = updatedProductsList.map(p =>
          p.product_id === item.product_id ? { ...p, stock_quantity: newStock } : p
        );
      }

      setProducts(updatedProductsList);

      const transactionPayload = {
        customer_id: Number(selectedCustomerId),
        total_amount: totalCartAmount,
        payment_method: `Cash (${orderType})`,
        user_id: userRole === 'cashier' ? 1 : null,
        cashier_name: staffName,
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };

      const res = await axios.post('http://localhost:5000/api/transactions', transactionPayload);
      const newTransactionId = res.data.transaction_id || (transactions.length + 1);

      const newTransaction = {
        transaction_id: newTransactionId,
        customer_id: Number(selectedCustomerId),
        total_amount: totalCartAmount,
        payment_method: `Cash (${orderType})`,
        cashier_name: staffName,
        transaction_date: new Date()
      };
      setTransactions([newTransaction, ...transactions]);

      const customerObj = customers.find(c => c.customer_id === Number(selectedCustomerId));
      if (orderType === 'Delivery') {
        try {
          await axios.post('http://localhost:5000/api/deliveries', {
            order_id: newTransactionId,
            delivery_address: customerObj ? customerObj.address : 'N/A'
          });
          await fetchDeliveries();
        } catch (deliveryErr) {
          console.error(deliveryErr);
          Swal.fire('Note', 'Sale was recorded, but the delivery entry could not be created. Check the Delivery Dispatch tab.', 'warning');
        }
      }

      setPosSuccessMsg(`Sale successful! [${orderType}]. Change returned: ₱${changeDue.toFixed(2)}. Saved to database.`);

      setCart([]);
      setCashPayment('');

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to complete multi-item transaction or update server inventory.', 'error');
    }
  };

  const handleUpdateDeliveryStatus = async (deliveryId, newStatus) => {
    try {
      await axios.put(`http://localhost:5000/api/deliveries/${deliveryId}`, {
        dispatch_status: newStatus
      });
      setDeliveries(prev => prev.map(d =>
        d.delivery_id === deliveryId ? { ...d, dispatch_status: newStatus } : d
      ));
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to update delivery status on the server.', 'error');
    }
  };

  // ---------------------------------------------------------------
  // Reports are DERIVED live from transactions, products, and
  // deliveries — not built up as a session-only log. This means any
  // sale placed from any session (this admin tab, another admin tab,
  // or the online storefront) shows up here on every load/refresh.
  // ---------------------------------------------------------------
  const derivedReports = useMemo(() => {
    const reports = [];

    // Monthly sales summary
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyTrans = transactions.filter(t => {
      const tDate = new Date(t.transaction_date);
      return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
    });
    const monthlyTotal = monthlyTrans.reduce((sum, t) => sum + Number(t.total_amount), 0);
    reports.push({
      id: 'sales-monthly-summary',
      timestamp: new Date().toLocaleString(),
      category: 'SALES',
      title: `Monthly Sales Summary (${monthlyTrans.length} Transactions)`,
      details: `Total revenue is ₱${monthlyTotal.toFixed(2)}.`
    });

    // One entry per transaction (works no matter which app/session created it)
    transactions.forEach(t => {
      reports.push({
        id: `sales-tx-${t.transaction_id}`,
        timestamp: new Date(t.transaction_date).toLocaleString(),
        category: 'SALES',
        title: `Sale Recorded — Tx #${t.transaction_id} (${t.cashier_name || 'System Cashier'})`,
        details: `Payment: ${t.payment_method} | Total: ₱${Number(t.total_amount).toFixed(2)}`
      });
    });

    // Inventory alerts, recomputed from current live stock
    products.forEach(p => {
      if (p.stock_quantity === 0) {
        reports.push({
          id: `stock-out-${p.product_id}`,
          timestamp: new Date().toLocaleString(),
          category: 'INVENTORY_ALERT',
          title: `OUT OF STOCK: ${p.product_name}`,
          details: `Product ID ${p.product_id} has 0 units remaining.`
        });
      } else if (p.stock_quantity <= p.reorder_level) {
        reports.push({
          id: `stock-low-${p.product_id}`,
          timestamp: new Date().toLocaleString(),
          category: 'INVENTORY_ALERT',
          title: `LOW STOCK WARNING: ${p.product_name}`,
          details: `Stock level is at ${p.stock_quantity} units.`
        });
      }
    });

    // Delivery events — now backed by the real deliveries table, so these
    // show up for every session/app, not just the one that created them.
    deliveries.forEach(d => {
      reports.push({
        id: `delivery-${d.delivery_id}`,
        timestamp: d.scheduled_date ? new Date(d.scheduled_date).toLocaleString() : new Date().toLocaleString(),
        category: 'DELIVERY',
        title: `Delivery #${d.delivery_id} — ${d.dispatch_status}`,
        details: `Customer: ${d.customer_name || 'N/A'} | Items: ${d.item_summary || 'N/A'}`
      });
    });

    return reports.sort((a, b) => (a.id < b.id ? 1 : -1));
  }, [transactions, products, deliveries]);

  const handleDeleteReport = (reportId) => {
    Swal.fire({
      title: 'Are you sure?',
      text: 'Do you want to dismiss this report from view?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, dismiss it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        setDismissedReportIds(prev => new Set(prev).add(reportId));
        Swal.fire('Dismissed!', 'Report has been removed from view.', 'success');
      }
    });
  };

  const filteredReports = derivedReports.filter(rep => {
    if (dismissedReportIds.has(rep.id)) return false;
    const tab = (reportSubTab || 'all').toLowerCase();
    const category = (rep.category || '').toLowerCase();

    if (tab.includes('sales')) return category === 'sales';
    if (tab.includes('delivery')) return category === 'delivery';
    if (tab.includes('stock')) return category.includes('stock') || category.includes('inventory');
    return true;
  });

  // Segregate transactions by day / week / month for the Transactions tab
  const filteredTransactions = transactions.filter(t => {
    if (transactionPeriod === 'all') return true;
    const tDate = new Date(t.transaction_date);
    const now = new Date();

    if (transactionPeriod === 'day') {
      return tDate.toDateString() === now.toDateString();
    }
    if (transactionPeriod === 'week') {
      // Monday-start week containing "now"
      const startOfWeek = new Date(now);
      const dayIndex = (now.getDay() + 6) % 7; // 0 = Monday
      startOfWeek.setDate(now.getDate() - dayIndex);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      return tDate >= startOfWeek && tDate < endOfWeek;
    }
    if (transactionPeriod === 'month') {
      return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  const totalProducts = products.length;
  const lowStockItems = products.filter(p => p.stock_quantity <= p.reorder_level);
  const totalInventoryValue = products.reduce((sum, p) => sum + (Number(p.unit_price) * p.stock_quantity), 0);

  const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.total_amount), 0);
  const estimatedCostOfGoods = totalRevenue * 0.70;
  const netProfit = totalRevenue - estimatedCostOfGoods;
  const isProfitable = netProfit >= 0;

  // Helper to compute last 6 months for chart visualization
  const getMonthlyChartData = () => {
    const monthsData = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const year = d.getFullYear();
      const monthIndex = d.getMonth();

      const monthTrans = transactions.filter(t => {
        const tDate = new Date(t.transaction_date);
        return tDate.getMonth() === monthIndex && tDate.getFullYear() === year;
      });

      const rev = monthTrans.reduce((sum, t) => sum + Number(t.total_amount), 0);
      const inc = rev * 0.30; // Estimated 30% net income margin based on 70% cost assumption
      monthsData.push({ label: `${monthName} ${year}`, revenue: rev, income: inc });
    }
    return monthsData;
  };

  const monthlyChartData = getMonthlyChartData();
  const maxChartValue = Math.max(...monthlyChartData.map(m => Math.max(m.revenue, m.income)), 1000);

  return (
    <div className="app-shell">

      {/* Ambient liquid-glass background */}
      <div className="bg-orbs">
        <div className="orb orb-copper"></div>
        <div className="orb orb-teal"></div>
        <div className="orb orb-blue"></div>
      </div>
      <div className="grain-overlay"></div>

      {/* LANDING / LOGIN — split layout: form on the left, photo on the right */}
      {!isAuthenticated && (
        <div className="modal-overlay auth-overlay">
          <div className="modal-card modal-card-auth glass glass-strong">

            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle auth-theme-toggle"
              aria-label="Toggle dark or light mode"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>

            <div className="auth-form-col">
              <div className="auth-brand">
                <div className="brand-mark">🛠️</div>
                <div>
                  <h2>BuildRight</h2>
                  <span>Hardware Systems</span>
                </div>
              </div>

              <h1>Staff Login</h1>
              <p className="auth-lede">
                Welcome to BuildRight Hardware Store's inventory and system manager.
                Sign in with your staff name and PIN to continue.
              </p>

              <p className="pin-hint">
                Admin PIN: <b>1234</b><br />
                Cashier PIN: <b>5678</b><br />
                Delivery Staff PIN: <b>9012</b>
              </p>

              <form onSubmit={handleLogin} className="form-stack">
                <input
                  type="text"
                  placeholder="Staff Name (e.g., Juan / Ana)"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="field"
                />
                <input
                  type="password"
                  placeholder="Enter PIN (1234, 5678, or 9012)"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  maxLength="4"
                  className="field"
                />
                {loginError && <p className="form-error">{loginError}</p>}
                <button type="submit" className="btn btn-primary">
                  Login to System
                </button>
              </form>
            </div>

            <div className="auth-visual">
              <svg className="auth-visual-art" viewBox="0 0 500 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                <defs>
                  <linearGradient id="authBg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ff8a3d" />
                    <stop offset="55%" stopColor="#c9622a" />
                    <stop offset="100%" stopColor="#173a37" />
                  </linearGradient>
                  <linearGradient id="authGrid" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <rect width="500" height="600" fill="url(#authBg)" />
                <circle cx="420" cy="90" r="150" fill="url(#authGrid)" />
                <circle cx="60" cy="520" r="180" fill="url(#authGrid)" />
                {/* Wrench */}
                <g transform="translate(150,230) rotate(-28)" fill="#ffffff" fillOpacity="0.92">
                  <path d="M0 18 a34 34 0 1 1 24 32 l70 70 a12 12 0 0 1 -17 17 l-70 -70 a34 34 0 0 1 -7 -49 z" />
                  <circle cx="16" cy="16" r="10" fill="#c9622a" fillOpacity="0.35" />
                </g>
                {/* Hammer */}
                <g transform="translate(255,340) rotate(18)" fill="#ffffff" fillOpacity="0.85">
                  <rect x="-6" y="0" width="12" height="120" rx="6" />
                  <path d="M-42 -34 h84 a10 10 0 0 1 10 10 v20 a10 10 0 0 1 -10 10 h-84 a18 18 0 0 1 -18 -18 a18 18 0 0 1 18 -22 z" />
                </g>
                {/* Nut/bolt */}
                <g transform="translate(120,420)" fill="#ffffff" fillOpacity="0.8">
                  <polygon points="0,-26 22,-13 22,13 0,26 -22,13 -22,-13" />
                  <circle cx="0" cy="0" r="10" fill="#173a37" />
                </g>
              </svg>
              <div className="auth-visual-caption">
                <strong>Built for the trade counter</strong>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 3. ADD NEW CUSTOMER MODAL */}
      {showNewCustomerModal && (
        <div className="modal-overlay">
          <div className="modal-card glass glass-strong">
            <div className="modal-icon">➕</div>
            <h2>Add New Customer</h2>
            <form onSubmit={handleAddCustomer} className="form-stack">
              <input
                type="text"
                placeholder="Customer Full Name *"
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="field"
                required
              />
              <input
                type="text"
                placeholder="Phone Number *"
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="field"
                required
              />
              <textarea
                placeholder="Delivery / Complete Address *"
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                className="field"
                style={{ height: '70px' }}
                required
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                <button type="submit" className="btn btn-success btn-block">
                  Save Customer
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="btn btn-ghost btn-block"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mobile nav backdrop — tap outside the drawer to close it */}
      {mobileNavOpen && (
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)}></div>
      )}

      {/* LEFT SIDEBAR NAVIGATION */}
      <div className={`sidebar glass ${!isAuthenticated ? 'locked' : ''} ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">🛠️</div>
          <div>
            <h2>BuildRight</h2>
            <span>Hardware Systems</span>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="sidebar-close no-print"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div className="nav-list" onClick={() => setMobileNavOpen(false)}>
          {userRole === 'admin' && (
            <>
              <button onClick={() => setActiveTab('dashboard')} className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}>📊 Dashboard</button>
              <button onClick={() => setActiveTab('inventory')} className={`nav-btn ${activeTab === 'inventory' ? 'active' : ''}`}>📦 Inventory</button>
              <button onClick={() => setActiveTab('customers')} className={`nav-btn ${activeTab === 'customers' ? 'active' : ''}`}>🤝 Customers</button>
              <button onClick={() => setActiveTab('suppliers')} className={`nav-btn ${activeTab === 'suppliers' ? 'active' : ''}`}>🚚 Suppliers</button>
              <button onClick={() => setActiveTab('transactions')} className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}>💰 Transactions</button>
              <button onClick={() => setActiveTab('deliveryQueue')} className={`nav-btn ${activeTab === 'deliveryQueue' ? 'active' : ''}`}>🚚 Delivery Dispatch</button>
              <button onClick={() => setActiveTab('reports')} className={`nav-btn ${activeTab === 'reports' ? 'active' : ''}`}>📈 Reports</button>
            </>
          )}

          {userRole === 'cashier' && (
            <button onClick={() => setActiveTab('cashierPOS')} className={`nav-btn ${activeTab === 'cashierPOS' ? 'active' : ''}`}>🛒 Cashier POS Terminal</button>
          )}

          {userRole === 'delivery' && (
            <button onClick={() => setActiveTab('deliveryQueue')} className={`nav-btn ${activeTab === 'deliveryQueue' ? 'active' : ''}`}>🚚 Active Delivery Board</button>
          )}
        </div>

        {isAuthenticated && (
          <div className="sidebar-footer">
            <p>
              Role: <strong>{userRole}</strong><br />
              User: <strong className="user-name">{staffName}</strong>
            </p>
            <button
              onClick={() => { setIsAuthenticated(false); setUserRole(''); setMobileNavOpen(false); }}
              className="btn btn-danger btn-block btn-sm"
            >
              Lock Shift / Logout
            </button>
          </div>
        )}
      </div>

      {/* MAIN CONTENT AREA */}
      <div className={`main-content ${!isAuthenticated ? 'locked' : ''}`}>

        <div className="topbar glass">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="hamburger-btn no-print"
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1>
              {activeTab === 'dashboard' && 'System Overview Dashboard'}
              {activeTab === 'inventory' && 'Hardware Inventory Management'}
              {activeTab === 'customers' && 'Store Customers Database'}
              {activeTab === 'suppliers' && 'Hardware Suppliers Database'}
              {activeTab === 'transactions' && 'Sales Transactions Database (Cashier Auditing)'}
              {activeTab === 'deliveryQueue' && 'Customer Delivery & Fulfillment Management'}
              {activeTab === 'reports' && 'Business Intelligence & Segregated Reports'}
              {activeTab === 'cashierPOS' && 'Cashier Point of Sale Terminal'}
            </h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="no-print">
            <span className="status-pill"><span className="status-dot"></span>Connected to MySQL Database</span>
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle dark or light mode"
            >
              {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
          </div>
        </div>

        {loading && (
          <div className="loading-row"><span className="spinner"></span>Loading database records...</div>
        )}
        {error && <p className="error-banner">{error}</p>}

        {/* CASHIER POS VIEW (MULTI-ITEM CART) */}
        {!loading && activeTab === 'cashierPOS' && (
          <div className="pos-grid view-panel" key="cashierPOS">

            <div className="panel glass">
              <h2>Multi-Item Purchase Order Entry</h2>
              {posSuccessMsg && (
                <div className="pos-success">
                  {posSuccessMsg}
                </div>
              )}

              <div className="form-block">
                <div>
                  <label className="field-label">Fulfillment Order Type</label>
                  <div className="type-toggle">
                    <button
                      type="button"
                      onClick={() => setOrderType('Takeout')}
                      className={`type-btn ${orderType === 'Takeout' ? 'active-takeout' : ''}`}
                    >
                      🛍️ Takeout Counter Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setOrderType('Delivery')}
                      className={`type-btn ${orderType === 'Delivery' ? 'active-delivery' : ''}`}
                    >
                      🚚 Home Delivery Dispatch
                    </button>
                  </div>
                </div>

                <div>
                  <div className="row-between">
                    <label className="field-label" style={{ marginBottom: 0 }}>Select Customer</label>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomerModal(true)}
                      className="btn btn-success btn-xs"
                    >
                      + Add New Customer
                    </button>
                  </div>
                  <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="field">
                    <option value="">-- Choose Customer --</option>
                    {customers.map(c => (
                      <option key={c.customer_id} value={c.customer_id}>{c.name} ({c.contact_number}) - {c.address}</option>
                    ))}
                  </select>
                </div>

                {/* Add Item Row */}
                <div className="add-item-box">
                  <label className="field-label">Add Products to Cart</label>
                  <div className="add-item-row">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="field"
                      style={{ flex: 2 }}
                    >
                      <option value="">-- Choose Hardware Item --</option>
                      {products.map(p => (
                        <option key={p.product_id} value={p.product_id}>
                          {p.product_name} - ₱{Number(p.unit_price).toFixed(2)} (Stock: {p.stock_quantity})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={cartQuantity}
                      onChange={(e) => setCartQuantity(e.target.value)}
                      className="field"
                      style={{ flex: 0.8 }}
                      placeholder="Qty"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="btn btn-info btn-block"
                  >
                    + Add Item to Cart
                  </button>
                </div>

                {/* Current Cart Itemized List */}
                <div>
                  <label className="field-label">Current Cart Items ({cart.length})</label>
                  {cart.length === 0 ? (
                    <div className="empty-cart">
                      No items added to cart yet. Select items above.
                    </div>
                  ) : (
                    <table className="mini-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ textAlign: 'center' }}>Qty</th>
                          <th style={{ textAlign: 'right' }}>Subtotal</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, idx) => (
                          <tr key={item.product_id} style={{ '--i': idx }}>
                            <td>{item.product_name}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>₱{(item.unit_price * item.quantity).toFixed(2)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button onClick={() => handleRemoveFromCart(item.product_id)} className="btn btn-danger btn-xs">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div>
                  <label className="field-label">Customer Cash Payment (₱)</label>
                  <input type="number" step="0.01" placeholder="Enter cash amount given..." value={cashPayment} onChange={(e) => setCashPayment(e.target.value)} className="field" />
                </div>

                <button type="button" onClick={handleCompleteSale} className="btn btn-primary">
                  Complete Paid Sale & Store Transaction
                </button>
              </div>
            </div>

            {/* Cart Summary Panel */}
            <div className="summary-card glass glass-strong">
              <h2>Payment Summary</h2>
              <div className="summary-rows">
                <div className="summary-line"><span>Cashier:</span><strong>{staffName}</strong></div>
                <div className="summary-line"><span>Order Type:</span><strong style={{ color: orderType === 'Delivery' ? 'var(--success)' : 'var(--copper)' }}>{orderType}</strong></div>
                <div className="summary-line"><span>Total Items:</span><strong>{cart.reduce((acc, i) => acc + i.quantity, 0)} units ({cart.length} types)</strong></div>
                <hr className="divider" />
                <div className="total-line"><span>Total Amount:</span><span>₱{totalCartAmount.toFixed(2)}</span></div>
                <div className="summary-line"><span>Cash Tendered:</span><span>₱{Number(cashPayment || 0).toFixed(2)}</span></div>
                <hr className="divider" />
                <div className={`change-box ${changeDue < 0 ? 'negative' : ''}`}>
                  <span>Change Due:</span>
                  <span>₱{changeDue >= 0 ? changeDue.toFixed(2) : '0.00'}</span>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* DELIVERY QUEUE VIEW */}
        {!loading && activeTab === 'deliveryQueue' && (
          <div className="panel glass view-panel" key="deliveryQueue">
            <h2>Active Delivery Dispatch Board</h2>
            {deliveries.length === 0 ? (
              <div className="empty-cart" style={{ padding: '30px' }}>
                No active delivery orders pending dispatch. Process a delivery sale from the Cashier POS terminal.
              </div>
            ) : (
              <div className="table-wrap">
                <table className="gtable">
                  <thead>
                    <tr>
                      <th>Delivery ID</th>
                      <th>Customer Name</th>
                      <th>Phone</th>
                      <th>Delivery Address</th>
                      <th>Purchased Item Summary</th>
                      <th>Cashier Staff</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.slice(0, visibleDeliveries).map((d, idx) => (
                      <tr key={d.delivery_id} style={{ '--i': idx }}>
                        <td>#{d.delivery_id}</td>
                        <td className="strong-cell">{d.customer_name || 'N/A'}</td>
                        <td>{d.customer_phone || 'N/A'}</td>
                        <td>{d.delivery_address}</td>
                        <td>{d.item_summary || '—'}</td>
                        <td>{d.cashier_name || 'Online Storefront'}</td>
                        <td>
                          <span className={`badge ${d.dispatch_status === 'Delivered' ? 'badge-success' : d.dispatch_status === 'Cancelled' ? 'badge-danger' : 'badge-warning'}`}>
                            {d.dispatch_status}
                          </span>
                        </td>
                        <td>
                          {d.dispatch_status !== 'Delivered' && d.dispatch_status !== 'Cancelled' && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {d.dispatch_status === 'Pending' && (
                                <button onClick={() => handleUpdateDeliveryStatus(d.delivery_id, 'Dispatched')} className="btn btn-info btn-xs">Dispatch</button>
                              )}
                              <button onClick={() => handleUpdateDeliveryStatus(d.delivery_id, 'Delivered')} className="btn btn-success btn-xs">Mark Delivered</button>
                            </div>
                          )}
                          {d.dispatch_status === 'Delivered' && <span className="badge badge-success">✓ Completed</span>}
                          {d.dispatch_status === 'Cancelled' && <span className="badge badge-danger">Cancelled</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {deliveries.length > visibleDeliveries && (
              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <button onClick={() => setVisibleDeliveries(v => v + ROWS_PER_PAGE)} className="btn btn-ghost btn-sm">
                  Show More ({deliveries.length - visibleDeliveries} remaining)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ADMIN VIEWS */}
        {!loading && userRole === 'admin' && (
          <>
            {activeTab === 'dashboard' && (
              <div className="view-panel" key="dashboard">
                {/* 1. Monthly Revenue and Income Bar Graph (Placed on top) */}
                <div className="chart-card glass">
                  <div className="chart-head">
                    <h3>📊 Monthly Revenue & Income Performance (Last 6 Months)</h3>
                    <div className="legend">
                      <span><span className="dot" style={{ background: 'var(--blue)' }}></span> Revenue</span>
                      <span><span className="dot" style={{ background: 'var(--success)' }}></span> Estimated Income</span>
                    </div>
                  </div>

                  <div className="chart-bars">
                    {monthlyChartData.map((m, index) => {
                      const revHeight = Math.round((m.revenue / maxChartValue) * 130);
                      const incHeight = Math.round((m.income / maxChartValue) * 130);

                      return (
                        <div key={index} className="chart-col">
                          <div className="bar-group">
                            <div
                              title={`Revenue: ₱${m.revenue.toFixed(2)}`}
                              className="bar bar-rev"
                              style={{ height: `${Math.max(revHeight, 4)}px`, animationDelay: `${index * 70}ms` }}
                            ></div>
                            <div
                              title={`Income: ₱${m.income.toFixed(2)}`}
                              className="bar bar-inc"
                              style={{ height: `${Math.max(incHeight, 4)}px`, animationDelay: `${index * 70 + 60}ms` }}
                            ></div>
                          </div>
                          <span className="chart-label">{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Company Status Banner */}
                <div className={`status-banner ${isProfitable ? 'profit' : 'loss'}`}>
                  <div>
                    <h3>{isProfitable ? '🟢 Company Status: PROFITABLE' : '🔴 Company Status: OPERATING AT LOSS'}</h3>
                    <p>Total Sales Revenue: <b>₱{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> | Estimated Net Profit: <b>₱{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></p>
                  </div>
                </div>

                {/* 3. Dashboard Metric Cards */}
                <div className="metric-grid">
                  <div className="metric-card glass clickable" style={{ '--i': 0 }} onClick={() => setActiveTab('inventory')}><h3>Total Products</h3><p style={{ color: 'var(--copper)' }}>{totalProducts}</p></div>
                  <div className="metric-card glass clickable" style={{ '--i': 1 }} onClick={() => setActiveTab('inventory')}><h3>Low Stock Alerts</h3><p style={{ color: lowStockItems.length > 0 ? 'var(--danger)' : 'var(--success)' }}>{lowStockItems.length}</p></div>
                  <div className="metric-card glass" style={{ '--i': 2 }}><h3>Inventory Value</h3><p style={{ color: 'var(--success)', fontSize: '22px' }}>₱{totalInventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p></div>
                  <div className="metric-card glass clickable" style={{ '--i': 3 }} onClick={() => setActiveTab('customers')}><h3>Total Customers</h3><p style={{ color: 'var(--teal)' }}>{customers.length}</p></div>
                  <div className="metric-card glass clickable" style={{ '--i': 4 }} onClick={() => setActiveTab('suppliers')}><h3>Total Suppliers</h3><p style={{ color: 'var(--warning)' }}>{suppliers.length}</p></div>
                  <div className="metric-card glass clickable" style={{ '--i': 5 }} onClick={() => setActiveTab('transactions')}><h3>Total Transactions</h3><p style={{ color: 'var(--blue)' }}>{transactions.length}</p></div>
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <div className="panel glass view-panel" key="inventory">
                <h2>Product Inventory Database</h2>
                <div className="table-wrap">
                  <table className="gtable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Barcode</th>
                        <th>Product Name</th>
                        <th>Unit Price (₱)</th>
                        <th>Stock Quantity</th>
                        <th>Unit</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, visibleProducts).map((product, idx) => {
                        const isLowStock = product.stock_quantity <= product.reorder_level;
                        return (
                          <tr key={product.product_id} style={{ '--i': idx }}>
                            <td>{idx + 1}</td>
                            <td className="mono">{product.barcode}</td>
                            <td className="strong-cell">{product.product_name}</td>
                            <td>₱{Number(product.unit_price).toFixed(2)}</td>
                            <td style={{ color: isLowStock ? 'var(--danger)' : 'var(--text-primary)', fontWeight: isLowStock ? 700 : 400 }}>{product.stock_quantity} {isLowStock ? '⚠️' : ''}</td>
                            <td>{product.unit_measure}</td>
                            <td>
                              <button onClick={() => handleDeleteProduct(product.product_id, product.product_name)} className="btn btn-danger btn-xs">Remove</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {products.length > visibleProducts && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button onClick={() => setVisibleProducts(v => v + ROWS_PER_PAGE)} className="btn btn-ghost btn-sm">
                      Show More ({products.length - visibleProducts} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'customers' && (
              <div className="panel glass view-panel" key="customers">
                <h2>Customers Database</h2>
                <div className="table-wrap">
                  <table className="gtable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Address</th>
                        <th>Customer Type</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.slice(0, visibleCustomers).map((c, idx) => (
                        <tr key={c.customer_id} style={{ '--i': idx }}>
                          <td>{idx + 1}</td>
                          <td className="strong-cell">{c.name}</td>
                          <td>{c.contact_number}</td>
                          <td>{c.address}</td>
                          <td>{c.customer_type}</td>
                          <td>
                            <button
                              onClick={() => handleDeleteCustomer(c.customer_id, c.name)}
                              className="btn btn-danger btn-xs"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {customers.length > visibleCustomers && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button onClick={() => setVisibleCustomers(v => v + ROWS_PER_PAGE)} className="btn btn-ghost btn-sm">
                      Show More ({customers.length - visibleCustomers} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'suppliers' && (
              <div className="panel glass view-panel" key="suppliers">
                <h2>Suppliers Database</h2>
                <div className="table-wrap">
                  <table className="gtable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Supplier Name</th>
                        <th>Contact Person</th>
                        <th>Phone</th>
                        <th>Email</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suppliers.slice(0, visibleSuppliers).map((s, idx) => (
                        <tr key={s.supplier_id} style={{ '--i': idx }}>
                          <td>{s.supplier_id}</td>
                          <td className="strong-cell">{s.supplier_name}</td>
                          <td>{s.contact_person}</td>
                          <td>{s.phone}</td>
                          <td>{s.email}</td>
                          <td>
                            <button onClick={() => handleDeleteSupplier(s.supplier_id, s.supplier_name)} className="btn btn-danger btn-xs">Remove</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {suppliers.length > visibleSuppliers && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button onClick={() => setVisibleSuppliers(v => v + ROWS_PER_PAGE)} className="btn btn-ghost btn-sm">
                      Show More ({suppliers.length - visibleSuppliers} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'transactions' && (
              <div className="panel glass view-panel" key="transactions">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                  <h2 style={{ margin: 0 }}>Sales Transactions & Cashier Audit Trail</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} className="no-print">
                    <div className="report-tabs">
                      <button
                        onClick={() => { setTransactionPeriod('all'); setVisibleTransactions(ROWS_PER_PAGE); }}
                        className={`chip ${transactionPeriod === 'all' ? 'chip-active-all' : ''}`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => { setTransactionPeriod('day'); setVisibleTransactions(ROWS_PER_PAGE); }}
                        className={`chip ${transactionPeriod === 'day' ? 'chip-active-sales' : ''}`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => { setTransactionPeriod('week'); setVisibleTransactions(ROWS_PER_PAGE); }}
                        className={`chip ${transactionPeriod === 'week' ? 'chip-active-delivery' : ''}`}
                      >
                        This Week
                      </button>
                      <button
                        onClick={() => { setTransactionPeriod('month'); setVisibleTransactions(ROWS_PER_PAGE); }}
                        className={`chip ${transactionPeriod === 'month' ? 'chip-active-stock' : ''}`}
                      >
                        This Month
                      </button>
                    </div>
                    <button onClick={handlePrint} className="btn btn-ghost btn-sm">🖨️ Print</button>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="gtable">
                    <thead>
                      <tr>
                        <th>Tx ID</th>
                        <th>Customer ID</th>
                        <th>Cashier Name</th>
                        <th>Payment Type</th>
                        <th>Total Amount (₱)</th>
                        <th>Date & Time</th>
                        <th className="no-print">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.slice(0, visibleTransactions).map((t, idx) => (
                        <tr key={t.transaction_id} style={{ '--i': idx }}>
                          <td>#{t.transaction_id}</td>
                          <td>{t.customer_id || 'N/A'}</td>
                          <td className="strong-cell" style={{ color: 'var(--blue)' }}>{t.cashier_name || 'System Cashier'}</td>
                          <td>{t.payment_method}</td>
                          <td className="strong-cell" style={{ color: 'var(--success)' }}>₱{Number(t.total_amount).toFixed(2)}</td>
                          <td>{new Date(t.transaction_date).toLocaleString()}</td>
                          <td className="no-print">
                            <button onClick={() => handleDeleteTransaction(t.transaction_id)} className="btn btn-danger btn-xs">Remove</button>
                          </td>
                        </tr>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan="7" className="empty-cell">No transactions found for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredTransactions.length > visibleTransactions && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }} className="no-print">
                    <button onClick={() => setVisibleTransactions(v => v + ROWS_PER_PAGE)} className="btn btn-ghost btn-sm">
                      Show More ({filteredTransactions.length - visibleTransactions} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* SEGREGATED REPORTS VIEW */}
            {activeTab === 'reports' && (
              <div className="panel glass view-panel" key="reports">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
                  <h2 style={{ margin: 0 }}>Automated Business Intelligence & Segregated Reports</h2>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} className="no-print">
                    <div className="report-tabs">
                      <button
                        onClick={() => setReportSubTab('all')}
                        className={`chip ${reportSubTab === 'all' ? 'chip-active-all' : ''}`}
                      >
                        All Reports
                      </button>
                      <button
                        onClick={() => setReportSubTab('sales')}
                        className={`chip ${reportSubTab === 'sales' ? 'chip-active-sales' : ''}`}
                      >
                        💰 Sales Reports
                      </button>
                      <button
                        onClick={() => setReportSubTab('delivery')}
                        className={`chip ${reportSubTab === 'delivery' ? 'chip-active-delivery' : ''}`}
                      >
                        🚚 Delivery Reports
                      </button>
                      <button
                        onClick={() => setReportSubTab('stock')}
                        className={`chip ${reportSubTab === 'stock' ? 'chip-active-stock' : ''}`}
                      >
                        📦 Stock Alerts
                      </button>
                    </div>
                    <button onClick={handlePrint} className="btn btn-ghost btn-sm">🖨️ Print</button>
                  </div>
                </div>

                <div className="table-wrap">
                  <table className="gtable">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Timestamp</th>
                        <th>Report Title</th>
                        <th>Details</th>
                        <th className="no-print">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-cell">No logs found for this category process.</td>
                        </tr>
                      ) : (
                        filteredReports.slice(0, visibleReports).map((rep, idx) => {
                          let badgeClass = 'badge-success';
                          if (rep.category === 'DELIVERY') badgeClass = 'badge-info';
                          if (rep.category === 'INVENTORY_ALERT') badgeClass = 'badge-danger';

                          return (
                            <tr key={rep.id} style={{ '--i': idx }}>
                              <td>
                                <span className={`badge ${badgeClass}`}>
                                  {rep.category}
                                </span>
                              </td>
                              <td className="muted-cell" style={{ fontSize: '12.5px' }}>{rep.timestamp}</td>
                              <td className="strong-cell">{rep.title}</td>
                              <td>{rep.details}</td>
                              <td className="no-print">
                                <button
                                  onClick={() => handleDeleteReport(rep.id)}
                                  className="btn btn-danger btn-xs"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {filteredReports.length > visibleReports && (
                  <div style={{ textAlign: 'center', marginTop: '16px' }} className="no-print">
                    <button onClick={() => setVisibleReports(v => v + ROWS_PER_PAGE)} className="btn btn-ghost btn-sm">
                      Show More ({filteredReports.length - visibleReports} remaining)
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export default App;