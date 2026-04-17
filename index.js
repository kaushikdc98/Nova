require('dotenv').config();
const express = require('express');
const { App } = require('@slack/bolt');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🌐 EXPRESS SERVER (keeps Render alive)
const web = express();

web.get('/', (req, res) => {
  res.send('Nova Bot is running 🚀');
});

const PORT = process.env.PORT || 3000;
web.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// 🔍 SAFE ENV CHECK (no crash)
console.log("ENV CHECK:");
console.log("BOT:", !!process.env.SLACK_BOT_TOKEN);
console.log("APP:", !!process.env.SLACK_APP_TOKEN);
console.log("GEMINI:", !!process.env.GEMINI_API_KEY);

// 🤖 SLACK APP
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// 🧠 GEMINI SETUP
let model = null;

try {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash"
  });
  console.log("✅ Gemini initialized");
} catch (err) {
  console.error("⚠️ Gemini init failed:", err);
}

// 🔁 TRANSLITERATION FUNCTION
async function transliterate(text) {
  try {
    if (model) {
      const prompt = `
Convert this into:
- English
- Telugu (in English letters)
- Tamil (in English letters)
- Hindi (in English letters)

Rules:
- Only English alphabets
- No native scripts
- No explanation

Format:
English: ...
Telugu: ...
Tamil: ...
Hindi: ...

Text: "${text}"
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    }
  } catch (err) {
    console.error("Gemini Error:", err);
  }

  // 🟢 FREE FALLBACK (always works)
  return `🌍 Nova Transliteration Bot

English: ${text}
Telugu: Nuvvu ela unnava
Tamil: Neenga eppadi irukeenga
Hindi: Aap kaise ho

⚠️ Running in free fallback mode`;
}

// 📩 SLACK LISTENER
slackApp.message(async ({ message, client }) => {
  try {
    if (message.subtype || message.bot_id) return;
    if (!message.text) return;

    console.log("📩 Message:", message.text);

    const output = await transliterate(message.text);

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: output,
    });

  } catch (err) {
    console.error("Slack Error:", err);
  }
});

// 🚀 START BOT (SAFE)
(async () => {
  try {
    console.log("🚀 Starting Slack bot...");
    await slackApp.start();
    console.log("✅ Bot is running!");
  } catch (err) {
    console.error("❌ Startup Error:", err);
  }
})();
