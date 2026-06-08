import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/mark", async (req, res) => {
  const { question, answer, marks } = req.body;

  const prompt = `
You are an AQA A-level physics examiner.

Mark this answer strictly using physics mark scheme logic.

Question:
${question}

Student answer:
${answer}

Available marks: ${marks}

Return JSON ONLY in this format:
{
  "score": number,
  "max": number,
  "feedback": "short examiner-style feedback",
  "missing_points": ["..."]
}
`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0
    });

    const text = response.choices[0].message.content;

    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: "Marking failed", details: err.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});