// ==========================
// STATE
// ==========================

let groups = [];  // [{ tag:"animals", items:[...] }, ...]
let activeTags = new Set();
let flatActiveItems = []; // flattened list of active items w/ references
let currentIndex = -1;

// DOM
const textarea = document.getElementById("groupsInput");
const statsEl = document.getElementById("stats");
const flashcard = document.getElementById("flashcard");
const metaGroup = document.getElementById("metaGroup");
const metaItem = document.getElementById("metaItem");
const tagListEl = document.getElementById("tagList");

// ==========================
// PARSE INPUT
// ==========================

function parseInput() {
    const raw = textarea.value;
    const blocks = raw.split(/\n\s*\n/);

    groups = [];

    for (const block of blocks) {
        const lines = block.split("\n").map(x => x.trim()).filter(Boolean);
        if (!lines.length) continue;

        let tag = "default";
        if (lines[0].startsWith("#")) {
            tag = lines[0].slice(1).trim() || "default";
            lines.shift();
        }

        if (!lines.length) continue;

        groups.push({
            tag,
            items: lines
        });
    }

    rebuildTagList();
    rebuildActiveItemList();
    updateStats();
}

// ==========================
// TAG HANDLING
// ==========================

function rebuildTagList() {
    const tags = [...new Set(groups.map(g => g.tag))];
    tagListEl.innerHTML = "";

    tags.forEach(tag => {
        const div = document.createElement("div");
        div.className = "tag-item";
        if (activeTags.size === 0 || activeTags.has(tag)) {
            div.classList.add("active");
        }

        div.textContent = tag;
        div.addEventListener("click", () => {
            if (activeTags.has(tag)) {
                activeTags.delete(tag);
            } else {
                activeTags.add(tag);
            }

            if (activeTags.size === 0) {
                // clicking everything off = treat as "all on"
                activeTags = new Set();
            }

            rebuildTagList();
            rebuildActiveItemList();
        });

        tagListEl.appendChild(div);
    });
}

function isTagActive(tag) {
    if (activeTags.size === 0) return true;
    return activeTags.has(tag);
}

function rebuildActiveItemList() {
    flatActiveItems = [];

    groups.forEach((g, gi) => {
        if (!isTagActive(g.tag)) return;
        g.items.forEach((item, ii) => {
            flatActiveItems.push({ groupIndex: gi, itemIndex: ii, value: item });
        });
    });

    currentIndex = -1;
}

// ==========================
// NAVIGATION
// ==========================

function randomPick() {
    if (!flatActiveItems.length) {
        flashcard.textContent = "No active items.";
        return;
    }
    currentIndex = Math.floor(Math.random() * flatActiveItems.length);
    updateCard();
}

function move(offset) {
    if (!flatActiveItems.length) return;
    currentIndex = (currentIndex + offset + flatActiveItems.length) % flatActiveItems.length;
    updateCard();
}

function updateCard() {
    const entry = flatActiveItems[currentIndex];
    const g = groups[entry.groupIndex];

    flashcard.textContent = entry.value;
    metaGroup.textContent = `Group: ${g.tag}`;
    metaItem.textContent = `Item ${entry.itemIndex + 1} of ${g.items.length}`;
}

function updateStats() {
    const groupCount = groups.length;
    const itemCount = groups.reduce((n, g) => n + g.items.length, 0);
    const tags = new Set(groups.map(g => g.tag));
    statsEl.textContent = `${groupCount} groups • ${itemCount} items • ${tags.size} tags`;
}

// ==========================
// SAVE / LOAD
// ==========================

function saveCode() {
    const text = textarea.value.trim();
    const json = JSON.stringify({ text });
    const code = LZString.compressToBase64(json);
    navigator.clipboard.writeText(code).catch(()=>{});
    alert("Copied save code:\n\n" + code);
}

function loadCode() {
    const code = document.getElementById("loadInput").value.trim();
    try {
        const json = LZString.decompressFromBase64(code);
        if (!json) throw 0;
        const data = JSON.parse(json);

        textarea.value = data.text || "";
        parseInput();
        randomPick();
    } catch {
        alert("Invalid code.");
    }
}

// ==========================
// SHARE LINK
// ==========================

async function shareLink() {
    const text = textarea.value.trim();
    if (!text) return alert("Nothing to share.");

    const res = await fetch("/deck", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ text })
    });

    if (!res.ok) return alert("Server error.");

    const data = await res.json();
    const id = data.id;

    const url = window.location.origin + "?id=" + encodeURIComponent(id);
    navigator.clipboard.writeText(url).catch(()=>{});
    alert("Copied share link:\n\n" + url);
}

async function loadFromURL() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    if (!id) return;

    const res = await fetch("/deck/" + encodeURIComponent(id));
    if (!res.ok) return;

    const data = await res.json();
    textarea.value = data.text || "";
    parseInput();
    randomPick();
}

// ==========================
// EVENTS
// ==========================

document.getElementById("startBtn").onclick = () => {
    parseInput();
    randomPick();
};

document.getElementById("randomGroupBtn").onclick = randomPick;

document.getElementById("leftArrow").onclick = () => move(-1);
document.getElementById("rightArrow").onclick = () => move(1);

document.getElementById("saveBtn").onclick = saveCode;
document.getElementById("loadBtn").onclick = loadCode;
document.getElementById("shareBtn").onclick = shareLink;

textarea.addEventListener("input", parseInput);

// Load shared deck if ?id=...
loadFromURL();
parseInput();

