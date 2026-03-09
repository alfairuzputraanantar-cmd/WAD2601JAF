const firebaseConfig = {
  apiKey: "AIzaSyCIYc8Epfu3jmrewyRaVGc4ISm7qKxG03k",
  authDomain: "localluxury-cb0d7.firebaseapp.com",
  projectId: "localluxury-cb0d7",
  storageBucket: "localluxury-cb0d7.firebasestorage.app",
  messagingSenderId: "425958954222",
  appId: "1:425958954222:web:0bfcdedbfbac2697a40fff",
  measurementId: "G-DHC0N06PZB"
};

let db = null;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (error) {
  console.warn("Firebase init failed:", error);
}

async function sendToOllama(message) {
  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context: getConversationContext() })
    });
    if (res.ok) return await res.json();
    throw new Error("Server error");
  } catch (e) {
    return getFallbackAIResponse(message);
  }
}

function getFallbackAIResponse(message) {
  const lower = message.toLowerCase().trim();
  const hour = new Date().getHours();
  if (/^(hi|hey|hello|halo|hai|good morning|good afternoon|good evening)[!.,\s]*$/.test(lower)) {
    if (hour < 12) return { reply: "Good morning, Your Majesty! What royal delicacy may I serve you today?", products: [] };
    if (hour < 17) return { reply: "Good afternoon, Your Majesty! Ready for a luxurious meal?", products: [] };
    return { reply: "Good evening, Your Majesty! What would please your royal palate tonight?", products: [] };
  }
  const nonFood = ['thank','thanks','thx','ok','okay','alright','cool','great','noted','bye','goodbye','sure','nice'];
  if (nonFood.some(w => lower === w || lower === w + '!' || lower === w + '.')) {
    return { reply: "Of course, Your Majesty! Let me know if there's anything else I can help with.", products: [] };
  }
  const localProducts = [
    { id:"l1", name:"Nasi Rendang Royal", price:25000, tags:["spicy","filling","popular"], description:"Traditional beef rendang with royal spices" },
    { id:"l2", name:"Martabak Sweetness", price:20000, tags:["sweet","dessert"], description:"Sweet Indonesian pancake with chocolate and cheese" },
    { id:"l3", name:"Sate Ayam Sultan", price:30000, tags:["luxury","popular"], description:"Grilled chicken skewers with peanut sauce" },
    { id:"l4", name:"Gado-Gado Premium", price:18000, tags:["healthy","vegetarian"], description:"Indonesian salad with peanut dressing" },
    { id:"l5", name:"Bakso Urat Special", price:22000, tags:["spicy","filling"], description:"Beef meatball soup with noodles" },
    { id:"l6", name:"Es Teler Deluxe", price:15000, tags:["sweet","dessert","cold"], description:"Mixed tropical fruit cocktail with coconut milk" },
    { id:"l7", name:"Ayam Bakar Madu", price:28000, tags:["luxury","sweet"], description:"Honey-glazed grilled chicken" },
    { id:"l8", name:"Mie Goreng Special", price:16000, tags:["quick","filling"], description:"Stir-fried noodles with vegetables and egg" },
    { id:"l9", name:"Soto Ayam Premium", price:19000, tags:["warm","comfort"], description:"Traditional Indonesian chicken soup" },
    { id:"l10", name:"Pisang Goreng Crispy", price:12000, tags:["sweet","snack"], description:"Crispy fried bananas with honey" }
  ];
  let filtered = [], reply = "";
  if (lower.includes('sweet') || lower.includes('dessert') || lower.includes('manis')) {
    filtered = localProducts.filter(p => p.tags.includes('sweet') || p.tags.includes('dessert'));
    reply = "Here are our finest sweet treats for you!";
  } else if (lower.includes('spicy') || lower.includes('pedas')) {
    filtered = localProducts.filter(p => p.tags.includes('spicy'));
    reply = "Here are our boldest spicy dishes!";
  } else if (lower.includes('healthy') || lower.includes('vegetarian')) {
    filtered = localProducts.filter(p => p.tags.includes('healthy') || p.tags.includes('vegetarian'));
    reply = "Here are our healthy options!";
  } else if (lower.includes('quick') || lower.includes('fast') || lower.includes('cepat')) {
    filtered = localProducts.filter(p => p.tags.includes('quick'));
    reply = "Quick and delicious — here you go!";
  } else if (lower.includes('luxury') || lower.includes('premium') || lower.includes('mewah')) {
    filtered = localProducts.filter(p => p.tags.includes('luxury'));
    reply = "Only the finest for Your Majesty!";
  } else if (lower.includes('cheap') || lower.includes('budget') || lower.includes('murah')) {
    filtered = localProducts.filter(p => p.price < 20000);
    reply = "Great value picks for your royal treasury!";
  } else if (lower.includes('chicken') || lower.includes('ayam')) {
    filtered = localProducts.filter(p => p.name.toLowerCase().includes('ayam') || p.name.toLowerCase().includes('sate') || p.name.toLowerCase().includes('soto'));
    reply = "Here are our royal chicken dishes!";
  } else {
    return { reply: "What kind of food are you craving, Your Majesty? Try asking for something sweet, spicy, healthy, or quick!", products: [] };
  }
  return { reply, products: filtered.slice(0, 4) };
}

function getConversationContext() {
  const chatWindow = document.getElementById('chat-window');
  const messages = [];
  chatWindow.querySelectorAll('.king-bubble, .servant-bubble').forEach((el, i, arr) => {
    if (i < arr.length - 6) return;
    const text = el.querySelector('p')?.textContent || '';
    if (text) messages.push({ role: el.classList.contains('king-bubble') ? 'user' : 'assistant', content: text });
  });
  return messages;
}

async function handleSearch() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;
  renderMessage(message, "king");
  input.value = "";
  showTypingIndicator(message);
  try {
    if (handleQuickCommands(message) === "HANDLED") { removeTypingIndicator(); return; }
    const response = await sendToOllama(message);
    removeTypingIndicator();
    await processAIResponse(response);
  } catch (e) {
    removeTypingIndicator();
    renderMessage("I'm having trouble, Your Majesty. Please try again!", "servant");
  }
}

function handleQuickCommands(message) {
  const lower = message.toLowerCase().trim();
  if (lower === 'history' || lower === 'order history' || lower === 'riwayat') {
    removeTypingIndicator();
    showOrderHistory();
    return "HANDLED";
  }
  return null;
}

function showTypingIndicator(message) {
  const lower = message.toLowerCase();
  let text = "Consulting the royal oracle...";
  if (lower.includes('sweet') || lower.includes('dessert')) text = "Searching the royal dessert chamber...";
  else if (lower.includes('spicy')) text = "Checking the royal spice collection...";
  else if (lower.includes('cheap') || lower.includes('budget')) text = "Finding royal deals...";
  else if (lower.includes('quick') || lower.includes('fast')) text = "Preparing quick royal service...";
  const div = document.createElement('div');
  div.className = 'servant-bubble p-6 max-w-[85%] typing-indicator-container';
  div.innerHTML = `<div class="flex items-start gap-3"><div class="w-8 h-8 rounded-full gold-bg flex items-center justify-center flex-shrink-0 mt-1"><svg class="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div class="flex-1"><p class="text-gray-300 mb-2">${text}</p><div class="typing-indicator"><span></span><span></span><span></span></div></div></div>`;
  const cw = document.getElementById('chat-window');
  cw.appendChild(div);
  cw.scrollTop = cw.scrollHeight;
}

function removeTypingIndicator() {
  document.querySelector('.typing-indicator-container')?.remove();
}

async function processAIResponse(response) {
  try {
    const parsed = typeof response === 'string' ? (() => { try { return JSON.parse(response); } catch(e) { return { reply: response, products: [] }; } })() : response;
    if (parsed.reply !== undefined) {
      renderMessage(parsed.reply, "servant");
      if (parsed.products && parsed.products.length > 0) showProductCards(parsed.products);
      return;
    }
    if (parsed.type === 'product_recommendations' && parsed.products) {
      renderMessage(parsed.message || "Here are my recommendations:", "servant");
      showProductCards(parsed.products);
    } else if (parsed.message) {
      renderMessage(parsed.message, "servant");
    } else {
      renderMessage(String(response), "servant");
    }
  } catch(e) { renderMessage(String(response), "servant"); }
}

function renderMessage(message, sender) {
  const cw = document.getElementById('chat-window');
  const div = document.createElement('div');
  div.className = `${sender}-bubble p-6 max-w-[85%] animate-fadeIn`;
  div.innerHTML = `<p class="${sender === 'king' ? 'text-right' : 'text-left'}">${message}</p>`;
  cw.appendChild(div);
  cw.scrollTop = cw.scrollHeight;
}

function showProductCards(products) {
  const cw = document.getElementById('chat-window');
  let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:8px;">';
  products.forEach((p, i) => {
    const pj = JSON.stringify(p).replace(/"/g, '&quot;');
    const uid = 'qty_' + (p.id || i) + '_' + Date.now() + '_' + i;
    const stock = p.stock ?? null;
    const outOfStock = stock !== null && stock === 0;
    const lowStock = stock !== null && stock > 0 && stock <= 5;
    const stockBadge = outOfStock
      ? `<span style="background:rgba(239,68,68,0.2);color:#ef4444;border:1px solid rgba(239,68,68,0.4);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">OUT OF STOCK</span>`
      : lowStock
      ? `<span style="background:rgba(245,158,11,0.2);color:#f59e0b;border:1px solid rgba(245,158,11,0.4);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">LOW STOCK: ${stock}</span>`
      : stock !== null
      ? `<span style="background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.3);padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;">IN STOCK: ${stock}</span>`
      : '';

    html += `<div style="background:rgba(0,0,0,0.3);border:1px solid rgba(212,175,55,${outOfStock ? '0.15' : '0.4'});border-radius:12px;padding:14px;opacity:${outOfStock ? '0.7' : '1'};">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
        <h4 style="color:${outOfStock ? '#6b7280' : '#D4AF37'};font-weight:700;font-size:14px;margin:0;flex:1;">${p.name}</h4>
        <span style="color:#fff;font-weight:600;font-size:13px;margin-left:8px;white-space:nowrap;">Rp ${Number(p.price).toLocaleString()}</span>
      </div>
      ${stockBadge ? `<div style="margin-bottom:8px;">${stockBadge}</div>` : ''}
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:10px;color:#9CA3AF;font-size:12px;">
        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        <span>Seller</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="display:flex;align-items:center;${outOfStock ? 'opacity:0.4;pointer-events:none;' : ''}">
          <button onclick="changeCardQty('${uid}',-1)" style="width:28px;height:28px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:4px 0 0 4px;color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">−</button>
          <span id="${uid}" style="min-width:32px;height:28px;background:rgba(0,0,0,0.4);border-top:1px solid rgba(255,255,255,0.2);border-bottom:1px solid rgba(255,255,255,0.2);color:white;font-size:13px;display:flex;align-items:center;justify-content:center;">1</span>
          <button onclick="changeCardQty('${uid}',1)" style="width:28px;height:28px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:0 4px 4px 0;color:white;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;">+</button>
        </div>
        ${outOfStock
          ? `<button disabled style="flex:1;background:rgba(107,114,128,0.3);color:#6b7280;font-weight:700;font-size:12px;padding:7px 10px;border-radius:6px;border:1px solid rgba(107,114,128,0.3);cursor:not-allowed;display:flex;align-items:center;justify-content:center;gap:4px;">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/></svg>
              Unavailable
            </button>`
          : `<button onclick="addToCartWithQty(${pj},'${uid}')" style="flex:1;background:#D4AF37;color:#000;font-weight:700;font-size:12px;padding:7px 10px;border-radius:6px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              Add to Cart
            </button>`
        }
        <button onclick="showProductDetails(${pj})" style="padding:7px 10px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:6px;font-size:12px;cursor:pointer;">Info</button>
      </div>
    </div>`;
  });
  html += '</div>';
  const div = document.createElement('div');
  div.className = 'servant-bubble p-4 max-w-[95%] animate-fadeIn';
  div.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;"><div style="width:32px;height:32px;border-radius:50%;background:#D4AF37;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;"><svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div><div style="flex:1;">${html}</div></div>`;
  cw.appendChild(div);
  cw.scrollTop = cw.scrollHeight;
}

function changeCardQty(id, delta) {
  const span = document.getElementById(id);
  if (!span) return;
  span.textContent = Math.max(1, (parseInt(span.textContent) || 1) + delta);
}

function addToCartWithQty(product, spanId) {
  const span = document.getElementById(spanId);
  const qty = span ? parseInt(span.textContent) || 1 : 1;
  // Cek stok
  if (product.stock !== undefined && product.stock !== null) {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    const existing = cart.find(i => i.productId === product.id);
    const currentInCart = existing ? existing.quantity : 0;
    if (currentInCart + qty > product.stock) {
      alert(`Only ${product.stock} left in stock! You already have ${currentInCart} in cart.`);
      return;
    }
  }
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const ex = cart.find(i => i.productId === product.id);
  if (ex) ex.quantity += qty;
  else cart.push({ productId: product.id, name: product.name, price: product.price, quantity: qty, stock: product.stock });
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount(); renderCart(); animateCart(); showCartNotification(product.name);
}

function showProductDetails(product) {
  const stock = product.stock ?? null;
  const outOfStock = stock !== null && stock === 0;
  const stockInfo = stock === null ? '' : outOfStock
    ? `<div style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:8px 12px;margin-bottom:12px;color:#ef4444;font-weight:600;font-size:13px;">❌ Out of Stock</div>`
    : `<div style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:8px;padding:8px 12px;margin-bottom:12px;color:#4ade80;font-size:13px;">✅ Stock available: <strong>${stock}</strong></div>`;
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4';
  modal.innerHTML = `<div class="bg-black/95 glass-morphism border gold-border rounded-2xl max-w-md w-full p-6">
    <div class="flex justify-between items-start mb-4">
      <h3 class="text-xl font-bold gold-text">${product.name}</h3>
      <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-white">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="space-y-3">
      <p class="text-2xl font-bold text-white">Rp ${Number(product.price).toLocaleString()}</p>
      ${stockInfo}
      <p class="text-gray-300 text-sm">${product.description || 'A delicious royal delicacy.'}</p>
      ${outOfStock
        ? `<button disabled class="w-full py-3 rounded-xl font-bold" style="background:rgba(107,114,128,0.3);color:#6b7280;cursor:not-allowed;border:1px solid rgba(107,114,128,0.3);">Out of Stock</button>`
        : `<button onclick="addToCartWithQty(${JSON.stringify(product).replace(/"/g,'&quot;')},''); this.closest('.fixed').remove()" class="w-full luxury-button text-black font-bold py-3 rounded-xl">Add to Royal Cart</button>`
      }
    </div>
  </div>`;
  document.body.appendChild(modal);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('send-btn')?.addEventListener('click', handleSearch);
  document.getElementById('user-input')?.addEventListener('keypress', e => { if (e.key === 'Enter') handleSearch(); });
  document.getElementById('cart-btn')?.addEventListener('click', toggleCart);
  document.getElementById('close-cart')?.addEventListener('click', toggleCart);
  document.getElementById('cart-overlay')?.addEventListener('click', toggleCart);
  document.getElementById('clear-cart-btn')?.addEventListener('click', clearCart);
  document.getElementById('checkout-btn')?.addEventListener('click', openCheckout);
  document.getElementById('close-checkout')?.addEventListener('click', closeCheckout);
  document.getElementById('place-order-btn')?.addEventListener('click', processOrder);
  document.getElementById('close-success')?.addEventListener('click', closeSuccess);
  updateCartCount();
});

function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const ex = cart.find(i => i.productId === product.id);
  if (ex) ex.quantity += 1;
  else cart.push({ productId: product.id, name: product.name, price: product.price, quantity: 1 });
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount(); renderCart(); animateCart(); showCartNotification(product.name);
}

function showCartNotification(name) {
  const n = document.getElementById('cart-notification');
  const t = document.getElementById('notification-text');
  if (window.notifTimeout) clearTimeout(window.notifTimeout);
  t.textContent = `${name} added to cart!`;
  n.classList.remove('show'); void n.offsetWidth; n.classList.add('show');
  window.notifTimeout = setTimeout(() => n.classList.remove('show'), 3000);
}

function updateCartCount() {
  const total = (JSON.parse(localStorage.getItem("cart")) || []).reduce((s, i) => s + i.quantity, 0);
  const el = document.getElementById('cart-count');
  if (el) { el.textContent = total; el.style.display = total > 0 ? 'flex' : 'none'; }
}

function toggleCart() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  if (!sidebar || !overlay) return;
  if (sidebar.classList.contains('cart-sidebar-hidden')) {
    sidebar.classList.replace('cart-sidebar-hidden', 'cart-sidebar-visible');
    overlay.classList.remove('hidden'); renderCart();
  } else {
    sidebar.classList.replace('cart-sidebar-visible', 'cart-sidebar-hidden');
    overlay.classList.add('hidden');
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
    container.innerHTML = `<div class="text-center text-gray-400 py-8"><svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg><p>Your cart is empty</p></div>`;
    totalEl.textContent = "Rp 0"; return;
  }
  container.innerHTML = ""; let total = 0;
  cart.forEach(item => {
    const t = item.price * item.quantity; total += t;
    container.innerHTML += `<div class="glass-morphism p-4 rounded-xl"><div class="flex justify-between items-start mb-3"><div class="flex-1"><p class="gold-text font-semibold">${item.name}</p><p class="text-sm text-gray-400">Rp ${item.price.toLocaleString()} each</p></div><button onclick="removeFromCart('${item.productId}')" class="text-red-400 hover:text-red-300"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button></div><div class="flex items-center justify-between"><div class="flex items-center gap-2"><button onclick="updateQuantity('${item.productId}',-1)" class="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center">-</button><span class="w-8 text-center">${item.quantity}</span><button onclick="updateQuantity('${item.productId}',1)" class="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center">+</button></div><p class="gold-text font-semibold">Rp ${t.toLocaleString()}</p></div></div>`;
  });
  totalEl.textContent = `Rp ${total.toLocaleString()}`;
}

function updateQuantity(id, change) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const item = cart.find(i => i.productId === id);
  if (item) {
    const newQty = item.quantity + change;
    if (item.stock !== undefined && item.stock !== null && newQty > item.stock) {
      alert(`Only ${item.stock} left in stock!`); return;
    }
    item.quantity = newQty;
    if (item.quantity <= 0) cart = cart.filter(i => i.productId !== id);
    localStorage.setItem("cart", JSON.stringify(cart)); updateCartCount(); renderCart();
  }
}

function removeFromCart(id) {
  localStorage.setItem("cart", JSON.stringify((JSON.parse(localStorage.getItem("cart")) || []).filter(i => i.productId !== id)));
  updateCartCount(); renderCart();
}

function clearCart() {
  localStorage.removeItem("cart"); updateCartCount(); renderCart();
}

function openCheckout() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) { alert('Your cart is empty!'); return; }
  renderCheckoutItems(); calculateCheckoutTotals(); loadSavedAddress(); toggleCart();
  const modal = document.getElementById('checkout-modal');
  modal.classList.remove('hidden'); setTimeout(() => modal.classList.add('show'), 10);
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  saveCurrentAddress();
  const modal = document.getElementById('checkout-modal');
  modal.classList.remove('show'); setTimeout(() => modal.classList.add('hidden'), 300);
  document.body.style.overflow = 'auto';
}

function saveCurrentAddress() {
  const d = { fullName: document.getElementById('full-name')?.value||'', phone: document.getElementById('phone')?.value||'', address: document.getElementById('address')?.value||'', city: document.getElementById('city')?.value||'', postalCode: document.getElementById('postal-code')?.value||'' };
  if (d.fullName || d.phone || d.address) localStorage.setItem('savedAddress', JSON.stringify(d));
}

function loadSavedAddress() {
  const saved = localStorage.getItem('savedAddress'); if (!saved) return;
  const d = JSON.parse(saved);
  if (d.fullName) document.getElementById('full-name').value = d.fullName;
  if (d.phone) document.getElementById('phone').value = d.phone;
  if (d.address) document.getElementById('address').value = d.address;
  if (d.city) document.getElementById('city').value = d.city;
  if (d.postalCode) document.getElementById('postal-code').value = d.postalCode;
  if (d.fullName || d.address) document.getElementById('address-saved-indicator')?.classList.remove('hidden');
}

function renderCheckoutItems() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const container = document.getElementById("checkout-items"); container.innerHTML = "";
  cart.forEach(item => { const t = item.price * item.quantity; container.innerHTML += `<div class="flex justify-between items-center p-3 bg-black/30 rounded-lg"><div class="flex-1"><p class="text-white font-semibold">${item.name}</p><p class="text-sm text-gray-400">${item.quantity} × Rp ${item.price.toLocaleString()}</p></div><p class="gold-text font-semibold">Rp ${t.toLocaleString()}</p></div>`; });
}

function calculateCheckoutTotals() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const sub = cart.reduce((s,i) => s + i.price * i.quantity, 0);
  const tax = Math.round(sub * 0.1);
  document.getElementById('checkout-subtotal').textContent = `Rp ${sub.toLocaleString()}`;
  document.getElementById('checkout-tax').textContent = `Rp ${tax.toLocaleString()}`;
  document.getElementById('checkout-total').textContent = `Rp ${(sub + 10000 + tax).toLocaleString()}`;
}

function validateForm() {
  for (const id of ['full-name','phone','address','city','postal-code']) {
    if (!document.getElementById(id).value.trim()) { alert('Please fill in all required fields.'); return false; }
  }
  if (document.getElementById('phone').value.trim().length < 10) { alert('Please enter a valid phone number.'); return false; }
  return true;
}

async function processOrder() {
  if (!validateForm()) return;
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) { alert('Cart is empty!'); return; }
  saveCurrentAddress();

  // Kurangi stok di Firestore untuk produk yang ada di Firebase (bukan fallback)
  const batch = db.batch();
  let stockError = null;
  for (const item of cart) {
    if (!item.productId.startsWith('l')) { // bukan fallback local product
      const ref = db.collection('products').doc(item.productId);
      const snap = await ref.get();
      if (snap.exists) {
        const currentStock = snap.data().stock ?? 0;
        if (currentStock < item.quantity) {
          stockError = `Sorry, "${item.name}" only has ${currentStock} left in stock.`;
          break;
        }
        batch.update(ref, { stock: currentStock - item.quantity });
      }
    }
  }
  if (stockError) { alert(stockError); return; }
  await batch.commit();

  const sub = cart.reduce((s,i) => s + i.price * i.quantity, 0);
  const tax = Math.round(sub * 0.1);
  const orderData = {
    fullName: document.getElementById('full-name').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    postalCode: document.getElementById('postal-code').value,
    paymentMethod: document.querySelector('input[name="payment"]:checked').value,
    items: cart, subtotal: sub, deliveryFee: 10000, tax, total: sub + 10000 + tax,
    orderDate: new Date().toISOString(), orderId: 'ORD' + Date.now()
  };
  showLoading();
  setTimeout(() => { hideLoading(); showSuccess(orderData); clearCart(); closeCheckout(); }, 2000);
}

function showLoading() {
  const el = document.getElementById('loading-overlay');
  el.classList.remove('hidden'); el.classList.add('flex');
  setTimeout(() => el.classList.add('show'), 10);
}

function hideLoading() {
  const el = document.getElementById('loading-overlay');
  el.classList.remove('show');
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('flex'); }, 300);
}

function showSuccess(orderData) {
  const modal = document.getElementById('success-modal');
  const details = document.getElementById('order-details');
  let history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  history.push(orderData); localStorage.setItem('orderHistory', JSON.stringify(history));
  const rows = (orderData.items||[]).map(i => `<tr style="border-bottom:1px solid rgba(212,175,55,0.15);"><td style="padding:6px 4px;color:#e5e7eb;font-size:12px;">${i.name}</td><td style="padding:6px 4px;color:#9ca3af;font-size:12px;text-align:center;">${i.quantity}x</td><td style="padding:6px 4px;color:#D4AF37;font-size:12px;text-align:right;">Rp ${(i.price*i.quantity).toLocaleString()}</td></tr>`).join('');
  const pLabel = {cash:'Cash on Delivery',transfer:'Bank Transfer',ewallet:'E-Wallet'}[orderData.paymentMethod]||orderData.paymentMethod;
  const chartId = 'chart_' + Date.now();
  details.innerHTML = `
    <div style="text-align:center;margin-bottom:14px;padding-bottom:14px;border-bottom:1px dashed rgba(212,175,55,0.4);">
      <p style="color:#D4AF37;font-family:'Orbitron',sans-serif;font-weight:900;font-size:18px;letter-spacing:2px;">TEMPAT.</p>
      <p style="color:#9ca3af;font-size:11px;">Order Receipt</p>
      <p style="color:#6b7280;font-size:10px;">${new Date(orderData.orderDate).toLocaleString()}</p>
    </div>
    <div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.3);border-radius:8px;padding:8px 12px;margin-bottom:12px;text-align:center;">
      <p style="color:#9ca3af;font-size:10px;text-transform:uppercase;">Order ID</p>
      <p style="color:#D4AF37;font-weight:700;font-size:13px;font-family:monospace;">${orderData.orderId}</p>
    </div>
    <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed rgba(212,175,55,0.2);">
      <p style="color:#D4AF37;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:6px;">Customer Details</p>
      <div style="display:grid;gap:4px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;"><span style="color:#9ca3af;">Name</span><span style="color:#e5e7eb;">${orderData.fullName}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#9ca3af;">Phone</span><span style="color:#e5e7eb;">${orderData.phone}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#9ca3af;">Address</span><span style="color:#e5e7eb;text-align:right;max-width:60%;">${orderData.address}, ${orderData.city}</span></div>
        <div style="display:flex;justify-content:space-between;"><span style="color:#9ca3af;">Payment</span><span style="color:#e5e7eb;">${pLabel}</span></div>
      </div>
    </div>
    <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed rgba(212,175,55,0.2);">
      <p style="color:#D4AF37;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:6px;">Items Ordered</p>
      <table style="width:100%;border-collapse:collapse;"><tbody>${rows}</tbody></table>
    </div>
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span style="color:#9ca3af;">Subtotal</span><span style="color:#e5e7eb;">Rp ${orderData.subtotal.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;"><span style="color:#9ca3af;">Delivery</span><span style="color:#e5e7eb;">Rp ${orderData.deliveryFee.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px;"><span style="color:#9ca3af;">Tax (10%)</span><span style="color:#e5e7eb;">Rp ${orderData.tax.toLocaleString()}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding-top:8px;border-top:1px solid rgba(212,175,55,0.4);"><span style="color:#fff;">TOTAL</span><span style="color:#D4AF37;">Rp ${orderData.total.toLocaleString()}</span></div>
    </div>
    <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(212,175,55,0.2);border-radius:10px;padding:12px;">
      <p style="color:#D4AF37;font-size:11px;font-weight:600;text-transform:uppercase;margin-bottom:10px;">Cost Breakdown</p>
      <canvas id="${chartId}" height="140"></canvas>
    </div>`;
  setTimeout(() => drawChart(chartId, orderData), 50);
  modal.classList.remove('hidden'); modal.classList.add('flex');
  setTimeout(() => modal.classList.add('show'), 10);
  document.body.style.overflow = 'hidden';
}

function drawChart(id, d) {
  const canvas = document.getElementById(id); if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const total = d.subtotal + d.deliveryFee + d.tax;
  const slices = [{label:'Food',value:d.subtotal,color:'#D4AF37'},{label:'Delivery',value:d.deliveryFee,color:'#6B7280'},{label:'Tax',value:d.tax,color:'#374151'}];
  const W = canvas.width = canvas.parentElement.offsetWidth - 24; const H = 140; canvas.height = H;
  const cx = W*0.28, cy = H/2, r = Math.min(cy-10,55);
  let a = -Math.PI/2;
  slices.forEach(s => { const ang=(s.value/total)*2*Math.PI; ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,a,a+ang); ctx.closePath(); ctx.fillStyle=s.color; ctx.fill(); a+=ang; });
  ctx.beginPath(); ctx.arc(cx,cy,r*0.55,0,2*Math.PI); ctx.fillStyle='#111'; ctx.fill();
  ctx.fillStyle='#D4AF37'; ctx.font='bold 10px Inter,sans-serif'; ctx.textAlign='center'; ctx.fillText('TOTAL',cx,cy-5);
  ctx.fillStyle='#fff'; ctx.font='bold 9px Inter,sans-serif'; ctx.fillText('Rp '+(total/1000).toFixed(0)+'k',cx,cy+9);
  let ly=cy-(slices.length*18)/2+9; const lx=cx+r+20;
  slices.forEach(s => { ctx.fillStyle=s.color; ctx.fillRect(lx,ly-7,10,10); ctx.fillStyle='#D1D5DB'; ctx.font='11px Inter,sans-serif'; ctx.textAlign='left'; ctx.fillText(s.label+' '+((s.value/total)*100).toFixed(0)+'%',lx+14,ly+2); ly+=22; });
}

function closeSuccess() {
  const el = document.getElementById('success-modal');
  el.classList.remove('show');
  setTimeout(() => { el.classList.add('hidden'); el.classList.remove('flex'); }, 300);
  document.body.style.overflow = 'auto';
  document.getElementById('address-form').reset();
}

// =============================================
// ORDER HISTORY MODAL
// =============================================
function showOrderHistory() {
  const history = JSON.parse(localStorage.getItem('orderHistory') || '[]');
  const body = document.getElementById('history-modal-body');
  if (!body) return;
  if (history.length === 0) {
    body.innerHTML = `<div style="text-align:center;padding:48px 0;"><svg style="width:64px;height:64px;margin:0 auto 16px;opacity:0.3;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg><p style="color:#9ca3af;font-size:14px;">No orders yet, Your Majesty.</p><p style="color:#6b7280;font-size:12px;margin-top:4px;">Your transaction history will appear here.</p></div>`;
  } else {
    body.innerHTML = history.slice().reverse().map(order => {
      const itemNames = order.items.map(i => `${i.name} ×${i.quantity}`).join(', ');
      const pLabel = {cash:'Cash on Delivery',transfer:'Bank Transfer',ewallet:'E-Wallet'}[order.paymentMethod]||order.paymentMethod;
      return `<div style="background:rgba(212,175,55,0.05);border:1px solid rgba(212,175,55,0.25);border-radius:12px;padding:14px;margin-bottom:12px;"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;"><div><p style="color:#D4AF37;font-weight:700;font-size:13px;font-family:monospace;">${order.orderId}</p><p style="color:#6b7280;font-size:11px;margin-top:2px;">${new Date(order.orderDate).toLocaleString()}</p></div><span style="background:rgba(34,197,94,0.15);color:#4ade80;font-size:11px;padding:3px 8px;border-radius:20px;border:1px solid rgba(34,197,94,0.3);">Completed</span></div><div style="border-top:1px dashed rgba(212,175,55,0.2);padding-top:10px;margin-bottom:10px;"><p style="color:#9ca3af;font-size:11px;text-transform:uppercase;margin-bottom:4px;">Items</p><p style="color:#e5e7eb;font-size:12px;">${itemNames}</p></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:10px;"><div><span style="color:#9ca3af;">Customer: </span><span style="color:#e5e7eb;">${order.fullName}</span></div><div><span style="color:#9ca3af;">Payment: </span><span style="color:#e5e7eb;">${pLabel}</span></div><div style="grid-column:span 2;"><span style="color:#9ca3af;">Address: </span><span style="color:#e5e7eb;">${order.address}, ${order.city}</span></div></div><div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid rgba(212,175,55,0.2);"><span style="color:#9ca3af;font-size:12px;">${order.items.length} item(s)</span><span style="color:#D4AF37;font-weight:700;font-size:15px;">Rp ${order.total.toLocaleString()}</span></div></div>`;
    }).join('');
  }
  const modal = document.getElementById('history-modal');
  modal.classList.remove('hidden'); modal.classList.add('flex');
  setTimeout(() => modal.classList.add('show'), 10);
  document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
  const modal = document.getElementById('history-modal');
  modal.classList.remove('show');
  setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
  document.body.style.overflow = 'auto';
}

// =============================================
// LEAFLET MAP
// =============================================
let checkoutMap = null;
let checkoutMarker = null;
let geocodeTimeout = null;

function initCheckoutMap() {
  const container = document.getElementById('checkout-map-container');
  const btn = document.getElementById('pin-location-btn');
  if (container.style.display !== 'none') {
    container.style.display = 'none';
    btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> Show Map & Pin Location`;
    return;
  }
  container.style.display = 'block';
  btn.innerHTML = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> Hide Map`;
  if (checkoutMap) { setTimeout(() => checkoutMap.invalidateSize(), 100); const addr = buildFullAddress(); if (addr) geocodeAddress(addr); return; }
  const defaultLat = -6.2088, defaultLng = 106.8456;
  setTimeout(() => {
    checkoutMap = L.map('checkout-map').setView([defaultLat, defaultLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(checkoutMap);
    const goldIcon = L.divIcon({ html: `<div style="width:28px;height:28px;background:#D4AF37;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #000;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`, iconSize: [28,28], iconAnchor: [14,28], className: '' });
    checkoutMarker = L.marker([defaultLat, defaultLng], { draggable: true, icon: goldIcon }).addTo(checkoutMap);
    checkoutMarker.on('dragend', e => { const p = e.target.getLatLng(); updateMapCoords(p.lat, p.lng); });
    checkoutMap.on('click', e => { checkoutMarker.setLatLng(e.latlng); updateMapCoords(e.latlng.lat, e.latlng.lng); });
    const addr = buildFullAddress();
    if (addr) { geocodeAddress(addr); }
    else if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(p => { checkoutMap.setView([p.coords.latitude, p.coords.longitude], 15); checkoutMarker.setLatLng([p.coords.latitude, p.coords.longitude]); updateMapCoords(p.coords.latitude, p.coords.longitude); }, () => updateMapCoords(defaultLat, defaultLng)); }
    attachAddressListeners();
  }, 100);
}

function attachAddressListeners() {
  ['address','city','postal-code'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      clearTimeout(geocodeTimeout);
      setMapStatus('⏳ Searching location...', '#D4AF37');
      geocodeTimeout = setTimeout(() => { const a = buildFullAddress(); if (a.length > 5) geocodeAddress(a); }, 800);
    });
  });
}

function buildFullAddress() {
  return [document.getElementById('address')?.value?.trim()||'', document.getElementById('city')?.value?.trim()||'', document.getElementById('postal-code')?.value?.trim()||''].filter(Boolean).join(', ');
}

async function geocodeAddress(query) {
  try {
    setMapStatus('🔍 Finding location...', '#D4AF37');
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, { headers: { 'Accept-Language': 'id,en' } });
    const data = await res.json();
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat), lng = parseFloat(data[0].lon);
      checkoutMap.setView([lat, lng], 16); checkoutMarker.setLatLng([lat, lng]);
      updateMapCoords(lat, lng, data[0].display_name);
    } else { setMapStatus('❌ Address not found. Drag pin manually.', '#ef4444'); }
  } catch(e) { setMapStatus('❌ Could not search address.', '#ef4444'); }
}

function updateMapCoords(lat, lng, displayName) {
  const label = displayName ? `📍 <span style="color:#D4AF37;font-weight:600;">Found:</span> ${displayName.substring(0,60)}...` : `📍 <span style="color:#D4AF37;font-weight:600;">Pinned:</span> ${lat.toFixed(6)}, ${lng.toFixed(6)} — <span style="color:#4ade80;">Location saved!</span>`;
  setMapStatus(label, null);
  localStorage.setItem('pinnedLocation', JSON.stringify({ lat, lng }));
}

function setMapStatus(html, color) {
  const el = document.getElementById('map-coords');
  if (!el) return;
  el.innerHTML = html;
  el.style.color = color || '#9ca3af';
}

// =============================================
// BUYER CHAT
// =============================================
const BUYER_NAME = "Buyer_" + Math.random().toString(36).substr(2, 5);
let buyerConvId = localStorage.getItem('buyerConvId') || null;
let buyerChatOpen = false;
let buyerMsgUnsubscribe = null;

async function initBuyerChat() {
  if (!buyerConvId) {
    const ref = await db.collection('chats').add({
      buyerName: BUYER_NAME,
      lastMessage: '',
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      unreadSeller: 0,
      unreadBuyer: 0
    });
    buyerConvId = ref.id;
    localStorage.setItem('buyerConvId', buyerConvId);
  }
}

async function sendBuyerMessage(text) {
  if (!text.trim()) return;
  if (!buyerConvId) await initBuyerChat();
  const now = firebase.firestore.FieldValue.serverTimestamp();
  await db.collection('chats').doc(buyerConvId).collection('messages').add({ text, sender: 'buyer', createdAt: now });
  await db.collection('chats').doc(buyerConvId).update({ lastMessage: text, lastMessageAt: now, unreadSeller: firebase.firestore.FieldValue.increment(1) });
}

async function clearBuyerChat() {
  if (!buyerConvId) return;
  if (!confirm("Clear chat history?")) return;
  const msgs = await db.collection('chats').doc(buyerConvId).collection('messages').get();
  const batch = db.batch();
  msgs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  await db.collection('chats').doc(buyerConvId).update({ lastMessage: '', unreadSeller: 0, unreadBuyer: 0 });
}

function openBuyerChat() {
  buyerChatOpen = !buyerChatOpen;
  const modal = document.getElementById('buyer-chat-modal');
  modal.style.display = buyerChatOpen ? 'block' : 'none';
  if (buyerChatOpen) {
    if (buyerConvId) listenBuyerMessages();
    else initBuyerChat().then(() => listenBuyerMessages());
  }
}

function closeBuyerChat() {
  buyerChatOpen = false;
  document.getElementById('buyer-chat-modal').style.display = 'none';
}

function listenBuyerMessages() {
  if (!buyerConvId) return;
  if (buyerMsgUnsubscribe) buyerMsgUnsubscribe();
  buyerMsgUnsubscribe = db.collection('chats').doc(buyerConvId)
    .collection('messages').orderBy('createdAt', 'asc')
    .onSnapshot(snapshot => {
      const container = document.getElementById('buyer-chat-messages');
      container.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const isBuyer = msg.sender === 'buyer';
        const div = document.createElement('div');
        div.style.cssText = `display:flex;justify-content:${isBuyer ? 'flex-end' : 'flex-start'};margin-bottom:4px;`;
        div.innerHTML = `<div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:12px;line-height:1.5;word-break:break-word;${isBuyer ? 'background:#D4AF37;color:#000;border-bottom-right-radius:3px;' : 'background:#1a1a1a;color:#e5e7eb;border:1px solid rgba(255,255,255,0.08);border-bottom-left-radius:3px;'}">${msg.text}</div>`;
        container.appendChild(div);
      });
      container.scrollTop = container.scrollHeight;
      db.collection('chats').doc(buyerConvId).update({ unreadBuyer: 0 });
    });
}

async function submitBuyerMsg() {
  const input = document.getElementById('buyer-msg-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.focus();
  await sendBuyerMessage(text);
}

// Init chat saat halaman load
// =============================================
// BUYER CHAT NOTIFICATION
// =============================================
function listenBuyerUnread() {
  if (!buyerConvId) return;

  db.collection('chats').doc(buyerConvId).onSnapshot(doc => {
    if (!doc.exists) return;
    const unread = doc.data().unreadBuyer || 0;
    const fab = document.getElementById('buyer-chat-fab');
    if (!fab) return;

    // Hapus badge lama kalau ada
    const oldBadge = document.getElementById('buyer-unread-badge');
    if (oldBadge) oldBadge.remove();

    if (unread > 0 && !buyerChatOpen) {
      // Tambah badge merah
      const badge = document.createElement('span');
      badge.id = 'buyer-unread-badge';
      badge.textContent = unread;
      badge.style.cssText = `
        position:absolute;top:-6px;right:-6px;
        background:#ef4444;color:white;
        font-size:10px;font-weight:700;
        width:18px;height:18px;border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        border:2px solid #000;
        pointer-events:none;
      `;
      fab.style.position = 'relative';
      fab.appendChild(badge);

      // Notif pop-up
      showBuyerNotif();
    }
  });
}

function showBuyerNotif() {
  const existing = document.getElementById('buyer-notif-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'buyer-notif-toast';
  toast.style.cssText = `
    position:fixed;bottom:24px;right:90px;z-index:9002;
    background:#0a0a0a;border:1px solid rgba(212,175,55,0.5);
    border-radius:12px;padding:12px 16px;
    display:flex;align-items:center;gap:10px;
    box-shadow:0 8px 30px rgba(0,0,0,0.8);
    animation:slideInRight 0.3s ease;
    max-width:280px;cursor:pointer;
  `;
  toast.innerHTML = `
    <div style="width:36px;height:36px;border-radius:50%;background:#D4AF37;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
      <svg width="18" height="18" fill="none" stroke="#000" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
      </svg>
    </div>
    <div>
      <p style="color:#D4AF37;font-weight:700;font-size:13px;margin:0;">New message from Seller</p>
      <p style="color:#9ca3af;font-size:11px;margin:2px 0 0;">Tap to open chat</p>
    </div>
    <button onclick="document.getElementById('buyer-notif-toast').remove()" style="background:none;border:none;color:#6b7280;cursor:pointer;font-size:16px;margin-left:auto;padding:0;">✕</button>
  `;
  toast.onclick = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    toast.remove();
    if (!buyerChatOpen) openBuyerChat();
  };
  document.body.appendChild(toast);

  // Auto hilang setelah 5 detik
  setTimeout(() => toast?.remove(), 5000);
}

// Tambahkan CSS animasi
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(20px); }
    to { opacity:1; transform:translateX(0); }
  }
`;
document.head.appendChild(style);

// Init listener setelah chat ready
initBuyerChat().then(() => listenBuyerUnread());