import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// in-memory store (gets wiped when server restarts)
// swap this for a real DB later if you want
const store = {};

function makeCode() {
  return crypto.randomBytes(3).toString("hex");
}

app.post("/save", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text" });

  const code = makeCode();
  store[code] = text;

  res.json({ code });
});

app.get("/load/:code", (req, res) => {
  const code = req.params.code;
  const text = store[code];

  if (!text) return res.status(404).json({ error: "Code not found" });

  res.json({ text });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on " + port));