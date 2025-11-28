// =============
// THEME SETUP
// =============

const THEMES = [
    { id: "midnight", name: "Midnight Blue" },
    { id: "mint",     name: "Pastel Mint" },
    { id: "solar",    name: "Solarized" },
    { id: "terminal", name: "Terminal Green" },
    { id: "royal",    name: "Royal Purple" },
    { id: "mango",    name: "Mango Sunset" },
    { id: "vapor",    name: "Vaporwave" },
    { id: "sakura",   name: "Sakura Pink" },
    { id: "cyber",    name: "Cyberpunk Grid" }
];

const THEME_KEY = "fg_theme_v1";

// =============
// STATE
// =============

let groups = [];           
let activeTags = new Set();
let flatActiveItems = [];  
let currentIndex = -1;

// Leitner spaced repetition model
let leitner = [];

const textarea    = document.getElementById("groupsInput");
const statsEl     = document.getElementById("stats");
const flashcard   = document.getElementById("flashcard");
const metaGroupEl = document.getElementById("metaGroup");
const metaItemEl  = document.getElementById("metaItem");
const tagListEl   = document.getElementById("tagList");
const themeSelect = document.getElementById("themeSelect");

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;

// =============
// INIT
// =============

initThemeSelector();
restoreTheme();
wireEvents();
loadFromURL();
parseInput();
smartPick();

// =============
// THEME LOGIC
// =============

function initThemeSelector() {
    THEMES.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        themeSelect.appendChild(opt);
    });

    themeSelect.addEventListener("change", () => {
        const id = themeSelect.value;
        applyTheme(id);
        saveTheme(id);
        playSound("move");
    });
}

function saveTheme(id) {
    try {
        localStorage.setItem(THEME_KEY, id);
    } catch {}
}

function restoreTheme() {
    let id = null;
    try {
        id = localStorage.getItem(THEME_KEY);
    } catch {}
    if (!id || !THEMES.find(t => t.id === id)) {
        id = "midnight";
    }
    applyTheme(id);
    themeSelect.value = id;
}

function applyTheme(id) {
    document.documentElement.setAttribute("data-theme", id);
}

// =============
// PARSE INPUT
// =============

function isDividerLine(line) {
    return /^[-─_=]{3,}$/.test(line);
}

function parseInput() {
    const raw = textarea.value || "";

    const blocks = raw
        .replace(/^[─\-_]{3,}$/gm, "")
        .split(/\n\s*\n/);

    const newGroups = [];

    for (const block of blocks) {
        let lines = block
            .split("\n")
            .map(l => l.trim())
            .filter(l => l.length > 0 && !isDividerLine(l));

        if (!lines.length) continue;

        let tag = "default";

        if (lines[0].startsWith("#")) {
            tag = lines[0].slice(1).trim() || "default";
            lines.shift();
        }

        if (!lines.length) continue;

        newGroups.push({ tag, items: lines });
    }

    groups = newGroups;

    // Build Leitner structure
    leitner = groups.map(g =>
        g.items.map(() => ({
            box: 1,
            correct: 0,
            wrong: 0
        }))
    );

    rebuildTagList();
    rebuildActiveItems();
    updateStats();

    if (!flatActiveItems.length) {
        flashcard.textContent = "No active items. Add groups or tags.";
        metaGroupEl.textContent = "No group";
        metaItemEl.textContent = "No item";
    }
}

// =============
// TAG HANDLING
// =============

function rebuildTagList() {
    const tags = [...new Set(groups.map(g => g.tag))];
    tagListEl.innerHTML = "";

    tags.forEach(tag => {
        const pill = document.createElement("div");
        pill.className = "tag-pill";

        const isActive = activeTags.size === 0 || activeTags.has(tag);
        if (isActive) pill.classList.add("active");

        pill.textContent = tag;
        pill.addEventListener("click", () => {
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
            } else {
                activeTags.add(tag);
            }
            if (activeTags.size === 0) {
                activeTags = new Set();
            }
            rebuildTagList();
            rebuildActiveItems();
            smartPick();
            playSound("move");
        });

        tagListEl.appendChild(pill);
    });
}

function tagIsActive(tag) {
    if (activeTags.size === 0) return true;
    return activeTags.has(tag);
}

function rebuildActiveItems() {
    flatActiveItems = [];

    groups.forEach((g, gi) => {
        if (!tagIsActive(g.tag)) return;
        g.items.forEach((item, ii) => {
            flatActiveItems.push({ groupIndex: gi, itemIndex: ii, value: item });
        });
    });

    if (!flatActiveItems.length) {
        currentIndex = -1;
    } else if (currentIndex >= flatActiveItems.length) {
        currentIndex = 0;
    }
}

// =============
// SPACED REPETITION (SMART PICK)
// =============

function smartPick() {
    if (!flatActiveItems.length) return;

    const candidates = [];

    for (let idx = 0; idx < flatActiveItems.length; idx++) {
        const { groupIndex: gi, itemIndex: ii } = flatActiveItems[idx];
        const card = leitner[gi][ii];

        const box = Math.max(1, card.box);
        let weight = 1 / (box * box);

        if (card.correct === 0 && card.wrong === 0) {
            weight *= 1.4;
        }

        candidates.push({ idx, weight });
    }

    const total = candidates.reduce((s, c) => s + c.weight, 0);
    let r = Math.random() * total;

    for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) {
            currentIndex = c.idx;
            updateCard("flip");
            return;
        }
    }
}

// =============
// CONFIDENT / NOT CONFIDENT
// =============

function markConfident() {
    if (currentIndex < 0) return;
    const { groupIndex: gi, itemIndex: ii } = flatActiveItems[currentIndex];
    const card = leitner[gi][ii];

    card.correct++;
    if (card.box < 5) card.box++;

    smartPick();
}

function markNotConfident() {
    if (currentIndex < 0) return;
    const { groupIndex: gi, itemIndex: ii } = flatActiveItems[currentIndex];
    const card = leitner[gi][ii];

    card.wrong++;
    card.box = 1;

    smartPick();
}

// =============
// NAVIGATION
// =============

function move(offset) {
    if (!flatActiveItems.length) return;

    if (currentIndex === -1) currentIndex = 0;
    else currentIndex = (currentIndex + offset + flatActiveItems.length) % flatActiveItems.length;

    const anim = offset < 0 ? "slide-left" : "slide-right";
    updateCard(anim);
}

// =============
// CARD RENDER
// =============

function updateCard(animClass) {
    if (currentIndex < 0 || !flatActiveItems.length) {
        flashcard.textContent = "No active items.";
        metaGroupEl.textContent = "No group";
        metaItemEl.textContent = "No item";
        return;
    }

    const entry = flatActiveItems[currentIndex];
    const group = groups[entry.groupIndex];

    flashcard.textContent = entry.value;
    metaGroupEl.textContent = `Group: ${group.tag}`;
    metaItemEl.textContent = `Item ${entry.itemIndex + 1} of ${group.items.length}`;

    if (animClass) {
        flashcard.classList.remove("flip", "slide-left", "slide-right");
        void flashcard.offsetWidth;
        flashcard.classList.add(animClass);
    }

    playSound("flip");
}

function updateStats() {
    const groupCount = groups.length;
    const itemCount = groups.reduce((sum, g) => sum + g.items.length, 0);
    const tags = new Set(groups.map(g => g.tag));

    statsEl.textContent =
        `${groupCount} group${groupCount !== 1 ? "s" : ""} • ` +
        `${itemCount} item${itemCount !== 1 ? "s" : ""} • ` +
        `${tags.size} tag${tags.size !== 1 ? "s" : ""}`;
}

// =============
// SAVE / LOAD CODE
// =============

function handleSaveCode() {
    const text = textarea.value.trim();
    if (!text) {
        alert("Nothing to save.");
        return;
    }
    const code = LZString.compressToBase64(JSON.stringify({ text }));
    navigator.clipboard?.writeText(code).catch(() => {});
    alert("Save code copied (if allowed).");
    playSound("ok");
}

function handleLoadCode() {
    const code = document.getElementById("loadInput").value.trim();
    if (!code) return;

    try {
        const json = LZString.decompressFromBase64(code);
        if (!json) throw new Error("empty");
        const data = JSON.parse(json);
        textarea.value = data.text || "";
        parseInput();
        smartPick();
        playSound("ok");
        alert("Loaded.");
    } catch {
        playSound("error");
        alert("Invalid code.");
    }
}

// =============
// SHARE LINKS (SERVER)
// =============

async function handleShareLink() {
    const text = textarea.value.trim();
    if (!text) {
        alert("Nothing to share.");
        return;
    }

    try {
        const res = await fetch("/deck", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!res.ok) {
            playSound("error");
            alert("Server error.");
            return;
        }

        const data = await res.json();
        const id = data.id;
        const url = window.location.origin + "?id=" + encodeURIComponent(id);

        navigator.clipboard?.writeText(url).catch(() => {});
        playSound("ok");
        alert("Share link copied.");
    } catch {
        playSound("error");
        alert("Network error.");
    }
}

async function loadFromURL() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) return;

    try {
        const res = await fetch("/deck/" + encodeURIComponent(id));
        if (!res.ok) return;
        const data = await res.json();
        textarea.value = data.text || "";
        parseInput();
        smartPick();
    } catch {}
}

// =============
// TEXTAREA DIVIDER
// =============

textarea.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;

    const value = textarea.value;
    const pos = textarea.selectionStart;

    const before = value.slice(0, pos);
    const lineStart = before.lastIndexOf("\n") + 1;
    const currentLine = before.slice(lineStart);

    if (currentLine.trim().length === 0) {
        e.preventDefault();
        const divider = "──────────────";
        const insert = divider + "\n";
        const newValue = value.slice(0, pos) + insert + value.slice(pos);
        textarea.value = newValue;
        const newPos = pos + insert.length;
        textarea.setSelectionRange(newPos, newPos);
        parseInput();
    }
});

textarea.addEventListener("input", () => {
    parseInput();
});

// =============
// SOUND EFFECTS
// =============

function playSound(type) {
    if (!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        let freq = 440;

        if (type === "flip") freq = 520;
        else if (type === "move") freq = 360;
        else if (type === "ok") freq = 680;
        else if (type === "error") freq = 220;

        osc.frequency.value = freq;

        const now = audioCtx.currentTime;
        gain.gain.setValueAtTime(0.0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
    } catch {}
}

// =============
// WIRING
// =============

function wireEvents() {
    document.getElementById("startBtn").addEventListener("click", () => {
        parseInput();
        smartPick();
    });

    document.getElementById("randomGroupBtn").addEventListener("click", () => {
        smartPick();
    });

    document.getElementById("leftArrow").addEventListener("click", () => {
        move(-1);
    });

    document.getElementById("rightArrow").addEventListener("click", () => {
        move(1);
    });

    document.getElementById("saveBtn").addEventListener("click", handleSaveCode);
    document.getElementById("loadBtn").addEventListener("click", handleLoadCode);
    document.getElementById("shareBtn").addEventListener("click", handleShareLink);

    document.getElementById("confBtn").addEventListener("click", markConfident);
    document.getElementById("notConfBtn").addEventListener("click", markNotConfident);

    document.addEventListener("keydown", (e) => {
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "textarea" || tag === "input" || tag === "select") return;

        if (e.key === "ArrowLeft") {
            e.preventDefault();
            move(-1);
        } else if (e.key === "ArrowRight") {
            e.preventDefault();
            move(1);
        } else if (e.key.toLowerCase() === "r") {
            e.preventDefault();
            smartPick();
        }
    });
}
