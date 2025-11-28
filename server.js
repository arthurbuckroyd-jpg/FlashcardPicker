const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

// Parse JSON bodies
app.use(express.json());

// Serve static files from public/
app.use(express.static("public"));

// In-memory deck store: { id: text }
// WARNING: this is wiped when the server restarts on Render free tier.
const decks = {};

// Helper to make a short random id
function makeId(len = 6) {
  return crypto.randomBytes(len).toString("base64url").slice(0, len);
}

// POST /deck  -> { text }  -> { id }
app.post("/deck", (req, res) => {
  const { text } = req.body || {};
  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Missing or empty text field" });
  }

  let id = makeId();
  // Just in case it collides, regenerate
  while (decks[id]) {
    id = makeId();
  }

  decks[id] = text;
  res.json({ id });
});

// GET /deck/:id  -> { text } | 404
app.get("/deck/:id", (req, res) => {
  const { id } = req.params;
  const text = decks[id];
  if (!text) {
    return res.status(404).json({ error: "Deck not found" });
  }
  res.json({ text });
});

// Fallback for history-style routing (not strictly needed here but harmless)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});
