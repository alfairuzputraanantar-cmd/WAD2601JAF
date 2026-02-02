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

// --- LOGIKA UTAMA ---

// Fungsi mencari makanan (handleSearch)
async function handleSearch() {
    const userInput = document.getElementById('user-input'); // Cocokkan dengan ID di HTML
    const query = userInput.value.trim();
    
    if (!query) return;

    renderMessage(query, 'king');
    userInput.value = '';

    try {
        const snapshot = await db.collection("products").get();
        let products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));

        // Filter sederhana berdasarkan kata kunci
        let results = products.filter(p => 
            p.name.toLowerCase().includes(query.toLowerCase()) || 
            (p.tags && p.tags.some(tag => query.toLowerCase().includes(tag.toLowerCase())))
        );

        if (results.length > 0) {
            showWinner(results[0]); // Tampilkan hasil terbaik
        } else {
            renderMessage("Pardon me, Your Majesty. I couldn't find that specific dish.", "servant");
        }
    } catch (e) {
        console.error("Error searching:", e);
        renderMessage("The royal archives are currently locked.", "servant");
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
        <div class="p-4 bg-black/20 rounded-xl border gold-border">
            <h3 class="text-xl gold-text font-bold">${product.name}</h3>
            <p>Price: Rp ${product.price.toLocaleString()}</p>
        </div>
    `;
    resultArea.classList.remove('hidden');
}

// 3. EVENT LISTENERS (Kunci Agar Tombol Berfungsi)
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('send-btn'); // ID Tombol Discover
    const input = document.getElementById('user-input'); // ID Input Teks

    if (btn) {
        btn.addEventListener('click', handleSearch);
    }

    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }
});

// 4. Cek apakah database kosong, jika ya isi data awal
db.collection("products").limit(1).get().then(snapshot => {
    if (snapshot.empty) {
        const menu = [
            { name: "Nasi Rendang Royal", price: 25000, tags: ["spicy", "filling"] },
            { name: "Martabak Sweetness", price: 20000, tags: ["sweet", "dessert"] },
            { name: "Sate Ayam Sultan", price: 30000, tags: ["luxury", "portion"] }
        ];
        menu.forEach(item => db.collection("products").add(item));
    }
});

cart = [
  {
    productId: "abc123",
    name: "Luxury Watch",
    price: 12000000,
    quantity: 1
  }
]

// ADD TO CART LOGIC
function addToCart(product) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];

  const existing = cart.find(item => item.productId === product.id);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });
  }

  localStorage.setItem("cart", JSON.stringify(cart));
  animateCart();
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
  const container = document.getElementById("cartItems");

  container.innerHTML = "";

  cart.forEach(item => {
    container.innerHTML += `
      <div class="glass-morphism p-4 rounded-xl flex justify-between items-center">
        <div>
          <p class="gold-text font-semibold">${item.name}</p>
          <p class="text-sm text-gray-400">
            ${item.quantity} × Rp ${item.price.toLocaleString()}
          </p>
        </div>
        <button onclick="removeFromCart('${item.productId}')" class="text-red-400">
          Remove
        </button>
      </div>
    `;
  });
}

function removeFromCart(id) {
  let cart = JSON.parse(localStorage.getItem("cart")) || [];
  cart = cart.filter(item => item.productId !== id);
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}
