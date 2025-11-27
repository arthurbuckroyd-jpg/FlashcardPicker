// ========================
// STATE
// ========================

let groups = [];              // Array of groups, each group = array of strings
let currentGroupIndex = -1;   // Index into groups
let currentItemIndex = -1;    // Index into current group

const textarea = document.getElementById("groupsInput");
const flashcardEl = document.getElementById("flashcard");
const statsEl = document.getElementById("stats");
const metaGroupEl = document.getElementById("metaGroup");
const metaItemEl = document.getElementById("metaItem");
const themeToggleBtn = document.getElementById("themeToggle");

// ========================
// INIT
// ========================

document.getElementById("startBtn").addEventListener("click", () => {
    parseInput();
});

document.getElementById("randomGroupBtn").addEventListener("click", () => {
    if (!groups.length) {
        parseInput();
    } else {
        pickRandomGroup();
    }
});

document.getElementById("shuffleBtn").addEventListener("click", () => {
    if (currentGroupIndex < 0) return;
    shuffleCurrentGroup();
});

// arrows
document.getElementById("arrowLeft").addEventListener("click", () => shiftCard(-1));
document.getElementById("arrowRight").addEventListener("click", () => shiftCard(1));

// live autosave input
textarea.addEventListener("input", () => {
    localStorage.setItem("fgp_text", textarea.value);
    updateStatsOnly();
});

// save/load code buttons
document.getElementById("saveBtn").addEventListener("click", handleSaveCode);
document.getElementById("loadBtn").addEventListener("click", handleLoadCode);

// theme toggle
themeToggleBtn.addEventListener("click", toggleTheme);

// keyboard shortcuts
document.addEventListener("keydown", handleKeyShortcuts);

// Load persisted text + theme on startup
restoreFromLocalStorage();
applySavedTheme();


// ========================
// CORE LOGIC
// ========================

function parseInput() {
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

    updateStatsOnly();

    if (!groups.length) {
        currentGroupIndex = -1;
        currentItemIndex = -1;
        flashcardEl.textContent = "No valid groups found.";
        updateMeta();
        return;
    }

    pickRandomGroup();
}

function pickRandomGroup() {
    if (!groups.length) return;

    currentGroupIndex = Math.floor(Math.random() * groups.length);
    const group = groups[currentGroupIndex];

    currentItemIndex = Math.floor(Math.random() * group.length);
    animateCardAndUpdate();
}

function shiftCard(direction) {
    if (currentGroupIndex < 0 || currentItemIndex < 0) return;

    const group = groups[currentGroupIndex];
    if (!group || !group.length) return;

    flashcardEl.classList.add("flip");

    setTimeout(() => {
        currentItemIndex =
            (currentItemIndex + direction + group.length) % group.length;
        updateCard();
    }, 150);

    setTimeout(() => {
        flashcardEl.classList.remove("flip");
    }, 350);
}

function shuffleCurrentGroup() {
    const group = groups[currentGroupIndex];
    if (!group || group.length <= 1) return;

    // Fisher-Yates shuffle
    for (let i = group.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [group[i], group[j]] = [group[j], group[i]];
    }

    currentItemIndex = 0;
    animateCardAndUpdate();
}

function updateCard() {
    if (currentGroupIndex < 0 || currentItemIndex < 0) {
        flashcardEl.textContent = "No card selected.";
        updateMeta();
        return;
    }

    const group = groups[currentGroupIndex];
    const value = group[currentItemIndex];

    flashcardEl.textContent = value;
    updateMeta();
}

function animateCardAndUpdate() {
    flashcardEl.classList.add("flip");
    setTimeout(() => {
        updateCard();
    }, 150);
    setTimeout(() => {
        flashcardEl.classList.remove("flip");
    }, 350);
}

function updateStatsOnly() {
    const groupCount = groups.length;
    const itemCount = groups.reduce((sum, g) => sum + g.length, 0);
    statsEl.textContent = `${groupCount} group${groupCount !== 1 ? "s" : ""} • ${itemCount} item${itemCount !== 1 ? "s" : ""}`;
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


// ========================
// SAVE / LOAD VIA CODE
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

    // Try copy to clipboard (supported in most browsers)
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
    alert("Flashcards restored from code.");
}


// ========================
// THEME + LOCAL STORAGE
// ========================

function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme") || "dark";
    const next = current === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem("fgp_theme", next);
    themeToggleBtn.textContent = next === "dark" ? "🌙" : "☀️";
}

function applySavedTheme() {
    const saved = localStorage.getItem("fgp_theme");
    const html = document.documentElement;
    const theme = saved || "dark";
    html.setAttribute("data-theme", theme);
    themeToggleBtn.textContent = theme === "dark" ? "🌙" : "☀️";
}

function restoreFromLocalStorage() {
    const savedText = localStorage.getItem("fgp_text");
    if (savedText) {
        textarea.value = savedText;
        parseInput();
    } else {
        updateStatsOnly();
        updateMeta();
    }
}


// ========================
// KEYBOARD SHORTCUTS
// ========================

function handleKeyShortcuts(event) {
    const tag = event.target.tagName.toLowerCase();
    if (tag === "textarea" || tag === "input") return;

    if (event.key === "ArrowLeft") {
        event.preventDefault();
        shiftCard(-1);
    } else if (event.key === "ArrowRight") {
        event.preventDefault();
        shiftCard(1);
    } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (!groups.length) {
            parseInput();
        } else {
            pickRandomGroup();
        }
    } else if (event.code === "Space") {
        event.preventDefault();
        animateCardAndUpdate();
    }
}

