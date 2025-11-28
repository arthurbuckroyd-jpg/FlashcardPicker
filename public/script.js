// ========================
// CONSTANTS & DEFINITIONS
// ========================

const PROFILE_KEY = "fgp_profile_v1";

// Themes known to the app
const ALL_THEMES = [
    { id: "dark",    name: "Dark",       alwaysUnlocked: true },
    { id: "light",   name: "Light",      alwaysUnlocked: true },
    { id: "neon",    name: "Neon",       alwaysUnlocked: true },
    { id: "iceblue", name: "Ice Blue",   alwaysUnlocked: false },
    { id: "royal",   name: "Royal Core", alwaysUnlocked: false },
    { id: "sunset",  name: "Sunset Fade", alwaysUnlocked: false },
    { id: "emerald", name: "Emerald Glow", alwaysUnlocked: false },
    { id: "noir",    name: "Noir Mode",  alwaysUnlocked: false }
];

// Achievements (local only, not in save codes)
const ACHIEVEMENTS = [
    {
        id: "first_flip",
        title: "First Flip",
        desc: "Flip any card at least once.",
        icon: "✨",
        check: p => p.totalFlips >= 1,
        themeReward: "iceblue",
        xpReward: 50
    },
    {
        id: "hundred_flips",
        title: "Card Grinder",
        desc: "Flip 100 cards across all sessions.",
        icon: "📚",
        check: p => p.totalFlips >= 100,
        themeReward: "royal",
        xpReward: 150
    },
    {
        id: "gotit_master",
        title: "Got It Master",
        desc: "Mark 100 cards as 'Got it'.",
        icon: "✅",
        check: p => p.totalGotIt >= 100,
        themeReward: "emerald",
        xpReward: 200
    },
    {
        id: "again_resilient",
        title: "Resilient",
        desc: "Hit 'Again' at least 30 times. Persistence counts.",
        icon: "💪",
        check: p => p.totalAgain >= 30,
        themeReward: null,
        xpReward: 80
    },
    {
        id: "session_15min",
        title: "In the Zone",
        desc: "Study for at least 15 minutes in one session.",
        icon: "⏱️",
        check: p => p.longestSessionSeconds >= 15 * 60,
        themeReward: "sunset",
        xpReward: 150
    },
    {
        id: "night_owl",
        title: "Night Owl",
        desc: "Use the app between 00:00 and 04:00 at least once.",
        icon: "🌙",
        check: p => p.flags.nightOwl === true,
        themeReward: "noir",
        xpReward: 120
    },
    {
        id: "streak_3",
        title: "On a Roll",
        desc: "Have a 3-day usage streak.",
        icon: "🔥",
        check: p => p.streak >= 3,
        themeReward: null,
        xpReward: 100
    },
    {
        id: "streak_7",
        title: "Serious Grind",
        desc: "Have a 7-day usage streak.",
        icon: "🏆",
        check: p => p.streak >= 7,
        themeReward: null,
        xpReward: 200
    }
];

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

let profile = null;

const textarea = document.getElementById("groupsInput");
const flashcardEl = document.getElementById("flashcard");
const statsEl = document.getElementById("stats");
const metaGroupEl = document.getElementById("metaGroup");
const metaItemEl = document.getElementById("metaItem");
const sessionMetaEl = document.getElementById("sessionMeta");
const themeSelect = document.getElementById("themeSelect");
const appRoot = document.getElementById("appRoot");

const loadingOverlay = document.getElementById("loadingOverlay");
const loadingMessageEl = document.getElementById("loadingMessage");
const toastContainer = document.getElementById("toastContainer");
const levelDisplayEl = document.getElementById("levelDisplay");

const achievementsBtn = document.getElementById("achievementsBtn");
const achievementsModal = document.getElementById("achievementsModal");
const achievementsClose = document.getElementById("achievementsClose");
const achievementsListEl = document.getElementById("achievementsList");

let loadingTimeout = null;
let wakingTimeout = null;

// Simple Web Audio-based sound effects
const audioCtx = (window.AudioContext || window.webkitAudioContext)
    ? new (window.AudioContext || window.webkitAudioContext)()
    : null;

// ========================
// PROFILE / PERSISTENCE
// ========================

function defaultProfile() {
    return {
        totalFlips: 0,
        totalAgain: 0,
        totalGotIt: 0,
        totalStudySeconds: 0,
        longestSessionSeconds: 0,
        streak: 1,
        maxStreak: 1,
        lastUsedDate: null,
        flags: {
            nightOwl: false
        },
        xp: 0,
        level: 1,
        unlockedThemes: ["dark", "light", "neon"],
        currentTheme: "dark",
        achievements: {},   // id -> { unlocked: bool, unlockedAt: timestamp }
    };
}

function loadProfile() {
    try {
        const raw = localStorage.getItem(PROFILE_KEY);
        if (!raw) return defaultProfile();
        const data = JSON.parse(raw);
        // basic sanity
        if (!data.unlockedThemes || !Array.isArray(data.unlockedThemes)) {
            data.unlockedThemes = ["dark", "light", "neon"];
        }
        if (!data.achievements) data.achievements = {};
        if (!data.flags) data.flags = { nightOwl: false };
        if (!data.currentTheme) data.currentTheme = "dark";
        if (typeof data.level !== "number") data.level = 1;
        if (typeof data.xp !== "number") data.xp = 0;
        return data;
    } catch {
        return defaultProfile();
    }
}

function saveProfile() {
    try {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {
        // ignore, user storage might be full
    }
}

function addXp(amount) {
    profile.xp += amount;
    let required = profile.level * 100;
    let leveledUp = false;
    while (profile.xp >= required) {
        profile.xp -= required;
        profile.level += 1;
        required = profile.level * 100;
        leveledUp = true;
    }
    if (leveledUp) {
        showToast(`Level up! You are now level ${profile.level}.`, "success");
        launchConfetti();
    }
    saveProfile();
    updateLevelDisplay();
}

// Called once on load
function updateUsageStreak() {
    const today = new Date();
    const todayKey = today.toISOString().slice(0, 10); // YYYY-MM-DD

    if (!profile.lastUsedDate) {
        profile.lastUsedDate = todayKey;
        profile.streak = 1;
        profile.maxStreak = 1;
        saveProfile();
        return;
    }

    if (profile.lastUsedDate === todayKey) return; // already counted today

    const last = new Date(profile.lastUsedDate + "T00:00:00");
    const diffDays = Math.round((today - last) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
        profile.streak += 1;
        if (profile.streak > profile.maxStreak) profile.maxStreak = profile.streak;
    } else {
        profile.streak = 1;
    }

    profile.lastUsedDate = todayKey;
    saveProfile();
}

// Night owl flag
function maybeMarkNightOwl() {
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 0 && hour < 4) {
        profile.flags.nightOwl = true;
        saveProfile();
    }
}

// ========================
// INIT
// ========================

profile = loadProfile();
updateUsageStreak();
maybeMarkNightOwl();
buildThemeSelect();
applySavedTheme();
updateLevelDisplay();

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
    parseInput(false); // live-update stats/groups, no new session
});

themeSelect.addEventListener("change", handleThemeChange);

// Achievements modal
achievementsBtn.addEventListener("click", () => {
    refreshAchievementsUI();
    achievementsModal.classList.remove("hidden");
});

achievementsClose.addEventListener("click", () => {
    achievementsModal.classList.add("hidden");
});

achievementsModal.addEventListener("click", e => {
    if (e.target === achievementsModal || e.target.classList.contains("modal-backdrop")) {
        achievementsModal.classList.add("hidden");
    }
});

// Keyboard shortcuts
document.addEventListener("keydown", handleKeyShortcuts);

// Initial deck from URL or localStorage
restoreFromLocalStorageOrURL();
updateStatsOnly();
updateMeta();
updateSessionMeta();
checkAchievements(); // see if nightOwl/streak etc unlocked anything on load

// Study timer: increment totalStudySeconds every 10 seconds while session active
setInterval(() => {
    if (!sessionStart || !groups.length) return;
    profile.totalStudySeconds += 10;
    const sessionSec = Math.floor((Date.now() - sessionStart) / 1000);
    if (sessionSec > profile.longestSessionSeconds) {
        profile.longestSessionSeconds = sessionSec;
    }
    saveProfile();
    checkAchievements();
    updateSessionMeta();
}, 10000);

// ========================
// THEME / UI SETUP
// ========================

function buildThemeSelect() {
    themeSelect.innerHTML = "";
    ALL_THEMES.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        themeSelect.appendChild(opt);
    });
}

function applySavedTheme() {
    let theme = profile.currentTheme || "dark";
    if (!profile.unlockedThemes.includes(theme)) {
        theme = "dark";
    }
    document.documentElement.setAttribute("data-theme", theme);
    themeSelect.value = theme;
}

function handleThemeChange() {
    const newTheme = themeSelect.value;
    if (!profile.unlockedThemes.includes(newTheme)) {
        // revert
        themeSelect.value = profile.currentTheme || "dark";
        showToast("This theme is locked. Unlock it via achievements.", "info");
        return;
    }
    profile.currentTheme = newTheme;
    document.documentElement.setAttribute("data-theme", newTheme);
    saveProfile();
}

function updateLevelDisplay() {
    levelDisplayEl.textContent = `Lv ${profile.level} · ${profile.xp} XP`;
}

// ========================
// LOADING OVERLAY HELPERS
// ========================

function showLoading(message) {
    clearTimeout(loadingTimeout);
    clearTimeout(wakingTimeout);

    loadingTimeout = setTimeout(() => {
        if (loadingMessageEl) {
            loadingMessageEl.textContent = message || "Contacting server…";
        }
        loadingOverlay?.classList.remove("hidden");

        // After 5 seconds, hint that server might be waking up
        wakingTimeout = setTimeout(() => {
            if (loadingOverlay && !loadingOverlay.classList.contains("hidden")) {
                loadingMessageEl.textContent =
                    "Server might be waking up (free hosting).\nThis can take a few seconds…";
            }
        }, 5000);
    }, 300);
}

function hideLoading() {
    clearTimeout(loadingTimeout);
    clearTimeout(wakingTimeout);
    loadingOverlay?.classList.add("hidden");
}

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

    const candidates = [];
    for (let gi = 0; gi < groups.length; gi++) {
        for (let ii = 0; ii < groups[gi].length; ii++) {
            const s = leitner[gi][ii];
            const box = Math.max(1, s.box || 1);
            let weight = 1 / (box * box);

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
            profile.totalFlips++;
            addXp(1);
            updateCard();
            updateSessionMeta();
            saveProfile();
            checkAchievements();
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
    profile.totalFlips++;
    addXp(1);
    updateCard();
    updateSessionMeta();
    saveProfile();
    checkAchievements();
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
    profile.totalFlips++;
    addXp(1);
    updateCard();
    updateSessionMeta();
