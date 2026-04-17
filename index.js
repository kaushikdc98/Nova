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
    console.error("❌ Gemini failed:", err);

    // 🔥 FREE FALLBACK LOGIC

    const lower = text.toLowerCase();

    // basic patterns
    if (lower.includes("hi") || lower.includes("hello")) {
      return `🌍 *Nova Transliteration Bot*

English: Hello
Telugu: Nuvvu ela unnava
Tamil: Vanakkam eppadi irukeenga
Hindi: Namaste aap kaise ho`;
    }

    if (lower.includes("how are you")) {
      return `🌍 *Nova Transliteration Bot*

English: How are you
Telugu: Nuvvu ela unnava
Tamil: Neenga eppadi irukeenga
Hindi: Aap kaise ho`;
    }

    // default fallback
    return `🌍 *Nova Transliteration Bot*

English: ${text}
Telugu: (approx) Nuvvu ela unnava
Tamil: (approx) Neenga eppadi irukeenga
Hindi: (approx) Aap kaise ho

⚠️ AI unavailable (free fallback mode)`;
  }
}
