// ========================
// GROUP + CARD LOGIC
// ========================

let groups = [];
let currentGroup = [];
let currentIndex = 0;

const flashcardEl = document.getElementById("flashcard");

// Parse textarea → create groups
function parseInput() {
    const raw = document.getElementById("groupsInput").value;

    groups = raw
        .split(/\n\s*\n/) // blank line
        .map(block =>
            block
                .split("\n")
                .map(line => line.trim())
                .filter(line => line.length > 0)
        )
        .filter(group => group.length > 0);

    if (groups.length === 0) {
        flashcardEl.textContent = "No valid groups found.";
        return;
    }

    pickRandomGroup();
}

// Pick random group + random card
function pickRandomGroup() {
    currentGroup = groups[Math.floor(Math.random() * groups.length)];
    currentIndex = Math.floor(Math.random() * currentGroup.length);
    updateCard();
}

// Move left/right with wrap-around
function shiftCard(direction) {
    if (!currentGroup.length) return;

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

// Update card text
function updateCard() {
    flashcardEl.textContent = currentGroup[currentIndex];
}


// ========================
// SAVE → CODE  /  LOAD
// ========================

// Create compressed code
function generateSaveCode(data) {
    return LZString.compressToBase64(JSON.stringify(data));
}

// Decode compressed code
function loadFromSaveCode(code) {
    try {
        const json = LZString.decompressFromBase64(code);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

// Save button
document.getElementById("saveBtn").addEventListener("click", () => {
    const text = document.getElementById("groupsInput").value.trim();
    if (!text) {
        alert("Nothing to save.");
        return;
    }

    const code = generateSaveCode({ text });

    navigator.clipboard?.writeText(code).catch(() => {});
    alert("Save code (copied):\n\n" + code);
});

// Load button
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
});

