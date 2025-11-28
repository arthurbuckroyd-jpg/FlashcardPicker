// ========================
// STATE
// ========================

let groups = [];                 // Array of groups, each = array of strings
let leitner = [];                // Same shape as groups: {box, correct, wrong}
let currentGroupIndex = -1;
let currentItemIndex = -1;

let sessionStart = null;
let flipsCount = 0;
let againCount = 0;
let gotItCount = 0;

const textarea = document.getElementById("groupsInput");
const flashcardEl = document.getElementById("flashcard");
const statsEl = document.getElementById("stats");
const metaGroupEl = document.getElementById("metaGroup");
const metaItemEl = document.getElementById("metaItem");
const sessionMetaEl = document.getElementById("sessionMeta");
const themeSelect = document.getElementById("themeSelect");
const appRoot = document.getElementById("appRoot");

// Simple Web Audio-based sound effects
const audioCtx = (window.AudioContext || window.webkitAudioContext)
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

// ========================
// INIT
// ========================

document.getElementById("startBtn").addEventListener("click", () => {
    parseInput();
    smartPickCard();
});

document.getElementById("randomGroupBtn").addEventListener("click", () => {
    if (!groups.length) parseInput();
    pickRandomGroupOnly();
});

document.getElementById("shuffleBtn").addEventListener("click", () => {
    if (currentGroupIndex < 0) return;
    shuffleCurrentGroup();
});

document.getElementById("arrowLeft").addEventListener("click", () => shiftCard(-1));
document.getElementById("arrowRight").addEventListener("click", () => shiftCard(1));

document.getElementById("againBtn").addEventListener("click", () => markAgain());
document.getElementById("gotItBtn").addEventListener("click", () => markGotIt());

document.getElementById("saveBtn").addEventListener("click", handleSaveCode);
document.getElementById("loadBtn").addEventListener("click", handleLoadCode);
document.getElementById("shareLinkBtn").addEventListener("click", handleShareLink);

document.getElementById("fullscreenBtn").addEventListener("click", toggleFullscreen);

textarea.addEventListener("input", () => {
    localStorage.setItem("fgp_text", textarea.value);
    parseInput(false); // live-update stats/groups, no smart pick
});

themeSelect.addEventListener("change", () => {
    const value = themeSelect.value;
    document.documentElement.setAttribute("data-theme", value);
    localStorage.setItem("fgp_theme", value);
});

// Keyboard shortcuts
document.addEventListener("keydown", handleKeyShortcuts);

// Initial setup: theme + text + URL deck param
applySavedTheme();
restoreFromLocalStorageOrURL();
updateStatsOnly();
updateMeta();
updateSessionMeta();

// ========================
// CORE LOGIC
// ========================

function parseInput(startSession = true) {
    const raw = textarea.value || "";

    groups = raw
        .split(/\n\s*\n/) // split by blank lines
        .map(block =>
            block
                .split("\n")
                .map(line => line.trim())
                .filter(line => line.length > 0)
        )
        .filter(group => group.length > 0);

    // Build Leitner model fresh
    leitner = groups.map(group =>
        group.map(() => ({
            box: 1,
            correct: 0,
            wrong: 0
        }))
    );

    updateStatsOnly();

    if (!groups.length) {
        currentGroupIndex = -1;
        currentItemIndex = -1;
        flashcardEl.textContent = "No valid groups found.";
        updateMeta();
        return;
    }

    if (startSession) startNewSession();
}

function startNewSession() {
    sessionStart = Date.now();
    flipsCount = 0;
    againCount = 0;
    gotItCount = 0;
    updateSessionMeta();
}

function smartPickCard() {
    if (!groups.length) {
        parseInput();
        if (!groups.length) return;
    }

    // Flatten all cards with Leitner weighting
    const candidates = [];
    for (let gi = 0; gi < groups.length; gi++) {
        for (let ii = 0; ii < groups[gi].length; ii++) {
            const s = leitner[gi][ii];
            const box = Math.max(1, s.box || 1);
            let weight = 1 / (box * box);

            // Slight bonus if never seen
            if (s.correct === 0 && s.wrong === 0) {
                weight *= 1.4;
            }
            candidates.push({ gi, ii, weight });
        }
    }

    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    if (!totalWeight) return;

    let r = Math.random() * totalWeight;
    for (const c of candidates) {
        r -= c.weight;
        if (r <= 0) {
            currentGroupIndex = c.gi;
            currentItemIndex = c.ii;
            animateCard("flip");
            flipsCount++;
            updateCard();
            updateSessionMeta();
            playSound("flip");
            return;
        }
    }
}

function pickRandomGroupOnly() {
    if (!groups.length) return;

    currentGroupIndex = Math.floor(Math.random() * groups.length);
    const group = groups[currentGroupIndex];
    currentItemIndex = Math.floor(Math.random() * group.length);

    animateCard("shuffle");
    flipsCount++;
    updateCard();
    updateSessionMeta();
    playSound("shuffle");
}

function shuffleCurrentGroup() {
    const group = groups[currentGroupIndex];
    if (!group || group.length <= 1) return;

    // Fisher-Yates shuffle
    for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
        [leitner[currentGroupIndex][i], leitner[currentGroupIndex][j]] =
            [leitner[currentGroupIndex][j], leitner[currentGroupIndex][i]];
    }

    currentItemIndex = 0;
    animateCard("shuffle");
    flipsCount++;
    updateCard();
    updateSessionMeta();
    playSound("shuffle");
}

function shiftCard(direction) {
    if (currentGroupIndex < 0 || currentItemIndex < 0) return;

    const group = groups[currentGroupIndex];
    if (!group || !group.length) return;

    animateCard("flip");
    currentItemIndex =
        (currentItemIndex + direction + group.length) % group.length;

    flipsCount++;
    updateCard();
    updateSessionMeta();
    playSound("flip");
}

function updateCard() {
    if (currentGroupIndex < 0 || currentItemIndex < 0) {
        flashcardEl.textContent = "No card selected.";
        updateMeta();
        return;
    }

    const group = groups[currentGroupIndex];
    const value = group[currentItemIndex];

    flashcardEl.textContent = value || "";
    autoFitText();
    updateMeta();
}

function updateStatsOnly() {
    const groupCount = groups.length;
    const itemCount = groups.reduce((sum, g) => sum + g.length, 0);
    statsEl.textContent =
        `${groupCount} group${groupCount !== 1 ? "s" : ""} • ` +
        `${itemCount} item${itemCount !== 1 ? "s" : ""}`;
}

function updateMeta() {
    if (!groups.length || currentGroupIndex < 0) {
        metaGroupEl.textContent = "No groups loaded";
        metaItemEl.textContent = "No item";
        return;
    }

    const group = groups[currentGroupIndex];
    const groupNum = currentGroupIndex + 1;
    const totalGroups = groups.length;

    let itemText = "No item";
    if (currentItemIndex >= 0 && group.length) {
        const itemNum = currentItemIndex + 1;
        itemText = `Item ${itemNum} of ${group.length}`;
    }

    metaGroupEl.textContent = `Group ${groupNum} of ${totalGroups}`;
    metaItemEl.textContent = itemText;
}

function updateSessionMeta() {
    let elapsedStr = "0:00";
    if (sessionStart) {
        const seconds = Math.floor((Date.now() - sessionStart) / 1000);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        elapsedStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    }
    sessionMetaEl.textContent =
        `Session: ${elapsedStr} • Flips: ${flipsCount} • Again: ${againCount} • Got it: ${gotItCount}`;
}

// ========================
// LEITNER ACTIONS
// ========================

function markAgain() {
    if (currentGroupIndex < 0 || currentItemIndex < 0) return;
    const s = leitner[currentGroupIndex][currentItemIndex];
    s.box = 1;
    s.wrong = (s.wrong || 0) + 1;
    againCount++;
    updateSessionMeta();
    playSound("again");
    smartPickCard();
}

function markGotIt() {
    if (currentGroupIndex < 0 || currentItemIndex < 0) return;
    const s = leitner[currentGroupIndex][currentItemIndex];
    s.box = Math.min((s.box || 1) + 1, 5);
    s.correct = (s.correct || 0) + 1;
    gotItCount++;
    updateSessionMeta();
    playSound("gotit");
    smartPickCard();
}

// ========================
// TEXT AUTOSCALING
// ========================

function autoFitText() {
    // Smooth scaling: shrink if text overflows card
    const maxSize = 22;
    const minSize = 12;
    let size = maxSize;

    flashcardEl.style.fontSize = maxSize + "px";

    while (size > minSize &&
        (flashcardEl.scrollHeight > flashcardEl.clientHeight ||
         flashcardEl.scrollWidth > flashcardEl.clientWidth)) {
        size -= 1;
        flashcardEl.style.fontSize = size + "px";
    }
}

// ========================
// SAVE / LOAD CODE & SHARE LINK
// ========================

function generateSaveCode(data) {
    const json = JSON.stringify(data);
    return LZString.compressToBase64(json);
}

function loadFromSaveCode(code) {
    try {
        const json = LZString.decompressFromBase64(code);
        if (!json) return null;
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function handleSaveCode() {
    const text = textarea.value.trim();
    if (!text) {
        alert("Nothing to save. Enter some groups first.");
        return;
    }

    const code = generateSaveCode({ text });

    navigator.clipboard?.writeText(code).catch(() => {});
    alert("Your save code (copied if possible):\n\n" + code);
}

function handleLoadCode() {
    const code = document.getElementById("loadInput").value.trim();
    if (!code) return;

    const data = loadFromSaveCode(code);
    if (!data || !data.text) {
        alert("Invalid or corrupted code.");
        return;
    }

    textarea.value = data.text;
    localStorage.setItem("fgp_text", textarea.value);
    parseInput();
    smartPickCard();
    alert("Flashcards restored from code.");
}

async function handleShareLink() {
    const text = textarea.value.trim();
    if (!text) {
        alert("Nothing to share. Enter some groups first.");
        return;
    }

    try {
        const res = await fetch("/deck", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        if (!res.ok) {
            alert("Failed to create share link (server error).");
            return;
        }

        const data = await res.json();
        const id = data.id;
        const base = window.location.origin + window.location.pathname;
        const url = `${base}?id=${encodeURIComponent(id)}`;

        navigator.clipboard?.writeText(url).catch(() => {});
        alert("Share link (copied if possible):\n\n" + url);
    } catch (err) {
        console.error(err);
        alert("Failed to create share link (network error).");
    }

// On load, check for ?deck= param
function restoreFromLocalStorageOrURL() {
    const params = new URLSearchParams(window.location.search);
    const deckParam = params.get("deck");

    if (deckParam) {
        try {
            const text = LZString.decompressFromBase64(decodeURIComponent(deckParam));
            if (text) {
                textarea.value = text;
                localStorage.setItem("fgp_text", text);
                parseInput();
                smartPickCard();
                return;
            }
        } catch {
            // ignore and fall back
        }
    }

    const savedText = localStorage.getItem("fgp_text");
    if (savedText) {
        textarea.value = savedText;
        parseInput();
        smartPickCard();
    }
}

// ========================
// THEME + FULLSCREEN
// ========================

function applySavedTheme() {
    const saved = localStorage.getItem("fgp_theme") || "dark";
    document.documentElement.setAttribute("data-theme", saved);
    themeSelect.value = saved;
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        appRoot.requestFullscreen?.().catch(() => {});
    } else {
        document.exitFullscreen?.().catch(() => {});
    }
}

// ========================
// SOUND EFFECTS
// ========================

function playSound(type) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    let freq = 440;
    if (type === "flip") freq = 520;
    else if (type === "shuffle") freq = 360;
    else if (type === "again") freq = 220;
    else if (type === "gotit") freq = 760;

    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.14);
}

// ========================
// KEYBOARD SHORTCUTS
// ========================

function handleKeyShortcuts(event) {
    const tag = (event.target.tagName || "").toLowerCase();
    if (tag === "textarea" || tag === "input" || tag === "select") return;

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftCard(-1);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftCard(1);
    } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        smartPickCard();
    } else if (event.code === "Space") {
        event.preventDefault();
        animateCard("flip");
        updateCard();
        playSound("flip");
    } else if (event.key === "1") {
        event.preventDefault();
        markAgain();
    } else if (event.key === "2") {
        event.preventDefault();
        markGotIt();
    }
}

// ========================
// SMALL ANIMATION HELPER
// ========================

function animateCard(type) {
    flashcardEl.classList.remove("flip", "shuffle");
    void flashcardEl.offsetWidth; // force reflow so animation retriggers
    flashcardEl.classList.add(type === "shuffle" ? "shuffle" : "flip");

}
