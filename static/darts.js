// --- CONFIGURATION & ELEMENTS DOM ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayStart = document.getElementById("overlay-start");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const scoreP1El = document.getElementById("score-p1");
const scoreP2El = document.getElementById("score-p2");

const ptsP1El = document.getElementById("pts-p1");
const ptsP2El = document.getElementById("pts-p2");
const lastP1El = document.getElementById("last-p1");
const lastP2El = document.getElementById("last-p2");

// Couleurs de l'arcade
const COLOR_BG = "#141911";
const COLOR_LINE = "#3a4530";
const COLOR_P1 = "#df5b5b"; // Rouge J1
const COLOR_P2 = "#5b9bdf"; // Bleu J2

// Logique du jeu (Règles du 501)
let gameRunning = false;
let scores501 = { player1: 501, player2: 501 };
let currentPlayer = 1; 
let dartsThrownThisTurn = 0;
let scoreThisTurn = 0;

// Oscillateur de visée (Le viseur bouge tout seul)
let angleX = 0;
let angleY = 0;
let speedX = 0.04;
let speedY = 0.03;
let targetRadius = 240; // Rayon max de la cible sur le canvas (620x620)
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;

// --- API FLASK (SCORES ARCHIVÉS) ---
async function fetchScores() {
    try {
        const response = await fetch("/api/scores/darts");
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur scores:", e); }
}

async function recordWinner(winner) {
    try {
        const response = await fetch("/api/scores/darts/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ winner: winner })
        });
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur enregistrement:", e); }
}

// --- INITIALISATION DES PARTIES ---
function prepareGame() {
    scores501 = { player1: 501, player2: 501 };
    currentPlayer = 1;
    dartsThrownThisTurn = 0;
    scoreThisTurn = 0;

    ptsP1El.textContent = "501";
    ptsP2El.textContent = "501";
    lastP1El.textContent = "—";
    lastP2El.textContent = "—";

    overlay.style.display = "none";
    overlayStart.style.display = "flex"; // S'assurer que le menu de départ s'affiche
    gameRunning = false;

    // Fixer des angles par défaut stables pour éviter que le viseur casse la boucle au premier rendu
    angleX = 0;
    angleY = 0;
}

function startGame() {
    overlayStart.style.display = "none";
    overlay.style.display = "none";
    gameRunning = true;
}

// --- GESTION DES CLICS (LANCER DE FLÉCHETTE) ---
canvas.addEventListener("click", (e) => {
    if (!gameRunning) return;

    // Calculer la position du curseur au moment du clic
    const currentTargetX = centerX + Math.sin(angleX) * (targetRadius * 0.85);
    const currentTargetY = centerY + Math.cos(angleY) * (targetRadius * 0.85);

    const dx = currentTargetX - centerX;
    const dy = currentTargetY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let points = 0;
    let message = "";

    if (distance <= 12) {
        points = 50; 
        message = "Double Bulle ! (50)";
    } else if (distance <= 28) {
        points = 25; 
        message = "Bulle ! (25)";
    } else if (distance <= targetRadius) {
        const zone = Math.floor((targetRadius - distance) / 25);
        points = (zone + 1) * 3; 
        message = `Touche ! (${points})`;
    } else {
        points = 0; 
        message = "Manqué ! (0)";
    }

    scoreThisTurn += points;
    dartsThrownThisTurn++;

    if (currentPlayer === 1) {
        lastP1El.textContent = `${message} [${dartsThrownThisTurn}/3]`;
    } else {
        lastP2El.textContent = `${message} [${dartsThrownThisTurn}/3]`;
    }

    const activePlayerKey = currentPlayer === 1 ? "player1" : "player2";
    const remaining = scores501[activePlayerKey] - points;

    if (remaining === 0) {
        scores501[activePlayerKey] = 0;
        updateScoreHUD();
        endGame(activePlayerKey);
        return;
    } else if (remaining < 0) {
        if (currentPlayer === 1) lastP1El.textContent = "BUST ! Trop bas !";
        else lastP2El.textContent = "BUST ! Trop bas !";
        
        scoreThisTurn = 0;
        endTurn();
        return;
    }

    if (dartsThrownThisTurn >= 3) {
        scores501[activePlayerKey] -= scoreThisTurn;
        updateScoreHUD();
        endTurn();
    }
});

function endTurn() {
    dartsThrownThisTurn = 0;
    scoreThisTurn = 0;
    currentPlayer = currentPlayer === 1 ? 2 : 1;
}

function updateScoreHUD() {
    ptsP1El.textContent = scores501.player1;
    ptsP2El.textContent = scores501.player2;
}

function endGame(winner) {
    gameRunning = false;
    recordWinner(winner);

    const title = document.getElementById("overlay-title");
    const sub = document.getElementById("overlay-sub");

    if (winner === "player1") {
        title.textContent = "ROUGE (J1) GAGNE !";
        title.style.color = COLOR_P1;
        sub.textContent = "Décompte finalisé à 0 avec un sang-froid absolu !";
    } else {
        title.textContent = "BLEU (J2) GAGNE !";
        title.style.color = COLOR_P2;
        sub.textContent = "Le sniper bleu a bouclé sa partie !";
    }

    overlay.style.display = "flex";
}

// --- BOUCLE DE RENDU GRAPHIQUE ---
function draw() {
    // Nettoyer l'écran à chaque frame
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- DESSIN DE LA CIBLE DE FLÉCHETTES ---
    const rings = [
        { r: targetRadius, col1: "#1b2216", col2: "#0f130d" },
        { r: targetRadius * 0.75, col1: "#2a3523", col2: "#1b2216" },
        { r: targetRadius * 0.50, col1: "#1b2216", col2: "#0f130d" },
        { r: targetRadius * 0.25, col1: "#2a3523", col2: "#1b2216" }
    ];

    const numSectors = 20;
    rings.forEach(ring => {
        for (let i = 0; i < numSectors; i++) {
            const startAngle = (i * 2 * Math.PI) / numSectors;
            const endAngle = ((i + 1) * 2 * Math.PI) / numSectors;
            ctx.fillStyle = (i % 2 === 0) ? ring.col1 : ring.col2;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, ring.r, startAngle, endAngle);
            ctx.fill();
        }
    });

    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, targetRadius * (i * 0.25), 0, Math.PI * 2);
        ctx.stroke();
    }

    // Centre : Vert
    ctx.fillStyle = "#3a6b32";
    ctx.beginPath(); ctx.arc(centerX, centerY, 28, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();

    // Centre : Rouge
    ctx.fillStyle = COLOR_P1;
    ctx.beginPath(); ctx.arc(centerX, centerY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.stroke();

    // --- OSCILLATION DU VISEUR ---
    // On met à jour l'angle UNIQUEMENT si la partie est lancée
    if (gameRunning) {
        angleX += speedX;
        angleY += speedY;
    }

    const targetX = centerX + Math.sin(angleX) * (targetRadius * 0.85);
    const targetY = centerY + Math.cos(angleY) * (targetRadius * 0.85);

    // Dessiner le réticule (si le jeu est en pause, il attend sagement au centre)
    ctx.lineWidth = 2;
    ctx.strokeStyle = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
    
    ctx.beginPath();
    ctx.arc(targetX, targetY, 16, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
    ctx.beginPath();
    ctx.arc(targetX, targetY, 3, 0, Math.PI * 2);
    ctx.fill();

    if (gameRunning) {
        ctx.fillStyle = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
        ctx.font = "bold 14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`TOUR DU JOUEUR ${currentPlayer}`, centerX, 40);
    }

    requestAnimationFrame(draw);
}

// --- ÉVÉNEMENTS BOUTONS ---
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => {
    prepareGame();
    startGame();
});

// Lancement de l'initialisation dans le bon ordre
fetchScores();
prepareGame();
requestAnimationFrame(draw); // Lancer la boucle d'affichage immédiatement
