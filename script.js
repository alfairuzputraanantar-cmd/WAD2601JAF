// 1. Konfigurasi Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCIYc8Epfu3jmrewyRaVGc4ISm7qKxG03k",
  authDomain: "localluxury-cb0d7.firebaseapp.com",
  projectId: "localluxury-cb0d7",
  storageBucket: "localluxury-cb0d7.firebasestorage.app",
  messagingSenderId: "425958954222",
  appId: "1:425958954222:web:0bfcdedbfbac2697a40fff",
  measurementId: "G-DHC0N06PZB"
};

// 2. Inisialisasi Firebase (Gaya Compat/Lama agar cocok dengan HTML)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function sendToOllama(message) {
  const res = await fetch("http://localhost:3000/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: message
    })
  });

  const data = await res.json();
  return data.reply;
}


// --- LOGIKA UTAMA ---

// Fungsi mencari makanan (handleSearch)
async function handleSearch() {
  const userInput = document.getElementById("user-input");
  const message = userInput.value.trim();
  if (!message) return;

  // tampilkan pesan user
  renderMessage(message, "king");
  userInput.value = "";

  // loading
  renderMessage("Let me consult the royal oracle...", "servant");

  try {
    const res = await fetch("http://localhost:3000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message })
    });

    const data = await res.json();

    removeLastMessage(); // hapus loading
    renderMessage(data.reply, "servant");

  } catch (error) {
    console.error(error);
    removeLastMessage();
    renderMessage("❌ The oracle cannot be reached.", "servant");
  }
}

// Fungsi menampilkan pesan di chat
function renderMessage(message, sender) {
    const chatWindow = document.getElementById('chat-window');
    const div = document.createElement('div');
    div.className = `${sender}-bubble p-6 max-w-[85%] animate-fadeIn`;
    div.innerHTML = `<p class="${sender === 'king' ? 'text-right' : 'text-left'}">${message}</p>`;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// Fungsi menampilkan kartu rekomendasi
function showWinner(product) {
    const resultArea = document.getElementById('result-area');
    const winnerContainer = document.getElementById('winner-container');
    
    winnerContainer.innerHTML = `
        <div class="p-6 bg-black/20 rounded-xl border gold-border winner-card">
            <h3 class="text-2xl gold-text font-bold mb-2">${product.name}</h3>
            <p class="text-lg text-gray-300 mb-4">Price: Rp ${product.price.toLocaleString()}</p>
            <div class="flex gap-3">
                <button onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="flex-1 luxury-button text-black font-bold py-3 rounded-xl font-semibold">
                    <span class="flex items-center justify-center gap-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        Add to Cart
                    </span>
                </button>
            </div>
        </div>
    `;
    resultArea.classList.remove('hidden');
}

// Fungsi menampilkan multiple hasil sebagai chat message
function showMultipleResults(products) {
    const chatWindow = document.getElementById('chat-window');
    
    let productsHTML = '<div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">';
    
    products.forEach(product => {
        productsHTML += `
            <div class="p-3 bg-black/20 rounded-lg border gold-border product-card hover:scale-105 transition-transform">
                <h4 class="text-sm gold-text font-bold mb-1">${product.name}</h4>
                <p class="text-xs text-gray-300 mb-2">Rp ${product.price.toLocaleString()}</p>
                <button onclick="addToCart(${JSON.stringify(product).replace(/"/g, '&quot;')})" class="w-full luxury-button text-black font-bold py-1.5 rounded text-xs">
                    <span class="flex items-center justify-center gap-1">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        Add to Cart
                    </span>
                </button>
            </div>
        `;
    });
    
    productsHTML += '</div>';
    
    // Create servant message with products
    const div = document.createElement('div');
    div.className = 'servant-bubble p-4 max-w-[90%] animate-fadeIn';
    div.innerHTML = `
        <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full gold-bg flex items-center justify-center flex-shrink-0 mt-1">
                <svg class="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
            <div class="flex-1">
                <p class="text-sm font-semibold mb-2">I found these royal delicacies for you, Your Majesty:</p>
                ${productsHTML}
            </div>
        </div>
    `;
    
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 3. EVENT LISTENERS (Kunci Agar Tombol Berfungsi)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('send-btn'); // ID Tombol Discover
    const input = document.getElementById('user-input'); // ID Input Teks
    const cartBtn = document.getElementById('cart-btn');
    const closeCartBtn = document.getElementById('close-cart');
    const clearCartBtn = document.getElementById('clear-cart-btn');
    const checkoutBtn = document.getElementById('checkout-btn');
    const cartOverlay = document.getElementById('cart-overlay');

    if (btn) {
        btn.addEventListener('click', handleSearch);
    }

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', () => {
            toggleCart();
        });
    }

    if (closeCartBtn) {
        closeCartBtn.addEventListener('click', () => {
            toggleCart();
        });
    }

    if (cartOverlay) {
        cartOverlay.addEventListener('click', () => {
            toggleCart();
        });
    }

    if (clearCartBtn) {
        clearCartBtn.addEventListener('click', clearCart);
    }

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            openCheckout();
        });
    }

    // Checkout modal event listeners
    const closeCheckoutBtn = document.getElementById('close-checkout');
    const placeOrderBtn = document.getElementById('place-order-btn');
    const closeSuccessBtn = document.getElementById('close-success');

    if (closeCheckoutBtn) {
        closeCheckoutBtn.addEventListener('click', closeCheckout);
    }

    if (placeOrderBtn) {
        placeOrderBtn.addEventListener('click', processOrder);
    }

    if (closeSuccessBtn) {
        closeSuccessBtn.addEventListener('click', closeSuccess);
    }

    // Initialize cart count on page load
    updateCartCount();
    
    // Also initialize cart display if sidebar is somehow visible
    const sidebar = document.getElementById('cart-sidebar');
    if (sidebar && sidebar.classList.contains('cart-sidebar-visible')) {
        renderCart();
    }
});

// 4. Cek apakah database kosong, jika ya isi data awal
db.collection("products").limit(1).get().then(snapshot => {
    if (snapshot.empty) {
        const menu = [
            { name: "Nasi Rendang Royal", price: 25000, tags: ["spicy", "filling"] },
            { name: "Martabak Sweetness", price: 20000, tags: ["sweet", "dessert"] },
            { name: "Sate Ayam Sultan", price: 30000, tags: ["luxury", "portion"] },
            { name: "Gado-Gado Premium", price: 18000, tags: ["healthy", "vegetarian"] },
            { name: "Bakso Urat Special", price: 22000, tags: ["spicy", "filling"] },
            { name: "Es Teler Deluxe", price: 15000, tags: ["sweet", "dessert", "cold"] },
            { name: "Ayam Bakar Madu", price: 28000, tags: ["luxury", "sweet"] },
            { name: "Mie Goreng Special", price: 16000, tags: ["quick", "filling"] },
            { name: "Soto Ayam Premium", price: 19000, tags: ["warm", "comfort"] },
            { name: "Pisang Goreng Crispy", price: 12000, tags: ["sweet", "snack"] }
        ];
        menu.forEach(item => db.collection("products").add(item));
    }
});

// ADD TO CART LOGIC
function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const existingItem = cart.find(item => item.productId === product.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
  animateCart();
  
  // Show notification popup
  showCartNotification(product.name);
}

function showCartNotification(productName) {
  const notification = document.getElementById('cart-notification');
  const notificationText = document.getElementById('notification-text');
  
  // Clear any existing timeout
  if (window.notificationTimeout) {
    clearTimeout(window.notificationTimeout);
  }
  
  // Update notification text
  notificationText.textContent = `${productName} added to cart!`;
  
  // Remove show class to ensure clean state
  notification.classList.remove('show');
  
  // Force a reflow to ensure the class removal takes effect
  void notification.offsetWidth;
  
  // Add show class to trigger animation
  notification.classList.add('show');
  
  // Hide after 3 seconds
  window.notificationTimeout = setTimeout(() => {
    notification.classList.remove('show');
  }, 3000);
}

function updateCartCount() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartCountElement = document.getElementById('cart-count');
  
  if (cartCountElement) {
    cartCountElement.textContent = totalItems;
    // Show/hide badge based on count
    if (totalItems > 0) {
      cartCountElement.style.display = 'flex';
    } else {
      cartCountElement.style.display = 'none';
    }
  }
}

function toggleCart() {
  const sidebar = document.getElementById('cart-sidebar');
  const overlay = document.getElementById('cart-overlay');
  
  if (sidebar && overlay) {
    // Toggle custom CSS classes instead of Tailwind
    if (sidebar.classList.contains('cart-sidebar-hidden')) {
      sidebar.classList.remove('cart-sidebar-hidden');
      sidebar.classList.add('cart-sidebar-visible');
      overlay.classList.remove('hidden');
    } else {
      sidebar.classList.remove('cart-sidebar-visible');
      sidebar.classList.add('cart-sidebar-hidden');
      overlay.classList.add('hidden');
    }
    
    if (sidebar.classList.contains('cart-sidebar-visible')) {
      renderCart();
    }
  }
}

function animateCart() {
  const cartIcon = document.getElementById("cartIcon");
  cartIcon.classList.add("pulse");

  setTimeout(() => {
    cartIcon.classList.remove("pulse");
  }, 400);
}

function renderCart() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const container = document.getElementById("cart-items");
  const totalElement = document.getElementById("cart-total");

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-400 py-8">
        <svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
        <p>Your cart is empty</p>
      </div>
    `;
    totalElement.textContent = "Rp 0";
    return;
  }

  container.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    total += itemTotal;
    
    container.innerHTML += `
      <div class="glass-morphism p-4 rounded-xl">
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <p class="gold-text font-semibold">${item.name}</p>
            <p class="text-sm text-gray-400">Rp ${item.price.toLocaleString()} each</p>
          </div>
          <button onclick="removeFromCart('${item.productId}')" class="text-red-400 hover:text-red-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <button onclick="updateQuantity('${item.productId}', -1)" class="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center">
              -
            </button>
            <span class="w-8 text-center">${item.quantity}</span>
            <button onclick="updateQuantity('${item.productId}', 1)" class="w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center">
              +
            </button>
          </div>
          <p class="gold-text font-semibold">Rp ${itemTotal.toLocaleString()}</p>
        </div>
      </div>
    `;
  });

  totalElement.textContent = `Rp ${total.toLocaleString()}`;
}

function updateQuantity(id, change) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  const item = cart.find(item => item.productId === id);
  
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) {
      cart = cart.filter(item => item.productId !== id);
    }
    localStorage.setItem("cart", JSON.stringify(cart));
    updateCartCount();
    renderCart();
  }
}

function clearCart() {
  localStorage.removeItem("cart");
  updateCartCount();
  renderCart();
  
  // Show confirmation message
  const chatWindow = document.getElementById('chat-window');
  const div = document.createElement('div');
  div.className = 'servant-bubble p-4 max-w-[85%] animate-fadeIn';
  div.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="w-8 h-8 rounded-full gold-bg flex items-center justify-center flex-shrink-0 mt-1">
        <svg class="w-5 h-5 text-black" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
      <div>
        <p class="text-sm font-semibold">Your royal cart has been cleared, Your Majesty.</p>
      </div>
    </div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeFromCart(id) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart = cart.filter(item => item.productId !== id);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
  renderCart();
}

// CHECKOUT FUNCTIONS
function openCheckout() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  
  if (cart.length === 0) {
    alert('Your cart is empty! Add some items first.');
    return;
  }
  
  renderCheckoutItems();
  calculateCheckoutTotals();
  
  // Load saved address if exists
  loadSavedAddress();
  
  // Close cart sidebar and open checkout modal
  toggleCart();
  
  const checkoutModal = document.getElementById('checkout-modal');
  checkoutModal.classList.remove('hidden');
  // Trigger transition
  setTimeout(() => {
    checkoutModal.classList.add('show');
  }, 10);
  document.body.style.overflow = 'hidden';
}

function closeCheckout() {
  // Save current address before closing
  saveCurrentAddress();
  
  const checkoutModal = document.getElementById('checkout-modal');
  checkoutModal.classList.remove('show');
  // Wait for transition to complete before hiding
  setTimeout(() => {
    checkoutModal.classList.add('hidden');
  }, 300);
  document.body.style.overflow = 'auto';
}

function saveCurrentAddress() {
  const addressData = {
    fullName: document.getElementById('full-name').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    postalCode: document.getElementById('postal-code').value
  };
  
  // Only save if at least one field is filled
  if (addressData.fullName || addressData.phone || addressData.address) {
    localStorage.setItem('savedAddress', JSON.stringify(addressData));
  }
}

function loadSavedAddress() {
  const savedAddress = localStorage.getItem('savedAddress');
  
  if (savedAddress) {
    const addressData = JSON.parse(savedAddress);
    let hasData = false;
    
    // Pre-fill form fields with saved data
    if (addressData.fullName) {
      document.getElementById('full-name').value = addressData.fullName;
      hasData = true;
    }
    if (addressData.phone) {
      document.getElementById('phone').value = addressData.phone;
      hasData = true;
    }
    if (addressData.address) {
      document.getElementById('address').value = addressData.address;
      hasData = true;
    }
    if (addressData.city) {
      document.getElementById('city').value = addressData.city;
      hasData = true;
    }
    if (addressData.postalCode) {
      document.getElementById('postal-code').value = addressData.postalCode;
      hasData = true;
    }
    
    // Show saved address indicator if data was loaded
    if (hasData) {
      const indicator = document.getElementById('address-saved-indicator');
      if (indicator) {
        indicator.classList.remove('hidden');
      }
    }
  }
}

function renderCheckoutItems() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const container = document.getElementById("checkout-items");
  
  container.innerHTML = "";
  let subtotal = 0;
  
  cart.forEach(item => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    
    container.innerHTML += `
      <div class="flex justify-between items-center p-3 bg-black/30 rounded-lg">
        <div class="flex-1">
          <p class="text-white font-semibold">${item.name}</p>
          <p class="text-sm text-gray-400">${item.quantity} × Rp ${item.price.toLocaleString()}</p>
        </div>
        <p class="gold-text font-semibold">Rp ${itemTotal.toLocaleString()}</p>
      </div>
    `;
  });
}

function calculateCheckoutTotals() {
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = 10000;
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + deliveryFee + tax;
  
  document.getElementById('checkout-subtotal').textContent = `Rp ${subtotal.toLocaleString()}`;
  document.getElementById('checkout-tax').textContent = `Rp ${tax.toLocaleString()}`;
  document.getElementById('checkout-total').textContent = `Rp ${total.toLocaleString()}`;
}

function validateForm() {
  const fullName = document.getElementById('full-name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const address = document.getElementById('address').value.trim();
  const city = document.getElementById('city').value.trim();
  const postalCode = document.getElementById('postal-code').value.trim();
  
  if (!fullName || !phone || !address || !city || !postalCode) {
    alert('Please fill in all required fields.');
    return false;
  }
  
  if (phone.length < 10) {
    alert('Please enter a valid phone number.');
    return false;
  }
  
  return true;
}

function processOrder() {
  if (!validateForm()) {
    return;
  }
  
  const cart = JSON.parse(localStorage.getItem("cart")) || [];
  if (cart.length === 0) {
    alert('Your cart is empty!');
    return;
  }
  
  // Save current address before processing order
  saveCurrentAddress();
  
  // Get form data
  const orderData = {
    fullName: document.getElementById('full-name').value,
    phone: document.getElementById('phone').value,
    address: document.getElementById('address').value,
    city: document.getElementById('city').value,
    postalCode: document.getElementById('postal-code').value,
    paymentMethod: document.querySelector('input[name="payment"]:checked').value,
    items: cart,
    subtotal: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    deliveryFee: 10000,
    tax: Math.round(cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 0.1),
    total: 0,
    orderDate: new Date().toISOString(),
    orderId: 'ORD' + Date.now()
  };
  
  orderData.total = orderData.subtotal + orderData.deliveryFee + orderData.tax;
  
  // Show loading
  showLoading();
  
  // Simulate order processing
  setTimeout(() => {
    hideLoading();
    showSuccess(orderData);
    clearCart();
    closeCheckout();
  }, 3000);
}

function showLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  loadingOverlay.classList.remove('hidden');
  // Trigger transition
  setTimeout(() => {
    loadingOverlay.classList.add('show');
  }, 10);
}

function hideLoading() {
  const loadingOverlay = document.getElementById('loading-overlay');
  loadingOverlay.classList.remove('show');
  // Wait for transition to complete before hiding
  setTimeout(() => {
    loadingOverlay.classList.add('hidden');
  }, 300);
}

function showSuccess(orderData) {
  const successModal = document.getElementById('success-modal');
  const orderDetails = document.getElementById('order-details');
  
  orderDetails.innerHTML = `
    <div class="space-y-2">
      <p class="text-sm"><strong>Order ID:</strong> ${orderData.orderId}</p>
      <p class="text-sm"><strong>Name:</strong> ${orderData.fullName}</p>
      <p class="text-sm"><strong>Phone:</strong> ${orderData.phone}</p>
      <p class="text-sm"><strong>Address:</strong> ${orderData.address}, ${orderData.city}</p>
      <p class="text-sm"><strong>Payment:</strong> ${orderData.paymentMethod}</p>
      <p class="text-sm"><strong>Total:</strong> <span class="gold-text">Rp ${orderData.total.toLocaleString()}</span></p>
    </div>
  `;
  
  successModal.classList.remove('hidden');
  // Trigger transition
  setTimeout(() => {
    successModal.classList.add('show');
  }, 10);
  document.body.style.overflow = 'hidden';
}

function closeSuccess() {
  const successModal = document.getElementById('success-modal');
  successModal.classList.remove('show');
  // Wait for transition to complete before hiding
  setTimeout(() => {
    successModal.classList.add('hidden');
  }, 300);
  document.body.style.overflow = 'auto';
  
  // Clear form
  document.getElementById('address-form').reset();
}

function removeLastMessage() {
  const chat = document.getElementById("chat-window");
  if (chat.lastElementChild) {
    chat.removeChild(chat.lastElementChild);
  }
}
