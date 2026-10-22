# BuildRight — Customer Order Page (standalone)

A separate, public-facing web app for customers to place orders online.
Not part of the admin/cashier app — it's its own Vite project with its
own entry point, so you can deploy it on a different subdomain/port
(e.g. `order.buildright.com` or `localhost:5174`) while the staff app
stays internal.

## What it does

1. **Your Info** — collects name, phone, and (if delivery) address —
   the same fields the cashier fills in for "Add New Customer".
2. **Shop** — a searchable product grid. Since products don't have a
   photo field yet, each item gets an auto-generated icon + color tile
   based on keywords in its name (hammer → 🔨, paint → 🎨, pipe → 🚰,
   wood → 🪵, etc.), with a generic 📦 fallback. Swap `getProductVisual()`
   in `CustomerOrder.jsx` for real photos later — just point it at an
   `image_url` field once your backend/catalog has one.
3. **Confirmation** — order number, totals, and a "place another order"
   reset.

Submitting an order reuses your existing backend exactly the way the
cashier POS does: `POST /api/customers` to register the buyer, `PUT
/api/products/:id` to decrement stock per item, then `POST
/api/transactions` to record the sale (tagged `Online (Delivery)` /
`Online (Pickup)` and `cashier_name: "Online Storefront"` so it's easy
to tell apart from in-store sales in your Reports and Transactions
tabs).

## Setup

```bash
npm create vite@latest customer-order -- --template react
# then replace the generated src/ and index.html with the files here
cd customer-order
npm install axios sweetalert2
npm run dev
```

Or drop `index.html`, `src/main.jsx`, `src/CustomerOrder.jsx`, and
`src/CustomerOrder.css` straight into an existing Vite React project.

## Before going live

- **CORS**: your backend at `http://localhost:5000` needs to allow
  requests from whatever origin this storefront runs on.
- **API base URL**: update the `API_BASE` constant at the top of
  `CustomerOrder.jsx` for staging/production.
- **Auth-free by design**: this page has no PIN/login (customers
  aren't staff), so make sure your backend's `/api/customers`,
  `/api/products`, and `/api/transactions` endpoints are safe to call
  from a public, unauthenticated origin — add rate limiting or a
  lightweight order-confirmation step if that's a concern.