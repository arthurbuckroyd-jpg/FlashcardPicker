let groups = [];
let currentGroup = [];
let currentIndex = 0;

function parseInput() {
    const raw = document.getElementById("groupsInput").value;
    groups = raw
        .split("\n\n")
        .map(block => block.split("\n").map(x => x.trim()).filter(x => x));

    if (groups.length === 0 || groups[0].length === 0) return;

    pickRandomGroup();
}

function pickRandomGroup() {
    currentGroup = groups[Math.floor(Math.random() * groups.length)];
    currentIndex = Math.floor(Math.random() * currentGroup.length);
    updateCard();
}

function shiftCard(amount) {
    const card = document.getElementById("flashcard");
    card.classList.add("fade-out");

    setTimeout(() => {
        currentIndex = (currentIndex + amount + currentGroup.length) % currentGroup.length;
        updateCard();
        card.classList.remove("fade-out");
        card.classList.add("fade-in");

        setTimeout(() => card.classList.remove("fade-in"), 200);
    }, 200);
}

function updateCard() {
    document.getElementById("flashcard").textContent = currentGroup[currentIndex];
}

// SAVE SYSTEM
async function saveData() {
    const groupsInput = document.getElementById("groupsInput").value;

    const res = await fetch("/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: groupsInput })
    });

    const out = await res.json();
    alert("Your code: " + out.code);
}

async function loadData() {
    const code = prompt("Enter the code:");
    if (!code) return;

    const res = await fetch("/load/" + code);
    if (!res.ok) {
        alert("Code not found.");
        return;
    }

    const out = await res.json();
    document.getElementById("groupsInput").value = out.data;
    parseInput();
}