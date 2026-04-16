const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

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

  const prompt = `You are a translation assistant. Translate the following ${detectedLang} text into ${targets.join(", ")}.
Text: "${text}"
Respond ONLY with a JSON object like this (no markdown, no extra text):
${JSON.stringify(exampleObj)}`;

  console.log("==> Calling Gemini API...");
  console.log("==> GEMINI_API_KEY set:", !!GEMINI_API_KEY);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  console.log("==> URL model: gemini-2.0-flash");

  const response = await axios.post(
    url,
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } },
    { headers: { "Content-Type": "application/json" } }
  );

  const raw = response.data.candidates[0].content.parts[0].text;
  console.log("==> Gemini raw text:", raw);
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in Gemini response");
  return JSON.parse(jsonMatch[0]);
}

async function postToSlack(channel, text) {
  const result = await axios.post(
    "https://slack.com/api/chat.postMessage",
    { channel, text },
    { headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` } }
  );
  console.log("==> Slack post result:", JSON.stringify(result.data));
}

const processedEvents = new Set();

app.post("/slack/events", async (req, res) => {
  console.log("==> Incoming event:", JSON.stringify(req.body));
  const { type, challenge, event } = req.body;

  if (type === "url_verification") return res.json({ challenge });

  res.sendStatus(200);

  if (!event || event.type !== "app_mention" || event.bot_id) return;
  if (processedEvents.has(event.client_msg_id)) return;

  processedEvents.add(event.client_msg_id);
  setTimeout(() => processedEvents.delete(event.client_msg_id), 60000);

  const userText = event.text.replace(/<@[^>]+>\s*/g, "").trim();
  console.log("==> User text:", userText);

  if (!userText) {
    return postToSlack(event.channel, "Please mention me with some text. Example: `@Nova Hello!`");
  }

  try {
    const detectedLang = detectLang(userText);
    console.log("==> Detected language:", detectedLang);

    const translations = await translateText(userText, detectedLang);
    const langEmoji = { English: "🇬🇧", Hindi: "🇮🇳", Telugu: "🌸", Tamil: "🌴" };

    let reply = `*Detected language:* ${langEmoji[detectedLang]} ${detectedLang}\n\n`;
    for (const [lang, text] of Object.entries(translations)) {
      reply += `${langEmoji[lang]} *${lang}:*\n${text}\n\n`;
    }

    await postToSlack(event.channel, reply);
    console.log("==> Reply sent successfully!");
  } catch (err) {
    console.error("==> Error:", err.response?.data || err.message);
    await postToSlack(event.channel, "Sorry, I couldn't translate that. Please try again.");
  }
});

app.get("/", (req, res) => res.send("Nova is running with Gemini 2.0!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Nova bot listening on port ${PORT}`));
