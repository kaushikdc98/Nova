require('dotenv').config();
const express = require('express');
const { App } = require('@slack/bolt');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Catch crashes before they kill the process silently
process.on('unhandledRejection', (err) => console.error('Unhandled:', err));
process.on('uncaughtException', (err) => console.error('Exception:', err));

// Express keeps Render happy (it needs an HTTP server)
const web = express();
web.get('/', (_, res) => res.send('Nova Bot is alive'));
web.listen(process.env.PORT || 3000, () =>
  console.log('HTTP server ready on port', process.env.PORT || 3000)
);

// Slack + Gemini setup
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function transliterate(text) {
  const prompt = `Transliterate the following text into romanized (English letters only):
- Telugu (romanized)
- Tamil (romanized)
- Hindi (romanized)

Rules:
- Use only English alphabet letters (a-z)
- No native scripts, no symbols, no explanation
- If the word is already English, keep it as-is

Format exactly like this:
English: <original or closest English>
Telugu: <romanized Telugu>
Tamil: <romanized Tamil>
Hindi: <romanized Hindi>

Text: "${text}"`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

slackApp.message(async ({ message, client, logger }) => {
  try {
    if (message.subtype || message.bot_id || !message.text) return;
    const output = await transliterate(message.text);
    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: output,
    });
  } catch (err) {
    logger.error('Error:', err);
  }
});

(async () => {
  try {
    await slackApp.start();
    console.log('Nova Bot is running!');
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
})();
