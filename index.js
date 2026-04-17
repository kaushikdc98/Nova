require('dotenv').config();
const express = require('express');
const { App } = require('@slack/bolt');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🌐 Express server (Render needs this)
const web = express();

web.get('/', (req, res) => {
  res.send('Nova Bot is running 🚀');
});

const PORT = process.env.PORT || 3000;
web.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

// 🔐 Check env variables
if (!process.env.SLACK_BOT_TOKEN) throw new Error("Missing SLACK_BOT_TOKEN");
if (!process.env.SLACK_APP_TOKEN) throw new Error("Missing SLACK_APP_TOKEN");
if (!process.env.GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

// 🤖 Slack App
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// 🧠 Gemini setup (WORKING MODEL)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});

// 🔁 Transliteration function
async function transliterate(text) {
  try {
    const prompt = `
Convert this into:
- English
- Telugu (in English letters only)
- Tamil (in English letters only)
- Hindi (in English letters only)

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
    return result.response.text().trim();

  } catch (err) {
    console.error("Gemini Error:", err);
    return "⚠️ Error processing request";
  }
}

// 📩 Slack message listener
slackApp.message(async ({ message, client }) => {
  try {
    if (message.subtype || message.bot_id) return;
    if (!message.text) return;

    const output = await transliterate(message.text);

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: `🌍 *Nova Transliteration Bot*\n\n${output}`,
    });

  } catch (err) {
    console.error("Slack Error:", err);
  }
});

// 🚀 Start bot
(async () => {
  try {
    console.log("🚀 Starting Slack bot...");
    await slackApp.start();
    console.log("✅ Bot is running!");
  } catch (err) {
    console.error("❌ Startup Error:", err);
  }
})();
