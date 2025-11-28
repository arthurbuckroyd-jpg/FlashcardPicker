const express = require("express");
const path = require("path");
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.static("public"));

// In-memory deck store
const decks = {};

function makeId(len = 6) {
    return crypto.randomBytes(len)
        .toString("base64url")
        .slice(0, len);
}

app.post("/deck", (req, res) => {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing text" });
    }

    let id = makeId();
    while (decks[id]) id = makeId();

    decks[id] = text;
    res.json({ id });
});

app.get("/deck/:id", (req, res) => {
    const t = decks[req.params.id];
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json({ text: t });
});

// fallback
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server on " + PORT));
