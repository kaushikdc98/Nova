 require('dotenv').config();
const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const processed = new Set();

async function detectAndTransliterate(text) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `You are a transliteration assistant for Indian languages.
Detect the language (Tamil, Telugu, Hindi, or English).
If NOT in Roman script, transliterate phonetically into Roman letters.
If already in Roman/English script, respond with NO_TRANSLITERATION_NEEDED.

DO NOT translate — only romanize the sounds.
Examples:
- "வணக்கம்" → "Vanakkam"
- "నమస్కారం" → "Namaskaram"
- "धन्यवाद" → "Dhanyavaad"

Respond ONLY in this JSON format, nothing else:
{
  "detected_language": "<Tamil|Telugu|Hindi|English>",
  "transliteration": "<romanized text or NO_TRANSLITERATION_NEEDED>"
}

Message: """${text}"""`
    }],
  });

  return JSON.parse(response.content[0].text.trim());
}

app.message(async ({ message, client, logger }) => {
  try {
    if (message.subtype || message.bot_id) return;
    if (processed.has(message.client_msg_id)) return;
    if (!message.text || message.text.trim().length < 2) return;

    processed.add(message.client_msg_id);
    if (processed.size > 1000) processed.delete(processed.values().next().value);

    const result = await detectAndTransliterate(message.text);

    if (result.transliteration === 'NO_TRANSLITERATION_NEEDED') return;

    await client.chat.postMessage({
      channel: message.channel,
      thread_ts: message.ts,
      text: `🔤 *${result.detected_language}* → ${result.transliteration}`,
    });

  } catch (err) {
    logger.error('Error:', err);
  }
});

(async () => {
  await app.start();
  console.log('✅ Transliteration bot is running!');
})();
