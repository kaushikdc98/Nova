const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post("/slack/events", async (req, res) => {
  const body = req.body;

  // Slack verification
  if (body.type === "url_verification") {
    return res.send({ challenge: body.challenge });
  }

  // When bot is mentioned
  if (body.event && body.event.type === "app_mention") {
    const text = body.event.text;
    const channel = body.event.channel;

    const cleanText = text.split(">")[1] || "";

    try {
      const response = await axios.get(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=auto|en`
      );

      const translated = response.data.responseData.translatedText;

      await axios.post(
        "https://slack.com/api/chat.postMessage",
        {
          channel: channel,
          text: `🌍 Translated: ${translated}`
        },
        {
          headers: {
            Authorization: `Bearer YOUR_BOT_TOKEN`,
            "Content-Type": "application/json"
          }
        }
      );
    } catch (err) {
      console.error(err);
    }
  }

  res.sendStatus(200);
});

// IMPORTANT for Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running..."));
