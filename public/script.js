// ---------------------------
// GROUP + CARD LOGIC
// ---------------------------

let groups = [];
let currentGroup = [];
let currentIndex = 0;

const flashcardEl = document.getElementById("flashcard");

// Parse textarea into groups separated by blank lines
function parseInput() {
    const raw = document.getElementById("groupsInput").value;

    groups = raw
        .split(/\n\s*\n/)                  // split by blank lines
        .map(block =>
            block
                .split("\n")
                .map(x => x.trim())
                .filter(x => x.length > 0)
        )
        .filter(g => g.length > 0);

    if (groups.length === 0) {
        flashcardEl.textContent = "No valid groups found.";
        return;
    }

    pickRandomGroup();
}

// Pick a random group and random starting item
function pickRandomGroup() {
    currentGroup = groups[Math.floor(Math.random() * groups.length)];
    currentIndex = Math.floor(Math.random() * currentGroup.length);
    updateCard();
}

// Shift within the current group, wrapping around
function shiftCard(direction) {
    if (!currentGroup.length) return;

    // trigger flip-ish animation
    flashcardEl.classList.add("flip");

    setTimeout(() => {
        currentIndex =
            (currentIndex + direction + currentGroup.length) %
            currentGroup.length;
        updateCard();
    }, 150);

    setTimeout(() => {
        flashcardEl.classList.remove("flip");
    }, 350);
}

// Update the text on the card
function updateCard() {
    flashcardEl.textContent = currentGroup[currentIndex];
}

// ---------------------------
// SAVE / LOAD (CODE SYSTEM)
// ---------------------------

// Convert data to compressed base64 code
function generateSaveCode(data) {
    const json = JSON.stringify(data);
    return LZString.compressToBase64(json);
}

// Convert code back to data
function loadFromSaveCode(code) {
    const json = LZString.decompressFromBase64(code);
    if (!json) return null;
    return JSON.parse(json);
}

// Save button → generate code
document.getElementById("saveBtn").addEventListener("click", () => {
    const raw = document.getElementById("groupsInput").value.trim();
    if (!raw) {
        alert("Nothing to save. Enter some groups first.");
        return;
    }

    const code = generateSaveCode({ text: raw });

    // Try to copy to clipboard (fails silently if blocked)
    navigator.clipboard?.writeText(code).catch(() => {});

    alert("Your save code (also copied to clipboard if allowed):\n\n" + code);
});

// Load button → restore from code
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
    alert("Flashcards restored from code.");
});
