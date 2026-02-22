const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

// ===== FIREBASE SETUP =====
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ===== GET MENU FROM FIRESTORE =====
async function getMenuFromDB() {
  const snapshot = await db.collection("products").get();

  let menu = "";

  snapshot.forEach(doc => {
    const data = doc.data();

    menu += `
Name: ${data.name}
Price: ${data.price}
Category: ${data.category}
Description: ${data.description}
`;
  });

  return menu;
}

// ===== EXPRESS SERVER =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== CHAT ENDPOINT =====
app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.json({ reply: "Message is empty." });
  }

  try {
    // 🔥 Fetch menu from database
    const menuData = await getMenuFromDB();

    // 🔥 AI PROMPT
    const prompt = `
You are a restaurant AI assistant.

IMPORTANT RULES:
- Only recommend food from the provided menu.
- Never invent new food items.
- Answer clearly and briefly.
- Act like a professional restaurant waiter.

RESTAURANT MENU:
${menuData}

Customer Question:
${userMessage}

Assistant Response:
`;

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "phi3:mini",
        prompt: prompt,
        stream: false
      })
    });

    const data = await response.json();

    res.json({
      reply: data.response
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      reply: "AI service is currently unavailable."
    });
  }
});

// ===== START SERVER =====
app.listen(3000, () => {
  console.log("✅ Server running at http://localhost:3000");
});