require('dotenv').config();
const express = require('express');
const { App } = require('@slack/bolt');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 🌐 Express server (for Render)
const web = express();

web.get('/', (req, res) => {
  res.send('Nova Gemini Transliteration Bot is running 🚀');
});

web.listen(process.env.PORT || 3000, () => {
  console.log('🌐 Web server running');
});

// 🤖 Slack App
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// 🧠 Gemini setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// 🛑 Prevent duplicates
const processed = new Set();

// 🔥 MAIN FUNCTION
async function transliterateAll(text) {
  const prompt = `
You are a multilingual transliteration engine.

Convert the input into:
- English
- Telugu (in English letters only)
- Tamil (in English letters only)
- Hindi (in English letters only)

Strict rules:
- Use ONLY English alphabets
- Do NOT use Telugu, Tamil, or Hindi scripts
- No explanations
- Keep it natural

Output EXACTLY like:

English: ...
Telugu: ...
Tamil: ...
Hindi: ...

Message: """${text}"""
`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
}

// 📩 Slack listener
slackApp.message(async ({ message, client, logger }) => {
  try {
    if (message.subtype || message.bot_id) return;
    if (!message.text || message.text.trim().length < 2) return;

    if (processed.has(message.client_msg_id)) return;
    processed.add(message.client_msg_id);
    if (processed.size > 1000) {
      processed.delete(processed.values().next().value);
    }

    const output = await transliterateAll(message.text);

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: `🌍 *Nova Transliteration Bot*\n\n${output}`,
    });

  } catch (err) {
    logger.error(err);
  }
});

// 🚀 Start bot
(async () => {
  await slackApp.start();
  console.log('✅ Gemini Slack Bot Running!');
})();

    
