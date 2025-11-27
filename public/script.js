// ---------------------------
// GROUP + CARD LOGIC
// ---------------------------

let groups = [];
let currentGroup = [];
let currentIndex = 0;

// HTML references
const flashcardEl = document.getElementById("flashcard");
const qEl = document.getElementById("cardQ");
const aEl = document.getElementById("cardA");

function parseInput() {
    const raw = document.getElementById("groupsInput").value;

    groups = raw
        .split("\n\n")
        .map(block => block.split("\n").map(x => x.trim()).filter(x => x));

    if (groups.length === 0) return;
    pickRandomGroup();
}

function pickRandomGroup() {
    currentGroup = groups[Math.floor(Math.random() * groups.length)];
    currentIndex = Math.floor(Math.random() * currentGroup.length);
    updateCard();
}

function shiftCard(amount) {
    flashcardEl.classList.add("flipping");

    setTimeout(() => {
        currentIndex = (currentIndex + amount + currentGroup.length) % currentGroup.length;
        updateCard();
        flashcardEl.classList.remove("flipping");
    }, 300);
}

// Update card front/back content
function updateCard() {
    const value = currentGroup[currentIndex];

    // Same value on both sides unless you make multi-side later
    qEl.textContent = value;
    aEl.textContent = value;
}

// Toggle flip animation
flashcardEl.addEventListener("click", () => {
    flashcardEl.classList.toggle("flipped");
});


// ---------------------------
// SAVE / LOAD (Code System)
// ---------------------------

// JSON → compressed Base64 code
function generateSaveCode(data) {
    const json = JSON.stringify(data);
    return LZString.compressToBase64(json);
}

// code → JSON
function loadFromSaveCode(code) {
    const json = LZString.decompressFromBase64(code);
    if (!json) return null;
    return JSON.parse(json);
}

// Button: SAVE
document.getElementById("saveBtn").addEventListener("click", () => {
    const raw = document.getElementById("groupsInput").value.trim();

    const code = generateSaveCode({ text: raw });
    navigator.clipboard.writeText(code).catch(() => {});

    alert("Your save code (copied to clipboard):\n\n" + code);
});

// Button: LOAD
document.getElementById("loadBtn").addEventListener("click", () => {
    const code = document.getElementById("loadInput").value.trim();
    if (!code) return;

    const data = loadFromSaveCode(code);
    if (!data || !data.text) {
        alert("Invalid or corrupted code.");
        return;
    }

    document.getElementById("groupsInput").value = data.text;
    parseInput();

    alert("Flashcards restored.");
});
