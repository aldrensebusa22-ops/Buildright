import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const API_BASE = 'http://localhost:5000/api';

// ---------------------------------------------------------------
// Auto-generated category visuals (icon + gradient) — stands in
// for real product photos until the catalog has an image_url field.
// ---------------------------------------------------------------
const CATEGORY_RULES = [
  { keys: ['hammer', 'nail', 'screw', 'bolt', 'nut', 'anchor', 'fastener'], icon: '🔨', gradient: 'linear-gradient(150deg, #f0a868, #c97a3e)' },
  { keys: ['paint', 'brush', 'roller', 'primer', 'varnish'], icon: '🎨', gradient: 'linear-gradient(150deg, #6ea8ff, #45d6c4)' },
  { keys: ['pipe', 'faucet', 'valve', 'plumb', 'hose', 'fitting'], icon: '🚰', gradient: 'linear-gradient(150deg, #5b9dff, #2f5fc4)' },
  { keys: ['wire', 'cable', 'electric', 'switch', 'bulb', 'socket', 'breaker'], icon: '💡', gradient: 'linear-gradient(150deg, #ffc85c, #f0a868)' },
  { keys: ['wood', 'lumber', 'plywood', 'ply', 'timber', 'board'], icon: '🪵', gradient: 'linear-gradient(150deg, #c98a4e, #8a5a2e)' },
  { keys: ['cement', 'concrete', 'sand', 'gravel', 'mortar'], icon: '🧱', gradient: 'linear-gradient(150deg, #9aa3b5, #616a7c)' },
  { keys: ['tile', 'glass', 'mirror'], icon: '🪟', gradient: 'linear-gradient(150deg, #45d6c4, #2f9c8f)' },
  { keys: ['drill', 'saw', 'grinder', 'tool', 'wrench', 'plier'], icon: '🛠️', gradient: 'linear-gradient(150deg, #f0a868, #ff8a3d)' },
  { keys: ['rope', 'chain', 'strap'], icon: '⛓️', gradient: 'linear-gradient(150deg, #8a93a8, #565f74)' },
  { keys: ['ladder', 'scaffold'], icon: '🪜', gradient: 'linear-gradient(150deg, #ffc85c, #d9973a)' },
  { keys: ['lock', 'hinge', 'handle', 'knob'], icon: '🔐', gradient: 'linear-gradient(150deg, #6ea8ff, #45d6c4)' },
];
const DEFAULT_VISUAL = { icon: '📦', gradient: 'linear-gradient(150deg, #7a8296, #4b5266)' };

function getProductVisual(name = '') {
  const lower = name.toLowerCase();
  const match = CATEGORY_RULES.find(rule => rule.keys.some(k => lower.includes(k)));
  return match || DEFAULT_VISUAL;
}

function CustomerOrder() {
  // Theme (dark / light) — same storage key as the admin console's
  // App.jsx, so if both apps share an origin the customer's choice
  // carries over. Applied as a data-attribute on <html> so every
  // CSS var-driven surface in CustomerOrder.css picks it up.
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

  // Wizard step: 'details' -> 'shop' -> 'confirmed'
  const [step, setStep] = useState('details');

  // Customer details (same fields the cashier collects for a new customer)
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [fulfillment, setFulfillment] = useState('Delivery');
  const [detailErrors, setDetailErrors] = useState({});

  // Catalog
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');

  // Cart
  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);
  const [customerId, setCustomerId] = useState(null);

  const fetchProducts = () => {
    return axios.get(`${API_BASE}/products`)
      .then(res => {
        setProducts(res.data || []);
        setLoading(false);
      })
      .catch(() => {
        setLoadError('Could not load the product catalog. Please refresh or try again shortly.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.product_name.toLowerCase().includes(q));
  }, [products, search]);

  const cartQtyFor = (productId) => cart.find(i => i.product_id === productId)?.quantity || 0;

  const addToCart = (product) => {
    const currentQty = cartQtyFor(product.product_id);
    if (currentQty + 1 > product.stock_quantity) {
      Swal.fire('Out of stock', `Only ${product.stock_quantity} unit(s) of "${product.product_name}" available.`, 'warning');
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(i => i.product_id === product.product_id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, {
        product_id: product.product_id,
        product_name: product.product_name,
        unit_price: Number(product.unit_price),
        quantity: 1,
        stock_quantity: product.stock_quantity
      }];
    });
  };

  const changeQty = (productId, delta) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.product_id === productId);
      if (idx < 0) return prev;
      const item = prev[idx];
      const nextQty = item.quantity + delta;
      if (nextQty <= 0) return prev.filter(i => i.product_id !== productId);
      if (nextQty > item.stock_quantity) return prev;
      const next = [...prev];
      next[idx] = { ...item, quantity: nextQty };
      return next;
    });
  };

  const removeFromCart = (productId) => setCart(prev => prev.filter(i => i.product_id !== productId));

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const totalAmount = cart.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const handleDetailsSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!custName.trim()) errs.name = 'Please enter your full name.';
    if (!custPhone.trim()) errs.phone = 'Please enter a contact number.';
    if (fulfillment === 'Delivery' && !custAddress.trim()) errs.address = 'Please enter a delivery address.';
    setDetailErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setStep('shop');
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      Swal.fire('Your cart is empty', 'Add at least one item before checking out.', 'info');
      return;
    }
    setSubmitting(true);
    try {
      // 1. Register the customer only once per session — reuse the same
      // customer_id for any additional orders placed after the first.
      let activeCustomerId = customerId;
      if (!activeCustomerId) {
        const customerPayload = {
          name: custName,
          contact_number: custPhone,
          address: custAddress || 'Pickup at store',
          customer_type: 'Homeowner',
          credit_limit: 0.00,
          current_balance: 0.00,
          payment_terms_days: 0
        };
        const custRes = await axios.post(`${API_BASE}/customers`, customerPayload);
        activeCustomerId = custRes.data.customer_id;
        setCustomerId(activeCustomerId);
      }

      // 2. Decrement stock for each item, same as the in-store POS flow
      for (const item of cart) {
        const prodRef = products.find(p => p.product_id === item.product_id);
        if (!prodRef) continue;
        const newStock = prodRef.stock_quantity - item.quantity;
        await axios.put(`${API_BASE}/products/${item.product_id}`, {
          product_name: prodRef.product_name,
          unit_price: prodRef.unit_price,
          stock_quantity: newStock,
          reorder_level: prodRef.reorder_level,
          unit_measure: prodRef.unit_measure,
          barcode: prodRef.barcode
        });
      }

      // 3. Record the transaction
      const transactionPayload = {
        customer_id: activeCustomerId,
        total_amount: totalAmount,
        payment_method: `Online (${fulfillment})`,
        user_id: null,
        cashier_name: 'Online Storefront',
        items: cart.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price
        }))
      };
      const txRes = await axios.post(`${API_BASE}/transactions`, transactionPayload);
      const newTransactionId = txRes.data.transaction_id;

      // If the customer chose delivery, create a real deliveries record so
      // it shows up on the admin app's Delivery Dispatch board.
      if (fulfillment === 'Delivery') {
        try {
          await axios.post(`${API_BASE}/deliveries`, {
            order_id: newTransactionId,
            delivery_address: custAddress
          });
        } catch (deliveryErr) {
          // Don't block the order confirmation over this — the sale itself
          // already succeeded. Just let the customer know to expect a call.
          console.error(deliveryErr);
        }
      }

      setOrderResult({
        orderId: newTransactionId || '—',
        total: totalAmount,
        fulfillment,
        itemCount: totalItems
      });
      setStep('confirmed');

      // Refresh stock numbers so the catalog reflects this order immediately
      fetchProducts();
    } catch (err) {
      console.error(err);
      Swal.fire('Order failed', 'We could not submit your order. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const startNewOrder = () => {
    setCart([]);
    setOrderResult(null);
    // Keep custName/custPhone/custAddress and customerId as-is so repeat
    // orders in the same session don't force the customer to re-enter
    // their info or create a duplicate customer record.
    setStep('shop');
    fetchProducts();
  };

  return (
    <div className="shop-shell">
      <div className="shop-orbs">
        <div className="orb orb-copper"></div>
        <div className="orb orb-teal"></div>
      </div>

      <header className="shop-header glass">
        <div className="shop-brand">
          <div className="brand-mark">🛠️</div>
          <div>
            <h1>BuildRight</h1>
            <span>Order Online — Delivery &amp; Pickup</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="step-track">
            <div className={`step-dot ${step === 'details' ? 'active' : (step !== 'details' ? 'done' : '')}`}>1<span>Your Info</span></div>
            <div className="step-line"></div>
            <div className={`step-dot ${step === 'shop' ? 'active' : (step === 'confirmed' ? 'done' : '')}`}>2<span>Shop</span></div>
            <div className="step-line"></div>
            <div className={`step-dot ${step === 'confirmed' ? 'active' : ''}`}>3<span>Confirmed</span></div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label="Toggle dark or light mode"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <main className="shop-main">

        {/* STEP 1 — CUSTOMER DETAILS */}
        {step === 'details' && (
          <div className="details-wrap view-panel">
            <div className="glass glass-strong details-panel">
              <div className="details-form-col">
                <h2>Tell us where to send your order</h2>
                <p className="sub">We'll use this to confirm your order and, if needed, deliver it to you.</p>
                <form onSubmit={handleDetailsSubmit} className="form-stack">
                  <div>
                    <label className="field-label">Full Name *</label>
                    <input className="field" value={custName} onChange={e => setCustName(e.target.value)} placeholder="Juan Dela Cruz" />
                    {detailErrors.name && <p className="form-error">{detailErrors.name}</p>}
                  </div>
                  <div>
                    <label className="field-label">Contact Number *</label>
                    <input className="field" value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="09xx xxx xxxx" />
                    {detailErrors.phone && <p className="form-error">{detailErrors.phone}</p>}
                  </div>

                  <div>
                    <label className="field-label">Fulfillment</label>
                    <div className="type-toggle">
                      <button type="button" onClick={() => setFulfillment('Pickup')} className={`type-btn ${fulfillment === 'Pickup' ? 'active-takeout' : ''}`}>🛍️ Store Pickup</button>
                      <button type="button" onClick={() => setFulfillment('Delivery')} className={`type-btn ${fulfillment === 'Delivery' ? 'active-delivery' : ''}`}>🚚 Home Delivery</button>
                    </div>
                  </div>

                  {fulfillment === 'Delivery' && (
                    <div>
                      <label className="field-label">Delivery Address *</label>
                      <textarea className="field" style={{ height: '76px' }} value={custAddress} onChange={e => setCustAddress(e.target.value)} placeholder="House / Street, Barangay, City" />
                      {detailErrors.address && <p className="form-error">{detailErrors.address}</p>}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary">Continue to Shop →</button>
                </form>
              </div>

              <div className="details-visual">
                <svg className="details-visual-art" viewBox="0 0 500 600" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <linearGradient id="detailsBg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#45d6c4" />
                      <stop offset="55%" stopColor="#2f8f83" />
                      <stop offset="100%" stopColor="#1a2f3a" />
                    </linearGradient>
                    <linearGradient id="detailsGrid" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect width="500" height="600" fill="url(#detailsBg)" />
                  <circle cx="420" cy="90" r="150" fill="url(#detailsGrid)" />
                  <circle cx="60" cy="520" r="180" fill="url(#detailsGrid)" />
                  {/* Delivery truck */}
                  <g transform="translate(120,300)" fill="#ffffff" fillOpacity="0.92">
                    <rect x="0" y="0" width="130" height="70" rx="8" />
                    <path d="M130 20 h48 a10 10 0 0 1 9 5.5 l20 34 a10 10 0 0 1 1 4.5 v16 a6 6 0 0 1 -6 6 h-72 z" />
                    <circle cx="40" cy="92" r="18" fill="#1a2f3a" />
                    <circle cx="40" cy="92" r="7" fill="#ffffff" />
                    <circle cx="168" cy="92" r="18" fill="#1a2f3a" />
                    <circle cx="168" cy="92" r="7" fill="#ffffff" />
                  </g>
                  {/* Package box */}
                  <g transform="translate(300,190)" fill="#ffffff" fillOpacity="0.85">
                    <rect x="0" y="0" width="70" height="70" rx="6" />
                    <path d="M0 24 h70 M35 24 v46" stroke="#2f8f83" strokeWidth="4" fill="none" />
                  </g>
                  {/* Location pin */}
                  <g transform="translate(150,150)" fill="#ffffff" fillOpacity="0.8">
                    <path d="M0 0 a28 28 0 1 1 -0.1 0 z M-16 -2 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0" />
                    <path d="M0 26 l14 30 a2 2 0 0 1 -3.6 1.8 L0 45 l-10.4 12.8 A2 2 0 0 1 -14 56 z" />
                  </g>
                </svg>
                <div className="details-visual-caption">
                  <strong>Fast, easy ordering</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — CATALOG + CART */}
        {step === 'shop' && (
          <div className="shop-grid view-panel">
            <div className="catalog-col">
              <div className="catalog-toolbar glass">
                <input
                  className="field"
                  placeholder="Search products…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <button className="btn btn-ghost btn-sm" onClick={() => setStep('details')}>← Edit Info</button>
              </div>

              {loading && <div className="loading-row"><span className="spinner"></span>Loading products…</div>}
              {loadError && <p className="error-banner">{loadError}</p>}

              {!loading && !loadError && (
                <div className="product-grid">
                  {filteredProducts.length === 0 && (
                    <div className="empty-cart" style={{ gridColumn: '1 / -1' }}>No products match your search.</div>
                  )}
                  {filteredProducts.map((p, idx) => {
                    const visual = getProductVisual(p.product_name);
                    const inCart = cartQtyFor(p.product_id);
                    const outOfStock = p.stock_quantity === 0;
                    return (
                      <div className="product-card glass" key={p.product_id} style={{ '--i': idx }}>
                        <div className="product-tile" style={{ background: visual.gradient }}>
                          <span>{visual.icon}</span>
                          {p.stock_quantity <= p.reorder_level && p.stock_quantity > 0 && (
                            <span className="badge badge-warning tile-badge">Low stock</span>
                          )}
                          {outOfStock && <span className="badge badge-danger tile-badge">Out of stock</span>}
                        </div>
                        <div className="product-body">
                          <h3>{p.product_name}</h3>
                          <p className="product-meta">{p.unit_measure} · Stock: {p.stock_quantity}</p>
                          <div className="product-footer">
                            <span className="product-price">₱{Number(p.unit_price).toFixed(2)}</span>
                            {inCart === 0 ? (
                              <button className="btn btn-info btn-sm" disabled={outOfStock} onClick={() => addToCart(p)}>
                                {outOfStock ? 'Unavailable' : '+ Add'}
                              </button>
                            ) : (
                              <div className="qty-stepper">
                                <button onClick={() => changeQty(p.product_id, -1)}>−</button>
                                <span>{inCart}</span>
                                <button onClick={() => changeQty(p.product_id, 1)} disabled={inCart >= p.stock_quantity}>+</button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="cart-col">
              <div className="summary-card glass glass-strong">
                <h2>Your Order</h2>
                {cart.length === 0 ? (
                  <div className="empty-cart">Your cart is empty. Add items from the catalog.</div>
                ) : (
                  <div className="cart-list">
                    {cart.map(item => (
                      <div className="cart-row" key={item.product_id}>
                        <div>
                          <p className="cart-item-name">{item.product_name}</p>
                          <span className="cart-item-sub">{item.quantity} × ₱{item.unit_price.toFixed(2)}</span>
                        </div>
                        <div className="cart-row-right">
                          <span>₱{(item.unit_price * item.quantity).toFixed(2)}</span>
                          <button className="btn btn-danger btn-xs" onClick={() => removeFromCart(item.product_id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <hr className="divider" />
                <div className="summary-rows">
                  <div className="summary-line"><span>Fulfillment:</span><strong style={{ color: fulfillment === 'Delivery' ? 'var(--success)' : 'var(--copper)' }}>{fulfillment}</strong></div>
                  <div className="summary-line"><span>Items:</span><strong>{totalItems}</strong></div>
                  <div className="total-line"><span>Total:</span><span>₱{totalAmount.toFixed(2)}</span></div>
                </div>

                <button className="btn btn-primary" style={{ marginTop: '16px' }} disabled={submitting || cart.length === 0} onClick={handlePlaceOrder}>
                  {submitting ? 'Placing Order…' : 'Place Order'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — CONFIRMATION */}
        {step === 'confirmed' && orderResult && (
          <div className="confirm-wrap view-panel">
            <div className="glass confirm-card">
              <div className="confirm-icon">✅</div>
              <h2>Order Placed!</h2>
              <p className="sub">Thanks, {custName.split(' ')[0] || 'friend'} — your order has been received.</p>
              <div className="confirm-details">
                <div><span>Order #</span><strong>{orderResult.orderId}</strong></div>
                <div><span>Fulfillment</span><strong>{orderResult.fulfillment}</strong></div>
                <div><span>Items</span><strong>{orderResult.itemCount}</strong></div>
                <div><span>Total</span><strong className="highlight">₱{orderResult.total.toFixed(2)}</strong></div>
              </div>
              <button className="btn btn-primary" onClick={startNewOrder}>Place Another Order</button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default CustomerOrder;