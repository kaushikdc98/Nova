const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const LANGUAGES = ["English", "Hindi", "Telugu", "Tamil"];

function detectLang(text) {
  if (/[\u0B80-\u0BFF]/.test(text)) return "Tamil";
  if (/[\u0C00-\u0C7F]/.test(text)) return "Telugu";
  if (/[\u0900-\u097F]/.test(text)) return "Hindi";
  return "English";
}

async function translateText(text, detectedLang) {
  const targets = LANGUAGES.filter(l => l !== detectedLang);
  const exampleObj = targets.reduce((acc, l) => ({ ...acc, [l]: "translation here" }), {});

  const response = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a translation assistant. Translate the following ${detectedLang} text into ${targets.join(", ")}.

Text: "${text}"

Respond ONLY with a JSON object like this (no markdown, no extra text):
${JSON.stringify(exampleObj)}`
        }
      ]
    },
    {
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      }
    }
  );

  const raw = response.data.content.map(b => b.text || "").join("");
  const clean = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function postToSlack(channel, text) {
  const result = await axios.post(
    "https://slack.com/api/chat.postMessage",
    { channel, text },
    { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
  );
  console.log("Slack post result:", JSON.stringify(result.data));
}

const processedEvents = new Set();

app.post("/slack/events", async (req, res) => {
  console.log("==> Incoming request body:", JSON.stringify(req.body));

  const { type, challenge, event } = req.body;

  if (type === "url_verification") {
    console.log("==> URL verification challenge received");
    return res.json({ challenge });
  }

  res.sendStatus(200);

  if (!event) {
    console.log("==> No event in payload, skipping");
    return;
  }

  console.log("==> Event type:", event.type, "| bot_id:", event.bot_id);

  if (event.type !== "app_mention" || event.bot_id) {
    console.log("==> Skipping — not an app_mention or is a bot message");
    return;
  }

  if (processedEvents.has(event.client_msg_id)) {
    console.log("==> Duplicate event, skipping");
    return;
  }
  processedEvents.add(event.client_msg_id);
  setTimeout(() => processedEvents.delete(event.client_msg_id), 60000);

  const userText = event.text.replace(/<@[^>]+>\s*/g, "").trim();
  console.log("==> User text after stripping mention:", userText);

  if (!userText) {
    return postToSlack(event.channel, "Please mention me with some text. Example: `@Nova Hello, how are you?`");
  }

  try {
    const detectedLang = detectLang(userText);
    console.log("==> Detected language:", detectedLang);

    const translations = await translateText(userText, detectedLang);
    console.log("==> Translations received:", JSON.stringify(translations));

    const langEmoji = { English: "🇬🇧", Hindi: "🇮🇳", Telugu: "🌸", Tamil: "🌴" };
    let reply = `*Detected language:* ${langEmoji[detectedLang]} ${detectedLang}\n\n`;
    for (const [lang, text] of Object.entries(translations)) {
      reply += `${langEmoji[lang]} *${lang}:*\n${text}\n\n`;
    }

    await postToSlack(event.channel, reply);
    console.log("==> Reply sent successfully");
  } catch (err) {
    console.error("==> Translation error:", err.response?.data || err.message);
    await postToSlack(event.channel, "Sorry, I couldn't translate that. Please try again.");
  }
});

app.get("/", (req, res) => {
  console.log("==> Health check hit");
  res.send("Nova Translation Bot is running!");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Nova bot listening on port ${PORT}`));
