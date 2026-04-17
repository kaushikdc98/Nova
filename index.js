require('dotenv').config();
const express = require('express');
const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');

// 🌐 Express server (RENDER FIX)
const web = express();

web.get('/', (req, res) => {
  res.send('Nova Transliteration Bot is running 🚀');
});

web.listen(process.env.PORT || 3000, () => {
  console.log('🌐 Web server running');
});

// 🤖 Slack App (Socket Mode)
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

// 🧠 Claude Client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// 🛑 Prevent duplicate messages
const processed = new Set();

// 🔥 MAIN FUNCTION (MULTI LANGUAGE TRANSLITERATION)
async function transliterateAll(text) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are a multilingual transliteration engine.

Convert the input into:
- English
- Telugu (in English letters only)
- Tamil (in English letters only)
- Hindi (in English letters only)

Strict rules:
- Use ONLY English alphabets
- Do NOT use Telugu, Tamil, or Hindi scripts
- Do NOT explain anything
- Keep it short and natural

Output EXACTLY like this:

English: ...
Telugu: ...
Tamil: ...
Hindi: ...

Message: """${text}"""`,
      },
    ],
  });

  return response.content[0].text.trim();
}

// 📩 Slack Listener
slackApp.message(async ({ message, client, logger }) => {
  try {
    if (message.subtype || message.bot_id) return;
    if (!message.text || message.text.trim().length < 2) return;

    // prevent duplicates
    if (processed.has(message.client_msg_id)) return;
    processed.add(message.client_msg_id);
    if (processed.size > 1000) {
      processed.delete(processed.values().next().value);
    }

    const result = await transliterateAll(message.text);

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: `🌍 *Multi-language Transliteration*\n\n${result}`,
    });

  } catch (error) {
    logger.error('Error:', error);
  }
});

// 🚀 START SLACK BOT
(async () => {
  await slackApp.start();
  console.log('✅ Nova Bot is running in Socket Mode!');
})();
