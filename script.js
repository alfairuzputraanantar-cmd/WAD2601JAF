// ============================================================
// FIREBASE CONFIG & INIT
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyCIYc8Epfu3jmrewyRaVGc4ISm7qKxG03k",
  authDomain: "localluxury-cb0d7.firebaseapp.com",
  projectId: "localluxury-cb0d7",
  storageBucket: "localluxury-cb0d7.firebasestorage.app",
  messagingSenderId: "425958954222",
  appId: "1:425958954222:web:0bfcdedbfbac2697a40fff",
  measurementId: "G-DHC0N06PZB"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ============================================================
// SESSION ID — unique per browser tab so buyer/seller
// messages can be distinguished in the same collection
// ============================================================
const SESSION_ID = localStorage.getItem("buyerSessionId") || (() => {
  const id = "buyer_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
  localStorage.setItem("buyerSessionId", id);
  return id;
})();

// ============================================================
// MESSAGE COLLECTION REF — must match what Seller uses
// ============================================================
const messagesRef = db.collection("chats/session_01/messages");

// ============================================================
// RENDERED MESSAGE TRACKING — prevent duplicate renders
// ============================================================
const renderedIds = new Set();

// ============================================================
// HELPER: format timestamp
// ============================================================
function formatTime(ts) {
  const d = ts ? ts.toDate() : new Date();
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ============================================================
// SEND A TEXT MESSAGE (BUYER → FIREBASE)
// ============================================================
async function sendMessage() {
  const input = document.getElementById("user-input");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  input.disabled = true;

  try {
    await messagesRef.add({
      text,
      sender: "buyer",
      sessionId: SESSION_ID,
      type: "text",
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error("Failed to send message:", err);
    // Restore input on error
    input.value = text;
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ============================================================
// RENDER: plain text bubble
// ============================================================
function renderTextBubble(msg, isBuyer) {
  const chatWindow = document.getElementById("chat-window");
  const row = document.createElement("div");
  row.className = `chat-msg-row ${isBuyer ? "chat-msg-row--buyer" : "chat-msg-row--seller"}`;

  const ts = formatTime(msg.timestamp);

  if (isBuyer) {
    row.innerHTML = `
      <div class="chat-bubble chat-bubble--buyer">
        <span>${escapeHtml(msg.text)}</span>
        <span class="chat-ts">${ts}</span>
      </div>`;
  } else {
    row.innerHTML = `
      <div class="chat-bubble chat-bubble--seller">
        <span class="chat-sender-label">🛒 Seller</span>
        <span>${escapeHtml(msg.text)}</span>
        <span class="chat-ts" style="color:rgba(255,255,255,0.3)">${ts}</span>
      </div>`;
  }

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// ============================================================
// RENDER: interactive product card (from Seller)
// stock constraints + Add-to-Cart
// ============================================================
function renderProductCard(msg) {
  const chatWindow = document.getElementById("chat-window");

  // Seller pushes product fields FLAT on the doc root (not nested in msg.product)
  // Fields: name, price, info (description), stock, productId, tags
  const name  = msg.name  || "Item";
  const price = typeof msg.price === "number" ? msg.price : 0;
  const info  = msg.info  || "";          // seller uses 'info' for description
  const stock = typeof msg.stock === "number" ? msg.stock : 99;
  const outOfStock = stock <= 0;
  const ts = formatTime(msg.timestamp);

  // Unique ID per card for DOM targeting
  const cardId = "card_" + (msg.id || Date.now() + Math.random()).toString().replace(/\./g, "_");

  const row = document.createElement("div");
  row.className = "chat-msg-row chat-msg-row--seller";
  row.id = cardId + "_row";

  // Stock badge helper
  function stockBadgeHtml(s) {
    if (s <= 0) return `<span class="stock-badge stock-badge--oos">Out of Stock</span>`;
    if (s <= 5) return `<span class="stock-badge stock-badge--low">⚠️ Only <strong>${s}</strong> left!</span>`;
    return `<span class="stock-badge stock-badge--ok">✅ ${s} in stock</span>`;
  }

  const safeName  = escapeHtml(name);
  const safeInfo  = escapeHtml(info);

  row.innerHTML = `
    <div>
      <span class="seller-label" style="display:block;margin-bottom:6px;padding-left:4px;">📦 Product Recommendation</span>
      <div class="food-rec-card" style="position:relative;">

        <!-- Image area -->
        <div class="food-rec-img">
          <span style="font-size:40px;">🍽️</span>
          <span class="food-rec-seller-badge">SELLER PICK</span>
        </div>

        <!-- Info body -->
        <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;">

          <!-- Name & description -->
          <div>
            <p style="color:#D4AF37;font-weight:700;font-size:15px;margin-bottom:2px;">${safeName}</p>
            ${safeInfo ? `<p style="color:#9ca3af;font-size:12px;">${safeInfo}</p>` : ""}
          </div>

          <!-- Price -->
          <p style="color:#e5e7eb;font-size:14px;font-weight:600;">Rp ${price.toLocaleString("id-ID")}</p>

          <!-- Live stock badge -->
          <div id="${cardId}_stockBadge">${stockBadgeHtml(stock)}</div>

          <!-- Qty selector + Add to cart -->
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
            <div class="food-rec-qty">
              <button id="${cardId}_minus" onclick="changeQty('${cardId}',-1,${stock})"
                ${outOfStock ? 'disabled style="opacity:0.4"' : ""}>−</button>
              <span id="${cardId}_qty">1</span>
              <button id="${cardId}_plus" onclick="changeQty('${cardId}',1,${stock})"
                ${outOfStock || stock <= 1 ? 'disabled style="opacity:0.4"' : ""}>+</button>
            </div>
            <button class="food-rec-add"
                    id="${cardId}_addBtn"
                    onclick="addRecToCart('${cardId}','${safeName}',${price},${stock})"
                    ${outOfStock ? 'disabled style="opacity:0.4;cursor:not-allowed"' : ""}>
              ${outOfStock
                ? "Out of Stock"
                : `<svg style="width:13px;height:13px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg> Add to Cart`}
            </button>
          </div>

          <!-- Timestamp -->
          <span style="font-size:10px;color:rgba(255,255,255,0.25);align-self:flex-end;">${ts}</span>
        </div>
      </div>
    </div>`;

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  // Flash the live status dot
  const dot = document.querySelector("#db-status .w-2");
  if (dot) {
    dot.classList.add("pulse-flash");
    setTimeout(() => dot.classList.remove("pulse-flash"), 700);
  }
}

// ============================================================
// QTY SELECTOR LOGIC (called from inline onclick)
// ============================================================
function changeQty(cardId, delta, maxStock) {
  const qtyEl  = document.getElementById(cardId + "_qty");
  const minusEl = document.getElementById(cardId + "_minus");
  const plusEl  = document.getElementById(cardId + "_plus");
  if (!qtyEl) return;

  let qty = parseInt(qtyEl.textContent, 10) + delta;
  qty = Math.max(1, Math.min(maxStock, qty));
  qtyEl.textContent = qty;

  // Disable/enable +/- buttons at boundaries
  minusEl.disabled = qty <= 1;
  plusEl.disabled  = qty >= maxStock;
  if (plusEl.disabled)  plusEl.style.opacity = "0.4";
  else                  plusEl.style.opacity = "1";
  if (minusEl.disabled) minusEl.style.opacity = "0.4";
  else                  minusEl.style.opacity = "1";
}

// ============================================================
// ADD RECOMMENDED PRODUCT TO CART
// ============================================================
function addRecToCart(cardId, name, price, maxStock) {
  const qtyEl = document.getElementById(cardId + "_qty");
  const qty   = qtyEl ? parseInt(qtyEl.textContent, 10) : 1;

  if (qty < 1 || maxStock <= 0) return;

  // Add each unit as qty in cart (reuse existing addToCart logic)
  const productObj = {
    id: cardId,          // unique per card
    name,
    price,
    stock: maxStock
  };

  addToCartWithQty(productObj, qty);
}

// addToCartWithQty — extended version of addToCart that accepts quantity
function addToCartWithQty(product, qty) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existing = cart.find(i => i.productId === product.id);

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: qty
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
  animateCart();
  showCartNotification(`${qty}× ${product.name}`);
}

// ============================================================
// FIREBASE REAL-TIME LISTENER — onSnapshot
// ============================================================
function startChatListener() {
  messagesRef
    .orderBy("timestamp", "asc")
    .onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type !== "added") return;

        const docId = change.doc.id;
        if (renderedIds.has(docId)) return;
        renderedIds.add(docId);

        const msg   = { id: docId, ...change.doc.data() };
        const isBuyer = msg.sender === "buyer";

        if (msg.type === "product" && !isBuyer) {
          // Seller pushed a product recommendation → render card
          renderProductCard(msg);
        } else {
          // Plain text from either side
          renderTextBubble(msg, isBuyer);
        }
      });
    }, err => {
      console.error("Chat listener error:", err);
    });
}

// ============================================================
// ESCAPE HTML (XSS-safe rendering)
// ============================================================
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
// CART LOGIC
// ============================================================
function addToCart(product) {
  addToCartWithQty(product, 1);
}

function showCartNotification(text) {
  const notification = document.getElementById("cart-notification");
  const notificationText = document.getElementById("notification-text");

  if (window.notificationTimeout) clearTimeout(window.notificationTimeout);

  notificationText.textContent = `${text} added to cart!`;
  notification.classList.remove("show");
  void notification.offsetWidth; // force reflow
  notification.classList.add("show");

  window.notificationTimeout = setTimeout(() => {
    notification.classList.remove("show");
  }, 3000);
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const total = cart.reduce((s, i) => s + i.quantity, 0);
  const el = document.getElementById("cart-count");
  if (el) {
    el.textContent = total;
    el.style.display = total > 0 ? "flex" : "none";
  }
}

function toggleCart() {
  const sidebar = document.getElementById("cart-sidebar");
  const overlay = document.getElementById("cart-overlay");
  if (!sidebar || !overlay) return;

  if (sidebar.classList.contains("cart-sidebar-hidden")) {
    sidebar.classList.replace("cart-sidebar-hidden", "cart-sidebar-visible");
    overlay.classList.remove("hidden");
    renderCart();
  } else {
    sidebar.classList.replace("cart-sidebar-visible", "cart-sidebar-hidden");
    overlay.classList.add("hidden");
  }
}

function animateCart() {
  const icon = document.getElementById("cartIcon");
  if (!icon) return;
  icon.classList.add("pulse");
  setTimeout(() => icon.classList.remove("pulse"), 400);
}

function renderCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const container = document.getElementById("cart-items");
  const totalEl   = document.getElementById("cart-total");
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-400 py-8">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <p>Your cart is empty</p>
      </div>`;
    totalEl.textContent = "Rp 0";
    return;
  }

  let total = 0;
  container.innerHTML = "";
  cart.forEach(item => {
    const sub = item.price * item.quantity;
    total += sub;
    container.innerHTML += `
      <div class="glass-morphism p-4 rounded-xl">
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <p class="gold-text font-semibold">${escapeHtml(item.name)}</p>
            <p class="text-sm text-gray-400">Rp ${item.price.toLocaleString("id-ID")} each</p>
          </div>
          <button onclick="removeFromCart('${item.productId}')" class="text-red-400 hover:text-red-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button onclick="updateQuantity('${item.productId}',-1)"
              class="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center">−</button>
            <span class="w-8 text-center">${item.quantity}</span>
            <button onclick="updateQuantity('${item.productId}',1)"
              class="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center">+</button>
          </div>
          <p class="gold-text font-semibold">Rp ${sub.toLocaleString("id-ID")}</p>
        </div>
      </div>`;
  });

  totalEl.textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

function updateQuantity(id, change) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const item = cart.find(i => i.productId === id);
  if (!item) return;
  item.quantity += change;
  if (item.quantity <= 0) cart = cart.filter(i => i.productId !== id);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

function clearCart() {
  localStorage.removeItem("cart");
  updateCartCount();
  renderCart();
}

function removeFromCart(id) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart = cart.filter(i => i.productId !== id);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

// ============================================================
// CHECKOUT FUNCTIONS
// ============================================================
function openCheckout() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) { alert("Your cart is empty! Add some items first."); return; }
  renderCheckoutItems();
  calculateCheckoutTotals();
  loadSavedAddress();
  toggleCart();
  const modal = document.getElementById("checkout-modal");
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("show"), 10);
  document.body.style.overflow = "hidden";
}

function closeCheckout() {
  saveCurrentAddress();
  const modal = document.getElementById("checkout-modal");
  modal.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 300);
  document.body.style.overflow = "auto";
}

function saveCurrentAddress() {
  const data = {
    fullName:   document.getElementById("full-name").value,
    phone:      document.getElementById("phone").value,
    address:    document.getElementById("address").value,
    city:       document.getElementById("city").value,
    postalCode: document.getElementById("postal-code").value
  };
  if (data.fullName || data.phone || data.address) {
    localStorage.setItem("savedAddress", JSON.stringify(data));
  }
}

function loadSavedAddress() {
  const raw = localStorage.getItem("savedAddress");
  if (!raw) return;
  const d = JSON.parse(raw);
  let hasData = false;
  if (d.fullName)   { document.getElementById("full-name").value = d.fullName; hasData = true; }
  if (d.phone)      { document.getElementById("phone").value = d.phone; hasData = true; }
  if (d.address)    { document.getElementById("address").value = d.address; hasData = true; }
  if (d.city)       { document.getElementById("city").value = d.city; hasData = true; }
  if (d.postalCode) { document.getElementById("postal-code").value = d.postalCode; hasData = true; }
  if (hasData) document.getElementById("address-saved-indicator")?.classList.remove("hidden");
}

function renderCheckoutItems() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const container = document.getElementById("checkout-items");
  container.innerHTML = "";
  cart.forEach(item => {
    const sub = item.price * item.quantity;
    container.innerHTML += `
      <div class="flex justify-between items-center p-3 bg-black/30 rounded-lg">
        <div class="flex-1">
          <p class="text-white font-semibold">${escapeHtml(item.name)}</p>
          <p class="text-sm text-gray-400">${item.quantity} × Rp ${item.price.toLocaleString("id-ID")}</p>
        </div>
        <p class="gold-text font-semibold">Rp ${sub.toLocaleString("id-ID")}</p>
      </div>`;
  });
}

function calculateCheckoutTotals() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const fee  = 10000;
  const tax  = Math.round(subtotal * 0.1);
  const total = subtotal + fee + tax;
  document.getElementById("checkout-subtotal").textContent = `Rp ${subtotal.toLocaleString("id-ID")}`;
  document.getElementById("checkout-tax").textContent      = `Rp ${tax.toLocaleString("id-ID")}`;
  document.getElementById("checkout-total").textContent    = `Rp ${total.toLocaleString("id-ID")}`;
}

function validateForm() {
  const f = ["full-name","phone","address","city","postal-code"].map(id => document.getElementById(id).value.trim());
  if (f.some(v => !v)) { alert("Please fill in all required fields."); return false; }
  if (f[1].length < 10) { alert("Please enter a valid phone number."); return false; }
  return true;
}

function processOrder() {
  if (!validateForm()) return;
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) { alert("Your cart is empty!"); return; }
  saveCurrentAddress();

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const fee = 10000;
  const tax = Math.round(subtotal * 0.1);
  const orderData = {
    fullName:      document.getElementById("full-name").value,
    phone:         document.getElementById("phone").value,
    address:       document.getElementById("address").value,
    city:          document.getElementById("city").value,
    postalCode:    document.getElementById("postal-code").value,
    paymentMethod: document.querySelector("input[name='payment']:checked").value,
    items: cart,
    subtotal, deliveryFee: fee, tax,
    total: subtotal + fee + tax,
    orderDate: new Date().toISOString(),
    orderId: "ORD" + Date.now()
  };

  // Write order to Firebase
  db.collection("orders").add(orderData).catch(e => console.warn("Order write failed:", e));

  // Save to local history
  const history = JSON.parse(localStorage.getItem("orderHistory")) || [];
  history.unshift(orderData);
  localStorage.setItem("orderHistory", JSON.stringify(history));

  showLoading();
  setTimeout(() => {
    hideLoading();
    showSuccess(orderData);
    clearCart();
    closeCheckout();
  }, 2500);
}

function showLoading() {
  const el = document.getElementById("loading-overlay");
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("show"), 10);
}

function hideLoading() {
  const el = document.getElementById("loading-overlay");
  el.classList.remove("show");
  setTimeout(() => el.classList.add("hidden"), 300);
}

function showSuccess(orderData) {
  const modal  = document.getElementById("success-modal");
  const detail = document.getElementById("order-details");
  detail.innerHTML = `
    <div class="space-y-2">
      <p class="text-sm"><strong>Order ID:</strong> ${orderData.orderId}</p>
      <p class="text-sm"><strong>Name:</strong> ${escapeHtml(orderData.fullName)}</p>
      <p class="text-sm"><strong>Phone:</strong> ${escapeHtml(orderData.phone)}</p>
      <p class="text-sm"><strong>Address:</strong> ${escapeHtml(orderData.address)}, ${escapeHtml(orderData.city)}</p>
      <p class="text-sm"><strong>Payment:</strong> ${orderData.paymentMethod}</p>
      <p class="text-sm"><strong>Total:</strong> <span class="gold-text">Rp ${orderData.total.toLocaleString("id-ID")}</span></p>
    </div>`;
  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("show"), 10);
  document.body.style.overflow = "hidden";
}

function closeSuccess() {
  const modal = document.getElementById("success-modal");
  modal.classList.remove("show");
  setTimeout(() => modal.classList.add("hidden"), 300);
  document.body.style.overflow = "auto";
  document.getElementById("address-form").reset();
}

// ============================================================
// ORDER HISTORY MODAL
// ============================================================
function showOrderHistory() {
  const history = JSON.parse(localStorage.getItem("orderHistory")) || [];
  const body    = document.getElementById("history-modal-body");
  const modal   = document.getElementById("history-modal");

  if (!body || !modal) return;

  if (history.length === 0) {
    body.innerHTML = `<p class="text-gray-400 text-center py-8">No orders yet.</p>`;
  } else {
    body.innerHTML = history.map(o => `
      <div class="glass-morphism rounded-xl p-4 space-y-1">
        <p class="text-xs text-gray-400">${new Date(o.orderDate).toLocaleString("id-ID")}</p>
        <p class="gold-text font-bold text-sm">${o.orderId}</p>
        <p class="text-gray-300 text-sm">${o.items.map(i => `${i.quantity}× ${escapeHtml(i.name)}`).join(", ")}</p>
        <p class="text-white font-semibold">Rp ${o.total.toLocaleString("id-ID")}</p>
        <span class="inline-block text-xs px-2 py-0.5 rounded-full" style="background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3)">Completed</span>
      </div>`).join("");
  }

  modal.classList.remove("hidden");
  setTimeout(() => modal.classList.add("flex"), 10);
}

function closeHistoryModal() {
  const modal = document.getElementById("history-modal");
  modal.classList.remove("flex");
  setTimeout(() => modal.classList.add("hidden"), 300);
}

// ============================================================
// MAP (checkout)
// ============================================================
let checkoutMap = null;
let checkoutMarker = null;

function initCheckoutMap() {
  const container = document.getElementById("checkout-map-container");
  const btn       = document.getElementById("pin-location-btn");
  container.style.display = "block";
  if (btn) btn.style.display = "none";

  if (checkoutMap) { checkoutMap.invalidateSize(); return; }

  checkoutMap = L.map("checkout-map").setView([-6.2088, 106.8456], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(checkoutMap);

  checkoutMarker = L.marker([-6.2088, 106.8456], { draggable: true }).addTo(checkoutMap);
  checkoutMarker.on("dragend", e => {
    const { lat, lng } = e.target.getLatLng();
    document.getElementById("map-coords").textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  });

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      checkoutMap.setView([lat, lng], 15);
      checkoutMarker.setLatLng([lat, lng]);
      document.getElementById("map-coords").textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    });
  }
}

// ============================================================
// DOM READY — wire up all event listeners & start listener
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const sendBtn       = document.getElementById("send-btn");
  const input         = document.getElementById("user-input");
  const cartBtn       = document.getElementById("cart-btn");
  const closeCartBtn  = document.getElementById("close-cart");
  const clearCartBtn  = document.getElementById("clear-cart-btn");
  const checkoutBtn   = document.getElementById("checkout-btn");
  const cartOverlay   = document.getElementById("cart-overlay");
  const closeCheckout = document.getElementById("close-checkout");
  const placeOrder    = document.getElementById("place-order-btn");
  const closeSuccess  = document.getElementById("close-success");

  sendBtn?.addEventListener("click", sendMessage);
  input?.addEventListener("keypress", e => { if (e.key === "Enter") sendMessage(); });
  cartBtn?.addEventListener("click", toggleCart);
  closeCartBtn?.addEventListener("click", toggleCart);
  cartOverlay?.addEventListener("click", toggleCart);
  clearCartBtn?.addEventListener("click", clearCart);
  checkoutBtn?.addEventListener("click", openCheckout);
  closeCheckout?.addEventListener("click", closeCheckout);
  placeOrder?.addEventListener("click", processOrder);
  closeSuccess?.addEventListener("click", closeSuccess);

  // Init cart display
  updateCartCount();

  // Start real-time Firebase chat listener
  startChatListener();
});
