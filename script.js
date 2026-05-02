// ============================================================
// SUPABASE CONFIG & INIT
// ============================================================
const SUPABASE_URL = "https://bnqhrwccxzjrnmxyzbvc.supabase.co";
const SUPABASE_KEY = "sb_publishable_aQgx6XXGRxZElZI_3FYGgg_3HMtn8TD";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// CONVERSATION IDENTITY
// Each buyer gets ONE conversation_id stored in localStorage + cookie.
// ============================================================
let CONVERSATION_ID = null;  // set by getOrCreateConversation()
let BUYER_NAME = null;       // set after name prompt

/** Read cookie by name */
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

/** Write a cookie (expires in 30 days) */
function setCookie(name, value, days = 30) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

/**
 * getOrCreateConversation(buyerName)
 * - Checks localStorage + cookie for an existing conversation_id.
 * - If found, uses it (buyer is returning — skip Supabase insert).
 * - If not found, creates a new row in "conversations" and stores the UUID.
 */
async function getOrCreateConversation(buyerName) {
  // Try localStorage first, then cookie as fallback
  let convId = localStorage.getItem('conversation_id') || getCookie('conversation_id');

  if (convId) {
    // Returning buyer — just resume the existing conversation
    CONVERSATION_ID = convId;
    BUYER_NAME = localStorage.getItem('buyer_name') || buyerName || getCookie('buyer_name') || 'Guest';
    console.log('[Buyer] Resuming conversation:', CONVERSATION_ID);
    return convId;
  }

  // New buyer — create a fresh conversation row in Supabase
  const name = (buyerName || 'Guest').trim();
  try {
    const { data, error } = await supabaseClient
      .from('conversations')
      .insert([{ buyer_name: name }])
      .select('id')
      .single();

    if (error) throw error;

    CONVERSATION_ID = data.id;
    BUYER_NAME = name;

    // Persist in both localStorage and cookie
    localStorage.setItem('conversation_id', data.id);
    localStorage.setItem('buyer_name', name);
    setCookie('conversation_id', data.id);
    setCookie('buyer_name', name);

    console.log('[Buyer] New conversation created:', CONVERSATION_ID, 'for', BUYER_NAME);
    return data.id;
  } catch (err) {
    console.error('[Buyer] Failed to create conversation:', err);
    return null;
  }
}

console.log("[Buyer] Connected to Supabase");


// ============================================================
// RENDERED MESSAGE TRACKING — prevent duplicate renders
// ============================================================
const renderedIds = new Set();

// ============================================================
// GLOBAL ORDER LISTENER TRACKING
// ============================================================
let activeOrderId = null;
let globalOrderUnsub = null;
let previousStatus = null;

// ============================================================
// HELPER: format timestamp
// ============================================================
function formatTime(ts) {
  let d;
  if (!ts) d = new Date();
  else if (ts.toDate) d = ts.toDate(); // legacy Firestore timestamp guard (should not occur)
  else d = new Date(ts); // Supabase ISO string
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

// ============================================================
// SEND A TEXT MESSAGE (BUYER → SUPABASE)
// ============================================================
async function sendMessage() {
  const input = document.getElementById("user-input");
  const rawText = input.value;
  input.value = ""; // Clear immediately after reading

  const text = rawText.replace(/\n/g, " ").trim();
  if (!text) return;
  if (!CONVERSATION_ID) { console.warn('[Buyer] No conversation yet — cannot send.'); return; }

  input.disabled = true;
  // Clear typing indicator immediately on send
  localStorage.setItem("buyer_typing", "0");

  try {
    const { error } = await supabaseClient.from('messages').insert([{
      text,
      sender: "buyer",
      conversation_id: CONVERSATION_ID,
      session_id: "session_01",   // kept for backward-compat schema column
      type: "text"
      // created_at defaults to now() in Postgres
    }]);

    if (error) throw error;
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

  // Tag the row with the Supabase row ID for removal on 'deleted' events
  if (msg.id) row.id = "msg_" + msg.id;

  const ts = formatTime(msg.created_at || msg.timestamp);

  if (isBuyer) {
    // Buyer bubble — gold, right-aligned, with hover-reveal ✕ delete button
    row.innerHTML = `
      <div style="display:flex;align-items:flex-end;justify-content:flex-end;gap:6px;">
        <button class="msg-delete-btn"
                onclick="deleteMessage('${msg.id}')"
                title="Delete this message"
                style="opacity:0;width:22px;height:22px;flex-shrink:0;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:50%;color:#ef4444;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity 0.2s,background 0.2s;margin-bottom:4px;">
          ✕
        </button>
        <div class="chat-bubble chat-bubble--buyer">
          <span>${escapeHtml(msg.text)}</span>
          <span class="chat-ts">${ts}</span>
        </div>
      </div>`;

    // Show delete button on hover of the row
    row.addEventListener("mouseenter", () => {
      const btn = row.querySelector(".msg-delete-btn");
      if (btn) btn.style.opacity = "1";
    });
    row.addEventListener("mouseleave", () => {
      const btn = row.querySelector(".msg-delete-btn");
      if (btn) btn.style.opacity = "0";
    });
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
  updateMsgCount(1);
}

// ============================================================
// RENDER: system notification banner (sender === "system")
// Used for "🛒 NEW ORDER PLACED!" announcements
// ============================================================
function renderSystemNotification(msg) {
  const chatWindow = document.getElementById("chat-window");
  const row = document.createElement("div");
  row.className = "chat-msg-row";
  if (msg.id) row.id = "msg_" + msg.id;

  const ts = formatTime(msg.created_at || msg.timestamp);
  row.innerHTML = `
    <div style="
      width:100%;
      background: linear-gradient(135deg,rgba(212,175,55,0.18),rgba(212,175,55,0.06));
      border:1px solid rgba(212,175,55,0.45);
      border-radius:10px;
      padding:10px 14px;
      display:flex;
      flex-direction:column;
      gap:3px;
      margin: 4px 0;
    ">
      <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#D4AF37;text-transform:uppercase;">⚡ System Notification</span>
      <span style="color:#f0e0a0;font-size:13px;font-weight:500;">${escapeHtml(msg.text)}</span>
      <span style="font-size:10px;color:rgba(255,255,255,0.3);align-self:flex-end;">${ts}</span>
    </div>`;

  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  updateMsgCount(1);
}

// ============================================================
// RENDER: interactive product card (from Seller)
// stock constraints + Add-to-Cart
// ============================================================
function renderProductCard(msg) {
  const chatWindow = document.getElementById("chat-window");


  // Seller pushes product fields FLAT on the doc root (not nested in msg.product)
  // Fields: name, price, info (description), stock, productId, tags
  const name = msg.name || "Item";
  const price = typeof msg.price === "number" ? msg.price : 0;
  const info = msg.info || "";          // seller uses 'info' for description
  const stock = typeof msg.stock === "number" ? msg.stock : 99;
  const productId = msg.productId || "";  // NEEDED for order decrement logic
  const outOfStock = stock <= 0;
  const ts = formatTime(msg.created_at || msg.timestamp);

  // Unique ID per card for DOM targeting
  const cardId = "card_" + (msg.id || Date.now() + Math.random()).toString().replace(/\./g, "_");

  const row = document.createElement("div");
  row.className = "chat-msg-row chat-msg-row--seller";
  // Use msg_ prefix so the 'removed' onSnapshot handler can find and remove it
  row.id = msg.id ? "msg_" + msg.id : cardId + "_row";

  // Stock badge helper
  function stockBadgeHtml(s) {
    if (s <= 0) return `<span class="stock-badge stock-badge--oos">Out of Stock</span>`;
    if (s <= 5) return `<span class="stock-badge stock-badge--low">⚠️ Only <strong>${s}</strong> left!</span>`;
    return `<span class="stock-badge stock-badge--ok">✅ ${s} in stock</span>`;
  }

  const safeName = escapeHtml(name);
  const safeInfo = escapeHtml(info);

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
                    onclick="addRecToCart('${cardId}','${safeName}',${price},${stock},'${productId}')"
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
  updateMsgCount(1);

  // ── Live Stock Supabase Listener ────────────────
  if (productId && !productId.startsWith("card_")) {
    const applyStock = (liveStock) => {
      const isOos = liveStock <= 0;

      // 1. Stock badge
      const badgeEl = document.getElementById(cardId + "_stockBadge");
      if (badgeEl) badgeEl.innerHTML = stockBadgeHtml(liveStock);

      // 2. Add-to-Cart button
      const addBtn = document.getElementById(cardId + "_addBtn");
      if (addBtn) {
        addBtn.disabled = isOos;
        addBtn.style.opacity = isOos ? "0.4" : "1";
        addBtn.style.cursor = isOos ? "not-allowed" : "pointer";
        addBtn.setAttribute("onclick",
          isOos ? "" : `addRecToCart('${cardId}','${safeName}',${price},${liveStock},'${productId}')`);
        addBtn.innerHTML = isOos
          ? "Out of Stock"
          : `<svg style="width:13px;height:13px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg> Add to Cart`;
      }

      // 3. Quantity + button
      const plusEl = document.getElementById(cardId + "_plus");
      const qtyEl = document.getElementById(cardId + "_qty");
      if (plusEl) {
        const curQty = parseInt(qtyEl?.textContent || "1", 10);
        plusEl.disabled = isOos || curQty >= liveStock;
        plusEl.style.opacity = plusEl.disabled ? "0.4" : "1";
        plusEl.setAttribute("onclick", `changeQty('${cardId}',1,${liveStock})`);
      }

      // 4. Quantity - button
      const minusEl = document.getElementById(cardId + "_minus");
      if (minusEl) {
        minusEl.setAttribute("onclick", `changeQty('${cardId}',-1,${liveStock})`);
        if (isOos) { minusEl.disabled = true; minusEl.style.opacity = "0.4"; }
      }
      console.log(`[ProductCard] Live stock update — ${productId}: ${liveStock}`);
    };

    // Initial Fetch
    supabaseClient.from('products').select('stock').eq('id', productId).single().then(({ data }) => {
      if (data) applyStock(data.stock || 0);
    });

    // Realtime subscription
    supabaseClient.channel(`product_${productId}_${Date.now()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${productId}` }, payload => {
        applyStock(payload.new.stock || 0);
      })
      .subscribe();
  }

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
  const qtyEl = document.getElementById(cardId + "_qty");
  const minusEl = document.getElementById(cardId + "_minus");
  const plusEl = document.getElementById(cardId + "_plus");
  if (!qtyEl) return;

  let qty = parseInt(qtyEl.textContent, 10) + delta;
  qty = Math.max(1, Math.min(maxStock, qty));
  qtyEl.textContent = qty;

  // Disable/enable +/- buttons at boundaries
  minusEl.disabled = qty <= 1;
  plusEl.disabled = qty >= maxStock;
  if (plusEl.disabled) plusEl.style.opacity = "0.4";
  else plusEl.style.opacity = "1";
  if (minusEl.disabled) minusEl.style.opacity = "0.4";
  else minusEl.style.opacity = "1";
}

// ============================================================
// ADD RECOMMENDED PRODUCT TO CART
// ============================================================
function addRecToCart(cardId, name, price, maxStock, explicitProductId) {
  const qtyEl = document.getElementById(cardId + "_qty");
  const qty = qtyEl ? parseInt(qtyEl.textContent, 10) : 1;

  if (qty < 1 || maxStock <= 0) return;

  // Add each unit as qty in cart (reuse existing addToCart logic)
  const productObj = {
    id: explicitProductId || cardId, // Use real db ID if available, else fallback
    name,
    price,
    stock: maxStock
  };

  addToCartWithQty(productObj, qty);

  // ── Notify seller via localStorage cart event ──────────────
  try {
    const events = JSON.parse(localStorage.getItem("buyer_cart_events") || "[]");
    events.push({ productId: productObj.id, productName: name, price, qty, ts: Date.now() });
    localStorage.setItem("buyer_cart_events", JSON.stringify(events));
  } catch (e) { /* ignore */ }
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
// SUPABASE REAL-TIME LISTENER — Messages scoped to THIS buyer's conversation
// ============================================================
async function startChatListener() {
  if (!CONVERSATION_ID) {
    console.warn('[Buyer] startChatListener called before CONVERSATION_ID set — deferring.');
    return;
  }

  function renderIncomingMessage(msg) {
    if (renderedIds.has(msg.id)) return;
    renderedIds.add(msg.id);

    const isBuyer = msg.sender === "buyer";
    if (msg.sender === "system") {
      renderSystemNotification(msg);
    } else if (msg.type === "product" && !isBuyer) {
      renderProductCard(msg);
    } else {
      renderTextBubble(msg, isBuyer);
    }
  }

  // 1. Initial Fetch — only messages in this conversation
  const { data: existingDocs, error } = await supabaseClient
    .from('messages')
    .select('*')
    .eq('conversation_id', CONVERSATION_ID)
    .order('created_at', { ascending: true });

  if (error) {
    console.error("Chat fetch error:", error);
  } else if (existingDocs) {
    existingDocs.forEach(renderIncomingMessage);
  }

  // 2. Real-time Subscription — scoped to this conversation
  supabaseClient.channel(`conv_${CONVERSATION_ID}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${CONVERSATION_ID}`
    }, payload => {
      if (payload.eventType === 'DELETE') {
        const docId = payload.old.id;
        renderedIds.delete(docId);
        const el = document.getElementById("msg_" + docId);
        if (el) {
          el.style.transition = "opacity 0.25s, transform 0.25s";
          el.style.opacity = "0";
          el.style.transform = "scale(0.95)";
          setTimeout(() => el.remove(), 260);
        }
        updateMsgCount(-1);
      } else if (payload.eventType === 'INSERT') {
        renderIncomingMessage(payload.new);
      }
    })
    .subscribe();

  console.log('[Buyer] Chat listener active for conversation:', CONVERSATION_ID);
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
// MESSAGE COUNT BADGE
// ============================================================
let _msgCount = 0;
function updateMsgCount(delta) {
  _msgCount = Math.max(0, _msgCount + delta);
  const el = document.getElementById("chat-msg-count");
  if (el) el.textContent = _msgCount === 0
    ? "0 messages in session"
    : `${_msgCount} message${_msgCount === 1 ? "" : "s"} in session`;
}

// ============================================================
// DELETE SINGLE MESSAGE (Buyer only)
// Removes the Supabase row — the realtime channel 'DELETE' event
// cleans the UI automatically for both Buyer and Seller in real-time.
// ============================================================
async function deleteMessage(msgId) {
  if (!msgId) return;
  try {
    const { error } = await supabaseClient.from('messages').delete().eq('id', msgId);
    if (error) throw error;
  } catch (err) {
    console.error("deleteMessage failed:", err);
    showChatToast("Could not delete message.", "#ef4444");
  }
}

// ============================================================
// CLEAR ALL MESSAGES — batch-delete every msg in THIS conversation
// ============================================================
async function clearAllMessages() {
  if (!CONVERSATION_ID) return;
  if (!confirm("🗑️ Clear entire conversation?\n\nThis will remove ALL messages for both you and the Seller. This cannot be undone.")) return;

  const btn = document.getElementById("clear-chat-btn");
  if (btn) { btn.disabled = true; btn.style.opacity = "0.5"; }

  try {
    const { error } = await supabaseClient
      .from('messages')
      .delete()
      .eq('conversation_id', CONVERSATION_ID);
    if (error) throw error;

    _msgCount = 0;
    updateMsgCount(0);
    showChatToast("💬 Conversation cleared.", "#4ade80");
    
    // Only remove the message rows, keep the welcome bubble
    document.querySelectorAll('#chat-window .chat-msg-row').forEach(el => el.remove());
  } catch (err) {
    console.error("clearAllMessages failed:", err);
    showChatToast("Could not clear chat. Check console.", "#ef4444");
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
  }
}

// ============================================================
// INLINE TOAST (lightweight, no cart notification reuse)
// ============================================================
function showChatToast(text, color = "#D4AF37") {
  const existing = document.getElementById("chat-toast");
  if (existing) existing.remove();

  const t = document.createElement("div");
  t.id = "chat-toast";
  t.style.cssText = `
    position:fixed;bottom:100px;left:50%;transform:translateX(-50%) translateY(20px);
    background:#111;border:1px solid ${color}55;border-radius:10px;
    padding:10px 22px;color:${color};font-weight:600;font-size:13px;
    box-shadow:0 8px 30px rgba(0,0,0,0.6);z-index:9990;
    opacity:0;transition:all 0.3s ease;pointer-events:none;`;
  t.textContent = text;
  document.body.appendChild(t);

  requestAnimationFrame(() => {
    t.style.opacity = "1";
    t.style.transform = "translateX(-50%) translateY(0)";
  });
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(-50%) translateY(10px)";
    setTimeout(() => t.remove(), 300);
  }, 3000);
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
  const totalEl = document.getElementById("cart-total");
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
    fullName: document.getElementById("full-name").value,
    phone: document.getElementById("phone").value,
    address: document.getElementById("address").value,
    city: document.getElementById("city").value,
    district: document.getElementById("district").value
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
  if (d.fullName) { document.getElementById("full-name").value = d.fullName; hasData = true; }
  if (d.phone) { document.getElementById("phone").value = d.phone; hasData = true; }
  if (d.address) { document.getElementById("address").value = d.address; hasData = true; }
  if (d.city) { document.getElementById("city").value = d.city; hasData = true; }
  if (d.district) { document.getElementById("district").value = d.district; hasData = true; }
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
  const fee = 10000;
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + fee + tax;
  document.getElementById("checkout-subtotal").textContent = `Rp ${subtotal.toLocaleString("id-ID")}`;
  document.getElementById("checkout-tax").textContent = `Rp ${tax.toLocaleString("id-ID")}`;
  document.getElementById("checkout-total").textContent = `Rp ${total.toLocaleString("id-ID")}`;
}

function validateForm() {
  const f = ["full-name", "phone", "address", "city", "district"].map(id => document.getElementById(id).value.trim());
  if (f.some(v => !v)) { alert("Please fill in all required fields."); return false; }
  if (f[1].length < 10) { alert("Please enter a valid phone number."); return false; }
  return true;
}

// Holds the active onSnapshot unsubscribe fn for the live order status listener
// Removed: _orderStatusUnsub

async function processOrder() {
  if (!validateForm()) return;
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) { alert("Your cart is empty!"); return; }

  showLoading();
  saveCurrentAddress();

  try {
    // ── STEP 1: Stock Validation (pre-flight read) ──────────────────────
    for (const item of cart) {
      const pid = item.productId || item.id;
      if (!pid || pid.startsWith("card_")) continue;

      const { data: docSnap } = await supabaseClient.from("products").select("stock").eq("id", pid).single();
      if (docSnap) {
        const currentStock = typeof docSnap.stock === "number" ? docSnap.stock : 0;
        console.log(`[Stock check] ${item.name}: requested=${item.quantity}, available=${currentStock}`);
        if (item.quantity > currentStock) {
          hideLoading();
          alert(`⚠️ Not enough stock!\n"${item.name}" only has ${currentStock} left. Please update your cart.`);
          return;
        }
      }
    }

    // ── STEP 2: Build Order Data ────────────────────────────────────────
    const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const fee = 10000;
    const tax = Math.round(subtotal * 0.1);
    const grandTotal = subtotal + fee + tax;
    const fullName = document.getElementById("full-name").value.trim();
    const orderId = "ORD-" + Math.floor(1000 + Math.random() * 9000);

    const orderData = {
      orderId,
      items: cart,
      total: grandTotal,
      status: "new",
      fullName,
      address: document.getElementById("address").value,
      city: document.getElementById("city").value,
      district: document.getElementById("district").value,
      paymentMethod: document.querySelector("input[name='payment']:checked").value,
      orderDate: new Date().toISOString()
    };

    // ── STEP 3: Write Order ────────
    const { data: orderDataRes, error: orderErr } = await supabaseClient.from("orders").insert([orderData]).select("id").single();
    if (orderErr) throw orderErr;
    const orderRef = { id: orderDataRes.id };
    console.log("[Order] Written to Supabase:", orderRef.id);

    // ── STEP 3b: System notification → Seller Chat (scoped to THIS conversation) ──
    const totalUSD = (grandTotal / 15000).toFixed(2);
    await supabaseClient.from("messages").insert([{
      sender: "system",
      text: "🛒 NEW ORDER PLACED! Total: $" + totalUSD +
        " (Rp " + grandTotal.toLocaleString("id-ID") + ")" +
        " | Order: " + orderId +
        " | Buyer: " + fullName,
      conversation_id: CONVERSATION_ID,
      session_id: "session_01",
      type: "text"
    }]);

    // ── STEP 4: Decrement Stock (atomic server-side) ────────────────────
    for (const item of cart) {
      const pid = item.productId || item.id;

      if (pid && !pid.startsWith("card_")) {
        await supabaseClient.rpc('decrement_stock', { p_id: pid, p_qty: item.quantity });
        console.log(`[Stock] Decremented ${item.name} (${pid}) by ${item.quantity}`);

        // Fetch new stock purely for chat notification context
        const { data: updatedSnap } = await supabaseClient.from('products').select('stock').eq('id', pid).single();
        const newStock = updatedSnap ? (updatedSnap.stock ?? 0) : 0;

        supabaseClient.from('messages').insert([{
          sender: "buyer",
          text: `📦 Order #${orderId}: ${fullName} purchased ${item.quantity}× ${item.name}. New stock: ${newStock}.`,
          conversation_id: CONVERSATION_ID,
          session_id: "session_01",
          type: "text"
        }]);
      } else {
        // Custom / unlinked item — no stock to decrement
        console.warn(`[Stock] Skipping decrement for unlinked item: ${item.name}`);
        supabaseClient.from('messages').insert([{
          sender: "buyer",
          text: `📦 Order #${orderId}: ${fullName} purchased ${item.quantity}× ${item.name} (custom item — no stock linked).`,
          conversation_id: CONVERSATION_ID,
          session_id: "session_01",
          type: "text"
        }]);
      }
    }

    // ── STEP 5: Finalise UI ─────────────────────────────────────────────
    orderData.subtotal = subtotal;
    orderData.tax = tax;
    orderData.deliveryFee = fee;

    const history = JSON.parse(localStorage.getItem("orderHistory")) || [];
    history.unshift({ ...orderData, supabaseId: orderRef.id });
    localStorage.setItem("orderHistory", JSON.stringify(history));

    hideLoading();
    closeCheckout();
    clearCart();
    // Pass the live Supabase ID so the receipt can subscribe to status changes
    activeOrderId = orderRef.id;
    startGlobalOrderListener(orderRef.id);
    showSuccess(orderData, orderRef);

  } catch (error) {
    console.error("processOrder failed:", JSON.stringify(error, null, 2));
    hideLoading();
    alert("Checkout failed. Please check your connection and try again.\n\nDetails: " + (error.message || JSON.stringify(error)));
  }
}

function showLoading() {
  const el = document.getElementById("loading-overlay");
  if (!el) return;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("show"), 10);
}

function hideLoading() {
  const el = document.getElementById("loading-overlay");
  if (!el) return;
  el.classList.remove("show");
  setTimeout(() => el.classList.add("hidden"), 300);
}

// ── STATUS BADGE HELPERS ────────────────────────────────────────────────────
const STATUS_STYLES = {
  new: { bg: "#fef3c7", color: "#92400e", label: "🟡 New — Awaiting Seller" },
  preparing: { bg: "#dbeafe", color: "#1e40af", label: "🔵 Preparing Your Order" },
  ready: { bg: "#d1fae5", color: "#065f46", label: "🟢 Ready for Pickup" },
  delivering: { bg: "#ede9fe", color: "#5b21b6", label: "🟣 Out for Delivery" },
  delivered: { bg: "#d1fae5", color: "#065f46", label: "✅ Delivered!" },
  completed: { bg: "#d1fae5", color: "#065f46", label: "✅ Completed" },
  cancelled: { bg: "#fee2e2", color: "#991b1b", label: "❌ Cancelled" },
};

function statusBadgeHtml(status) {
  const s = STATUS_STYLES[String(status).toLowerCase()] ||
    { bg: "#f3f4f6", color: "#374151", label: "⏳ " + status };
  return `<span id="receipt-status-badge" style="
    display:inline-block;
    padding:4px 12px;
    border-radius:9999px;
    font-size:12px;
    font-weight:700;
    background:${s.bg};
    color:${s.color};
    letter-spacing:0.03em;
  ">${s.label}</span>`;
}

function showSuccess(orderData, orderRef) {
  const modal = document.getElementById("success-modal");
  if (!modal) return;

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  setTimeout(() => modal.classList.add("show"), 10);
  document.body.style.overflow = "hidden";

  // 1. Header details — includes live status badge
  const detailsEl = document.getElementById("receipt-details");
  if (detailsEl) {
    detailsEl.innerHTML = `
      <div class="flex justify-between">
        <span class="text-gray-500">Order ID:</span>
        <span class="font-semibold">${escapeHtml(orderData.orderId)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Date:</span>
        <span class="font-semibold">${new Date().toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Customer:</span>
        <span class="font-semibold">${escapeHtml(orderData.fullName)}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-500">Payment:</span>
        <span class="font-semibold capitalize">${escapeHtml(orderData.paymentMethod)}</span>
      </div>
      <div class="flex justify-between items-center" style="margin-top:8px;">
        <span class="text-gray-500">Status:</span>
        <div id="receipt-status-container">${statusBadgeHtml(orderData.status || "new")}</div>
      </div>
      <div class="mt-4 pt-4 border-t border-dashed border-gray-200">
        <p class="text-gray-500 mb-1">Delivery Address:</p>
        <p class="font-medium text-gray-800">${escapeHtml(orderData.address)}</p>
        <p class="text-gray-600 text-xs mt-1">District: <span class="font-semibold text-gray-800">${escapeHtml(orderData.district || "-")}</span></p>
        <p class="text-gray-600 text-xs">City: <span class="font-semibold text-gray-800">${escapeHtml(orderData.city || "-")}</span></p>
      </div>`;
  }

  // 2. Items list
  const itemsEl = document.getElementById("receipt-items-list");
  if (itemsEl) {
    itemsEl.innerHTML = orderData.items.map(item => `
      <div class="flex justify-between text-sm py-1">
        <div class="flex-1 pr-2">
          <p class="font-semibold">${escapeHtml(item.name)}</p>
          <p class="text-xs text-gray-500">${item.quantity} × Rp ${item.price.toLocaleString("id-ID")}</p>
        </div>
        <div class="font-semibold">Rp ${(item.price * item.quantity).toLocaleString("id-ID")}</div>
      </div>`).join("");
  }

  // 3. Totals breakdown
  const totalsEl = document.getElementById("receipt-totals");
  if (totalsEl) {
    totalsEl.innerHTML = `
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">Subtotal</span>
        <span>Rp ${orderData.subtotal.toLocaleString("id-ID")}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">Tax (10%)</span>
        <span>Rp ${orderData.tax.toLocaleString("id-ID")}</span>
      </div>
      <div class="flex justify-between text-sm">
        <span class="text-gray-600">Delivery Fee</span>
        <span>Rp ${orderData.deliveryFee.toLocaleString("id-ID")}</span>
      </div>
      <div class="flex justify-between text-lg font-bold mt-2 pt-2 border-t border-dashed border-gray-400">
        <span>TOTAL</span>
        <span>Rp ${orderData.total.toLocaleString("id-ID")}</span>
      </div>`;
  }

  // 4. Live Order Status listener ─────────────────────────────────────────
  // Note: Local listener removed. The global listener handles this now.
  // We simply rely on startGlobalOrderListener() to update the DOM via ID.
}

// ============================================================
// TOAST NOTIFICATION LOGIC
// ============================================================
let toastTimeout = null;
function showStatusToast(newStatus) {
  const toast = document.getElementById("status-toast");
  const msg = document.getElementById("toast-message");
  if (!toast || !msg) return;

  msg.innerText = `Update: Your order is now ${newStatus.toUpperCase()}!`;
  toast.classList.add("show");
  playNotificationSound();

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 4500);
}

function playNotificationSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) {
    console.warn("Audio error", e);
  }
}

function startGlobalOrderListener(orderId) {
  if (globalOrderUnsub) {
    supabaseClient.removeChannel(globalOrderUnsub);
    globalOrderUnsub = null;
  }

  if (!orderId) return;

  console.log("[Global Status] Starting listener on order:", orderId);
  previousStatus = null; // reset track for new order

  const channel = supabaseClient.channel(`order_${orderId}`);
  globalOrderUnsub = channel;

  channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, payload => {
    const newStatus = payload.new.status || "new";
    console.log("[Global Status] Update received:", newStatus);

    if (previousStatus && previousStatus !== newStatus) {
      showStatusToast(newStatus);
    }
    previousStatus = newStatus;

    const currentHistory = JSON.parse(localStorage.getItem("orderHistory")) || [];
    const idx = currentHistory.findIndex(x => x.supabaseId === orderId);
    if (idx !== -1 && currentHistory[idx].status !== newStatus) {
      currentHistory[idx].status = newStatus;
      localStorage.setItem("orderHistory", JSON.stringify(currentHistory));
    }

    const receiptContainer = document.getElementById("receipt-status-container");
    if (receiptContainer) {
      receiptContainer.innerHTML = statusBadgeHtml(newStatus);
      receiptContainer.style.transition = "opacity 0.2s";
      receiptContainer.style.opacity = "0";
      setTimeout(() => { receiptContainer.style.opacity = "1"; }, 200);
    }

    const historyContainer = document.getElementById(`history-status-${orderId}`);
    if (historyContainer && historyContainer.innerHTML !== statusBadgeHtml(newStatus)) {
      historyContainer.innerHTML = statusBadgeHtml(newStatus);
      historyContainer.style.transition = "opacity 0.2s";
      historyContainer.style.opacity = "0";
      setTimeout(() => { historyContainer.style.opacity = "1"; }, 200);
    }

    if (newStatus === "completed" || newStatus === "cancelled") {
      console.log("[Global Status] Order finished, stopping listener.");
      supabaseClient.removeChannel(channel);
      globalOrderUnsub = null;
      activeOrderId = null;
    }
  }).subscribe();
}

function closeSuccess() {
  // Unsubscribe the live status listener so we don't leak it
  // Now handled by the global listener.

  const modal = document.getElementById("success-modal");
  if (!modal) return;
  modal.classList.remove("show");
  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");
  }, 300);
  document.body.style.overflow = "auto";
  const form = document.getElementById("address-form");
  if (form) form.reset();
}

// Removed _historyUnsubs

function showOrderHistory() {
  const history = JSON.parse(localStorage.getItem("orderHistory")) || [];
  const body = document.getElementById("history-modal-body");
  const modal = document.getElementById("history-modal");
  const container = document.getElementById("history-container");

  if (!body || !modal) return;

  if (history.length === 0) {
    body.innerHTML = `<p class="text-gray-400 text-center py-8">No orders yet.</p>`;
  } else {
    body.innerHTML = history.map(o => `
      <div class="glass-morphism rounded-xl p-5 mb-4 space-y-3 relative overflow-hidden">
        <div class="flex justify-between items-start border-b border-gray-700 pb-2">
          <div>
            <p class="gold-text font-bold">${o.orderId}</p>
            <p class="text-xs text-gray-400 mt-1">${new Date(o.orderDate).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
          </div>
          <div id="history-status-${o.supabaseId}">${statusBadgeHtml(o.status || "new")}</div>
        </div>
        
        <div class="text-sm">
          <p class="text-gray-400 text-xs mb-1 uppercase tracking-wider">Delivery Details</p>
          <p class="text-white font-medium">${escapeHtml(o.address || "-")}</p>
          <p class="text-gray-300 text-xs mt-0.5">${escapeHtml(o.district || "-")} • ${escapeHtml(o.city || "-")}</p>
        </div>

        <div class="text-sm border-t border-gray-700 pt-2 mt-2">
          <p class="text-gray-400 text-xs mb-1 uppercase tracking-wider">Items</p>
          <ul class="space-y-1">
            ${o.items.map(i => `
              <li class="flex justify-between text-gray-300">
                <span>${i.quantity}× ${escapeHtml(i.name)}</span>
                <span>Rp ${(i.price * i.quantity).toLocaleString("id-ID")}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        <div class="flex justify-between items-center border-t border-dashed border-gray-600 pt-3 mt-3">
          <span class="font-bold text-gray-200">TOTAL</span>
          <span class="font-bold text-white text-lg">Rp ${o.total.toLocaleString("id-ID")}</span>
        </div>
      </div>`).join("");

    // Removed local _historyUnsubs loop here, letting the global listener handle DOM updates
  }

  modal.classList.remove("hidden");
  modal.classList.add("flex");
  void modal.offsetWidth; // trigger reflow
  modal.classList.remove("opacity-0");
  if (container) {
    container.classList.remove("translate-x-full");
    container.classList.add("translate-x-0");
  }
}

function closeHistoryModal() {
  const modal = document.getElementById("history-modal");
  const container = document.getElementById("history-container");

  if (container) {
    container.classList.remove("translate-x-0");
    container.classList.add("translate-x-full");
  }
  modal.classList.add("opacity-0");

  setTimeout(() => {
    modal.classList.remove("flex");
    modal.classList.add("hidden");

    // Unsubscribe when closed
    // Handled by global listener
  }, 300);
}

// ============================================================
// MAP (checkout)
// ============================================================
let checkoutMap = null;
let checkoutMarker = null;

// ── Reverse geocode a lat/lng via Nominatim ──────────────────
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    const res = await fetch(url, { headers: { "Accept-Language": "id,en" } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[Nominatim] Reverse geocode failed:", e);
    return null;
  }
}

// ── Autofill delivery form fields ────────
function autofillAddress(geo) {
  if (!geo || !geo.address) return;
  const a = geo.address;

  // Use street name or a shortened version of the display_name to avoid excessive length
  const addressLine = a.road || geo.display_name?.split(",").slice(0, 2).join(",").trim() || "";

  // Robust city fallback chain
  const cityStr = a.city || a.town || "Unknown City";

  // District logic (suburb or neighbourhood)
  const districtStr = a.suburb || a.neighbourhood || "";

  const addressEl = document.getElementById("address");
  const cityEl = document.getElementById("city");
  const districtEl = document.getElementById("district");

  // Forcefully autofill so dragging the pin always updates the form
  if (addressEl) addressEl.value = addressLine;
  if (cityEl) cityEl.value = cityStr;
  if (districtEl) districtEl.value = districtStr;

  // Show visual hint
  document.getElementById("address-saved-indicator")?.classList.remove("hidden");
  console.log("[Map] Address autofilled from Nominatim:", { addressLine, cityStr, districtStr });
}

function initCheckoutMap() {
  const container = document.getElementById("checkout-map-container");
  const btn = document.getElementById("pin-location-btn");
  container.style.display = "block";
  if (btn) btn.style.display = "none";

  if (checkoutMap) { checkoutMap.invalidateSize(); return; }

  // Geographic fallback
  checkoutMap = L.map("checkout-map").setView([-6.2088, 106.8456], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors"
  }).addTo(checkoutMap);

  checkoutMarker = L.marker([-6.2088, 106.8456], { draggable: true }).addTo(checkoutMap);

  // Drag → reverse geocode → autofill
  checkoutMarker.on("dragend", async e => {
    const { lat, lng } = e.target.getLatLng();
    document.getElementById("map-coords").textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const geo = await reverseGeocode(lat, lng);
    if (geo) autofillAddress(geo);
  });

  // Location found → move marker + autofill address
  checkoutMap.on("locationfound", async e => {
    const { lat, lng } = e.latlng;
    checkoutMarker.setLatLng([lat, lng]);
    document.getElementById("map-coords").textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const geo = await reverseGeocode(lat, lng);
    if (geo) autofillAddress(geo);
  });

  // Location error → stay on fallback
  checkoutMap.on("locationerror", e => {
    console.warn("[Map] Geolocation unavailable:", e.message);
  });

  // Start auto-locate automatically
  triggerMapLocate();
}

function triggerMapLocate() {
  if (checkoutMap) {
    document.getElementById("map-coords").textContent = "📍 Detecting location...";
    checkoutMap.locate({ setView: true, maxZoom: 16 });
  }
}

// ============================================================
// NAME PROMPT — shown on first visit
// ============================================================
function showNamePrompt() {
  const modal = document.getElementById('name-prompt-modal');
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('buyer-name-input')?.focus(), 100);
  }
}

async function startChatWithName() {
  const input = document.getElementById('buyer-name-input');
  const err   = document.getElementById('name-prompt-error');
  const btn   = document.getElementById('name-prompt-btn');
  const name  = input?.value.trim();

  if (!name) {
    if (err) err.style.display = 'block';
    input?.focus();
    return;
  }
  if (err) err.style.display = 'none';
  if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }

  await getOrCreateConversation(name);

  // Hide the modal
  const modal = document.getElementById('name-prompt-modal');
  if (modal) modal.style.display = 'none';

  // Now start the chat listener with the conversation scoped
  await startChatListener();
  console.log('[Buyer] Chat started for:', BUYER_NAME);
}

// ============================================================
// DOM READY — wire up all event listeners & start listener
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.getElementById("send-btn");
  const input = document.getElementById("user-input");
  const cartBtn = document.getElementById("cart-btn");
  const closeCartBtn = document.getElementById("close-cart");
  const clearCartBtn = document.getElementById("clear-cart-btn");
  const checkoutBtn = document.getElementById("checkout-btn");
  const cartOverlay = document.getElementById("cart-overlay");
  const closeCheckoutBtn = document.getElementById("close-checkout");
  const placeOrderBtn = document.getElementById("place-order-btn");
  const closeSuccessBtn = document.getElementById("close-success");

  sendBtn?.addEventListener("click", sendMessage);
  input?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  cartBtn?.addEventListener("click", toggleCart);
  closeCartBtn?.addEventListener("click", toggleCart);
  cartOverlay?.addEventListener("click", toggleCart);
  clearCartBtn?.addEventListener("click", clearCart);
  checkoutBtn?.addEventListener("click", openCheckout);
  closeCheckoutBtn?.addEventListener("click", closeCheckout);
  placeOrderBtn?.addEventListener("click", processOrder);
  closeSuccessBtn?.addEventListener("click", closeSuccess);

  // ── Auto-Resume Global Listener ──────
  const history = JSON.parse(localStorage.getItem("orderHistory")) || [];
  const activeOrder = history.find(o =>
    ["new", "pending", "processing", "ready", "delivering"].includes((o.status || "new").toLowerCase())
  );
  if (activeOrder && activeOrder.supabaseId) {
    console.log("[Global] Resuming listener for active order:", activeOrder.supabaseId);
    activeOrderId = activeOrder.supabaseId;
    startGlobalOrderListener(activeOrderId);
  }

  // ── Buyer typing indicator — signals the Seller panel ──────
  if (input) {
    let _typingTimeout = null;
    input.addEventListener("input", () => {
      localStorage.setItem("buyer_typing", "1");
      clearTimeout(_typingTimeout);
      _typingTimeout = setTimeout(() => localStorage.setItem("buyer_typing", "0"), 3000);
    });
    input.addEventListener("blur", () => {
      clearTimeout(_typingTimeout);
      localStorage.setItem("buyer_typing", "0");
    });
  }

  // Init cart display
  updateCartCount();

  // ── Conversation bootstrap ──────────────────────────────────
  // Check if buyer already has a conversation_id stored
  const existingConvId   = localStorage.getItem('conversation_id') || getCookie('conversation_id');
  const existingBuyerName = localStorage.getItem('buyer_name') || getCookie('buyer_name');

  if (existingConvId && existingBuyerName) {
    // Returning buyer — resume silently without showing the prompt
    CONVERSATION_ID = existingConvId;
    BUYER_NAME = existingBuyerName;
    console.log('[Buyer] Returning buyer, resuming conversation:', CONVERSATION_ID);
    startChatListener();
  } else {
    // New buyer — show the name prompt
    showNamePrompt();
  }
});
