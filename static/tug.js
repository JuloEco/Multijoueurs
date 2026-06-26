// --- CONFIGURATION & ELEMENTS DOM ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayStart = document.getElementById("overlay-start");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const scoreP1El = document.getElementById("score-p1");
const scoreP2El = document.getElementById("score-p2");
const pressP1El = document.getElementById("press-p1");
const pressP2El = document.getElementById("press-p2");

// Couleurs (issues de l'interface)
const COLOR_BG = "#141911";
const COLOR_LINE = "#2c3525";
const COLOR_P1 = "#df5b5b"; // Rouge J1
const COLOR_P2 = "#5b9bdf"; // Bleu J2
const COLOR_ROPE = "#d1e3cb"; // Corde
const COLOR_MARKER = "#8fb33f"; // Témoin lumineux central

// Variables logiques du jeu
let gameRunning = false;
let ropeX = canvas.width / 2; // Position X centrale du témoin
let pressP1 = 0;
let pressP2 = 0;

// Variables pour le Timer (30 secondes)
let timeLeft = 30;
let timerInterval = null;

// Limites de victoires immédiates (si le témoin touche les bords)
const winLimitLeft = 40;
const winLimitRight = canvas.width - 40;
const pullStrength = 8; // Pixels déplacés par pression

// Anti-maintien (mashing obligatoire)
let p1Ready = true;
let p2Ready = true;

// --- API FLASK (SCORES) ---
async function fetchScores() {
    try {
        const response = await fetch("/api/scores/tug");
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur scores:", e); }
}

async function recordWinner(winner) {
    try {
        const response = await fetch("/api/scores/tug/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ winner: winner })
        });
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur enregistrement:", e); }
}

// --- GESTION DE LA PARTIE ---
function prepareGame() {
    // Réinitialisation des positions et compteurs
    ropeX = canvas.width / 2;
    pressP1 = 0;
    pressP2 = 0;
    timeLeft = 30;
    
    pressP1El.textContent = pressP1;
    pressP2El.textContent = pressP2;
    
    overlay.style.display = "none";
    overlayStart.style.display = "flex";
    gameRunning = false;
    
    if (timerInterval) clearInterval(timerInterval);
    
    // Premier dessin statique en arrière-plan
    draw();
}

function startGame() {
    overlayStart.style.display = "none";
    overlay.style.display = "none";
    gameRunning = true;
    
    // Lancement du chrono de 30 secondes
    timerInterval = setInterval(() => {
        if (!gameRunning) return;
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Fin du temps imparti : celui qui a tiré le témoin dans son camp gagne !
            if (ropeX < canvas.width / 2) {
                endGame("player1");
            } else if (ropeX > canvas.width / 2) {
                endGame("player2");
            } else {
                // Égalité parfaite, on donne le point à personne ou un reset
                endGame("draw");
            }
        }
    }, 1000);
}

// --- ÉCOUTE DES TOUCHES (MASHING) ---
window.addEventListener("keydown", (e) => {
    if (!gameRunning) return;

    // J1 : Touche Q, A (pour claviers Azerty/Qwerty)
    if ((e.key === "q" || e.key === "Q" || e.key === "a" || e.key === "A") && p1Ready) {
        p1Ready = false; // Force à relâcher la touche
        pressP1++;
        pressP1El.textContent = pressP1;
        ropeX -= pullStrength; // Tire vers la gauche
        checkInstantWin();
    }

    // J2 : Touche P
    if ((e.key === "p" || e.key === "P") && p2Ready) {
        p2Ready = false; // Force à relâcher la touche
        pressP2++;
        pressP2El.textContent = pressP2;
        ropeX += pullStrength; // Tire vers la droite
        checkInstantWin();
    }
});

window.addEventListener("keyup", (e) => {
    if (e.key === "q" || e.key === "Q" || e.key === "a" || e.key === "A") p1Ready = true;
    if (e.key === "p" || e.key === "P") p2Ready = true;
});

// Vérification si un joueur a franchi la ligne rouge/bleue latérale
function checkInstantWin() {
    if (ropeX <= winLimitLeft) {
        clearInterval(timerInterval);
        endGame("player1");
    } else if (ropeX >= winLimitRight) {
        clearInterval(timerInterval);
        endGame("player2");
    }
}

function endGame(winner) {
    gameRunning = false;
    
    const title = document.getElementById("overlay-title");
    const sub = document.getElementById("overlay-sub");

    if (winner === "player1") {
        recordWinner("player1");
        title.textContent = "ROUGE (J1) GAGNE !";
        title.style.color = COLOR_P1;
        sub.textContent = `Victoire par K.O. technique avec ${pressP1} pressions !`;
    } else if (winner === "player2") {
        recordWinner("player2");
        title.textContent = "BLEU (J2) GAGNE !";
        title.style.color = COLOR_P2;
        sub.textContent = `La puissance à droite avec ${pressP2} pressions !`;
    } else {
        title.textContent = "ÉGALITÉ !";
        title.style.color = COLOR_MARKER;
        sub.textContent = "Le témoin est resté pile au milieu !";
    }

    overlay.style.display = "flex";
}

// --- DESSIN DU CANVA ---
function draw() {
    // Fond
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Lignes de délimitation de victoires (les pointillés dashed de chaque camp)
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLOR_P1;
    ctx.beginPath(); ctx.moveTo(winLimitLeft, 0); ctx.lineTo(winLimitLeft, canvas.height); ctx.stroke();
    
    ctx.strokeStyle = COLOR_P2;
    ctx.beginPath(); ctx.moveTo(winLimitRight, 0); ctx.lineTo(winLimitRight, canvas.height); ctx.stroke();

    // Ligne centrale originale de départ
    ctx.strokeStyle = COLOR_LINE;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0); ctx.lineTo(canvas.width / 2, canvas.height); ctx.stroke();

    // Dessin de la corde au milieu (ligne horizontale centrale)
    ctx.lineWidth = 6;
    ctx.strokeStyle = COLOR_ROPE;
    ctx.beginPath();
    ctx.moveTo(20, canvas.height / 2);
    ctx.lineTo(canvas.width - 20, canvas.height / 2);
    ctx.stroke();

    // Dessin du témoin lumineux mobile (Marqueur)
    ctx.fillStyle = gameRunning ? COLOR_MARKER : "#555";
    ctx.fillRect(ropeX - 6, canvas.height / 2 - 25, 12, 50);
    
    // Petit effet de halo lumineux si le jeu tourne
    if (gameRunning) {
        ctx.fillStyle = "rgba(143, 179, 63, 0.2)";
        ctx.fillRect(ropeX - 12, canvas.height / 2 - 30, 24, 60);
    }

    // Affichage textuel du Chrono restant en haut au centre
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${timeLeft}s`, canvas.width / 2, 30);

    // Boucle d'animation fluide
    requestAnimationFrame(draw);
}

// --- ÉVÉNEMENTS BOUTONS ---
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => {
    prepareGame();
    startGame();
});

// Initialisation globale
fetchScores();
prepareGame();
