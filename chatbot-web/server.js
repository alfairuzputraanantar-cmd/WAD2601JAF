const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

app.use(express.static(path.join(__dirname, "..")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "..", "index.html")));
app.use((req, res, next) => { console.log(req.method, req.url); next(); });

app.get("/products", async (req, res) => {
  try {
    const snapshot = await db.collection("products").get();
    const products = [];
    snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

async function getOllamaModel() {
  try {
    const res = await fetch("http://localhost:11434/api/tags");
    const data = await res.json();
    if (data.models && data.models.length > 0) return data.models[0].name;
  } catch (e) {}
  return "qwen2.5:1.5b";
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message || "";
    const context = req.body.context || [];

    const snapshot = await db.collection("products").get();
    const allProducts = [];
    const seenNames = new Set();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (!seenNames.has(data.name)) { seenNames.add(data.name); allProducts.push({ id: doc.id, ...data }); }
    });

    const productListStr = allProducts.map(p => `- ${p.name} (Rp ${Number(p.price).toLocaleString()})`).join("\n");
    const conversationHistory = context.slice(-6).map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");

    // Detect if user is actually requesting food
    const isFoodRequest = userWantsFood(userMessage);

    const systemPrompt = `You are a friendly food ordering assistant for "Tempat.", a premium Indonesian food platform. Your tone is warm and slightly royal.

Available menu:
${productListStr}

STRICT RULES:
- Respond in English only
- Keep response to 1-2 sentences max
- ONLY mention food/products if the user is clearly asking for food, hungry, or requesting a recommendation
- If the user says greetings (hi, hello, hey), respond with a warm greeting ONLY — do NOT mention any food
- If the user says thanks, thank you, ok, alright, bye, goodbye, cool, great — respond politely ONLY — do NOT mention any food
- If the user is just chatting (not asking for food), respond naturally without recommending anything
- When you DO recommend food, use the exact product names from the menu above`;

    const prompt = conversationHistory
      ? `${conversationHistory}\nUser: ${userMessage}\nAssistant:`
      : `User: ${userMessage}\nAssistant:`;

    const model = await getOllamaModel();

    const ollamaRes = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, system: systemPrompt, prompt, stream: false, options: { temperature: 0.7, num_predict: 150 } }),
    });

    let aiReply = "";
    if (ollamaRes.ok) {
      const ollamaData = await ollamaRes.json();
      aiReply = (ollamaData.response?.trim() || "").replace(/^(Assistant:|assistant:)\s*/i, "");
    } else {
      throw new Error("Ollama failed: " + ollamaRes.status);
    }

    // Only show products if user actually asked for food
    let productsToShow = [];
    if (isFoodRequest) {
      productsToShow = findMentionedProducts(aiReply, allProducts);
      if (productsToShow.length === 0) {
        productsToShow = partialMatchProducts(userMessage, allProducts).slice(0, 3);
      }
    }

    console.log("Food request:", isFoodRequest, "| Products:", productsToShow.map(p => p.name));
    res.json({ reply: aiReply, products: productsToShow });

  } catch (error) {
    console.error("ERROR:", error);
    res.status(500).json({ reply: "I'm having a moment, Your Majesty. Please try again!", products: [] });
  }
});

app.post("/order", async (req, res) => {
  try {
    const orderData = req.body;
    orderData.createdAt = admin.firestore.FieldValue.serverTimestamp();
    const docRef = await db.collection("orders").add(orderData);
    res.json({ success: true, orderId: orderData.orderId || docRef.id });
  } catch (error) { res.status(500).json({ success: false, error: error.message }); }
});

function findMentionedProducts(text, products) {
  const lower = text.toLowerCase();
  return products.filter(p => lower.includes(p.name.toLowerCase()));
}

function userWantsFood(message) {
  const lower = message.toLowerCase().trim();
  const nonFood = ['thank','thanks','thx','ok','okay','alright','cool','great','nice','sure','bye','goodbye','see you','later','noted','got it','hello','hi','hey','halo','hai','how are you'];
  if (nonFood.some(p => lower === p || lower === p+'!' || lower === p+'.')) return false;
  if (lower.length < 4) return false;
  const foodKw = ['food','eat','hungry','meal','dinner','lunch','breakfast','snack','drink','recommend','suggest','want','order','craving','makan','lapar','sweet','spicy','healthy','quick','cheap','budget','luxury','premium','chicken','beef','rice','noodle','soup','dessert','ayam','sate','bakso','mie','rendang','gado','soto','martabak','pisang','teler','menu','show me','what do you have'];
  return foodKw.some(k => lower.includes(k));
}

function partialMatchProducts(userMessage, products) {
  const lower = userMessage.toLowerCase();
  const keywordMap = {
    sweet: ["sweet","dessert","chocolate","manis"],
    spicy: ["spicy","hot","pedas"],
    quick: ["quick","fast","cepat"],
    healthy: ["healthy","vegetarian","vegan","salad"],
    luxury: ["luxury","premium","mewah"],
    budget: ["cheap","murah","affordable","budget"],
  };
  let matchContext = null;
  for (const [ctx, words] of Object.entries(keywordMap)) {
    if (words.some(w => lower.includes(w))) { matchContext = ctx; break; }
  }
  return products.filter(p => {
    const tags = (p.tags || []).map(t => t.toLowerCase());
    if (matchContext) return tags.includes(matchContext) || p.name.toLowerCase().includes(matchContext);
    return tags.includes("popular") || tags.includes("filling");
  }).slice(0, 3);
}

app.listen(5000, () => console.log("✅ Server running at http://localhost:5000"));