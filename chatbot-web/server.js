const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage) {
    return res.json({ reply: "❌ Pesan kosong" });
  }

  try {
    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "phi3:mini",   // model kamu
        prompt: userMessage,
        stream: false
      })
    });

    const data = await response.json();

    res.json({
  reply: data.response
});

  } catch (err) {
    console.error(err);
    res.status(500).json({
      reply: "❌ Ollama tidak terhubung"
    });
  }
});

app.listen(3000, () => {
  console.log("✅ Server jalan di http://localhost:3000");
});
