const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

app.post("/api/translate", async (req, res) => {
  const { text, target } = req.body;

  if (!text || !target) {
    return res.status(400).json({ error: "Text and target language required" });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a translator. Translate text exactly to the target language."
          },
          {
            role: "user",
            content: `Translate the following text to ${target}: "${text}"`
          }
        ],
        temperature: 0
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        }
      }
    );

    const translatedText = response.data.choices[0].message.content;
    res.json({ translatedText });
  } catch (err) {
    console.error("Translation error:", err.response?.data || err.message);
    res.status(500).json({ error: "Translation failed" });
  }
});

app.listen(4040, () => {
  console.log(`✅ Translation server running on port ${process.env.PORT}`);
});
