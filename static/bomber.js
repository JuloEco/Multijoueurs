// --- CONFIGURATION & ELEMENTS DOM ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayStart = document.getElementById("overlay-start");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const scoreP1El = document.getElementById("score-p1");
const scoreP2El = document.getElementById("score-p2");
const hpP1El = document.getElementById("hp-p1");
const hpP2El = document.getElementById("hp-p2");
const trenchP1El = document.getElementById("trench-p1");
const trenchP2El = document.getElementById("trench-p2");

const turnBanner = document.getElementById("turn-banner");
const turnName = document.getElementById("turn-name");

// Couleurs de l'arcade
const COLOR_BG = "#11140f";
const COLOR_LINE = "#3a4530";
const COLOR_P1 = "#d6543c"; // Rouge
const COLOR_P2 = "#4f8fae"; // Bleu
const COLOR_PHOSPHOR = "#8fb33f";

// Logique du jeu
let gameRunning = false;
let currentPlayer = 1; // 1 = Rouge, 2 = Bleu
let playerHP = { player1: 100, player2: 100 };
let trenchHP = { player1: 100, player2: 100 };

// Entités
let plane = {
    x: 0,
    y: 80,
    width: 45,
    height: 18,
    speedX: 3,
    direction: 1 // 1 = Droite, -1 = Gauche
};

let bombs = [];
let particles = [];

// Tranchées (Coordonnées au sol)
// J1 (Rouge) est à gauche (Défend la zone gauche, attaque la droite)
// J2 (Bleu) est à droite (Défend la zone droite, attaque la gauche)
const trenchZones = {
    player1: { startX: 50, endX: 350, y: 460 },
    player2: { startX: 630, endX: 930, y: 460 }
};

// Contrôles des touches
let keys = {};

// --- API FLASK (SCORES ARCHIVÉS) ---
async function fetchScores() {
    try {
        const response = await fetch("/api/scores/bomber");
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur scores:", e); }
}

async function recordWinner(winner) {
    try {
        const response = await fetch("/api/scores/bomber/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ winner: winner })
        });
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur enregistrement:", e); }
}

// --- INITIALISATION DU JEU ---
function prepareGame() {
    playerHP = { player1: 100, player2: 100 };
    trenchHP = { player1: 100, player2: 100 };
    bombs = [];
    particles = [];
    currentPlayer = 1;
    
    updateHUD();
    resetPlane();

    overlay.style.display = "none";
    overlayStart.style.display = "flex";
    turnBanner.style.display = "none";
    gameRunning = false;
}

function startGame() {
    overlayStart.style.display = "none";
    overlay.style.display = "none";
    turnBanner.style.display = "block";
    gameRunning = true;
    resetPlane();
}

function resetPlane() {
    bombs = [];
    if (currentPlayer === 1) {
        // L'avion Rouge (J1) démarre à gauche et vole vers le camp Bleu (droite)
        plane.x = 20;
        plane.y = 80;
        plane.direction = 1;
        turnName.textContent = "ROUGE (J1)";
        turnName.style.color = COLOR_P1;
    } else {
        // L'avion Bleu (J2) démarre à droite et vole vers le camp Rouge (gauche)
        plane.x = canvas.width - 60;
        plane.y = 120; // Altitude légèrement différente pour varier
        plane.direction = -1;
        turnName.textContent = "BLEU (J2)";
        turnName.style.color = COLOR_P2;
    }
}

function switchTurn() {
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    resetPlane();
}

function updateHUD() {
    hpP1El.style.width = playerHP.player1 + "%";
    hpP2El.style.width = playerHP.player2 + "%";
    trenchP1El.textContent = Math.max(0, trenchHP.player1) + "%";
    trenchP2El.textContent = Math.max(0, trenchHP.player2) + "%";
}

// --- ENREGISTREMENT DES TOUCHES ---
window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;

    if (!gameRunning) return;

    // Gestion du largage (Une seule bombe à la fois par passage pour équilibrer)
    if (currentPlayer === 1 && e.key === " " && bombs.length === 0) {
        bombs.push({ x: plane.x + plane.width / 2, y: plane.y + plane.height, speedY: 4 });
    }
    if (currentPlayer === 2 && e.key === "Enter" && bombs.length === 0) {
        bombs.push({ x: plane.x + plane.width / 2, y: plane.y + plane.height, speedY: 4 });
    }
});

window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
});

// --- PARTICULES POUR LES EXPLOSIONS ---
function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 4 + 2,
            alpha: 1,
            color: color
        });
    }
}

// --- LOGIQUE METIER ET DEPLACEMENT ---
function update() {
    if (!gameRunning) return;

    // Déplacement manuel horizontal de l'avion selon les touches autorisées
    if (currentPlayer === 1) {
        if (keys["q"] || keys["a"]) plane.x -= 2;
        if (keys["d"]) plane.x += 4; // Aller plus vite vers l'avant
    } else {
        if (keys["arrowleft"]) plane.x -= 4; // Aller plus vite vers l'avant (gauche)
        if (keys["arrowright"]) plane.x += 2;
    }

    // Vol automatique continu vers sa cible
    plane.x += plane.speedX * plane.direction;

    // Gestion de la sortie d'écran de l'avion -> Changement de tour
    if ((plane.direction === 1 && plane.x > canvas.width) || 
        (plane.direction === -1 && plane.x < -plane.width)) {
        switchTurn();
        return;
    }

    // Gestion de la bombe
    bombs.forEach((bomb, index) => {
        bomb.y += bomb.speedY;

        // Collision avec le sol / les tranchées (y = 460)
        if (bomb.y >= 460) {
            createExplosion(bomb.x, bomb.y, COLOR_PHOSPHOR);
            
            // Vérifier quel camp est touché
            if (currentPlayer === 1) {
                // J1 Rouge attaque la tranchée de J2 (Bleu) à droite
                const target = trenchZones.player2;
                if (bomb.x >= target.startX && bomb.x <= target.endX) {
                    trenchHP.player2 -= 25; // 4 coups directs pour détruire la tranchée
                    createExplosion(bomb.x, bomb.y, COLOR_P2);
                }
            } else {
                // J2 Bleu attaque la tranchée de J1 (Rouge) à gauche
                const target = trenchZones.player1;
                if (bomb.x >= target.startX && bomb.x <= target.endX) {
                    trenchHP.player1 -= 25;
                    createExplosion(bomb.x, bomb.y, COLOR_P1);
                }
            }

            bombs.splice(index, 1);
            updateHUD();
            checkGameOver();
        }
    });

    // Évolution des particules
    particles.forEach((p, index) => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.02;
        if (p.alpha <= 0) particles.splice(index, 1);
    });
}

function checkGameOver() {
    if (trenchHP.player2 <= 0) {
        endGame("player1");
    } else if (trenchHP.player1 <= 0) {
        endGame("player2");
    }
}

function endGame(winner) {
    gameRunning = false;
    turnBanner.style.display = "none";
    recordWinner(winner);

    const title = document.getElementById("overlay-title");
    const sub = document.getElementById("overlay-sub");

    if (winner === "player1") {
        title.textContent = "L'AVION ROUGE GAGNE !";
        title.style.color = COLOR_P1;
        sub.textContent = "La tranchée bleue est réduite en cendres !";
    } else {
        title.textContent = "L'AVION BLEU GAGNE !";
        title.style.color = COLOR_P2;
        sub.textContent = "La base rouge a été totalement neutralisée !";
    }

    overlay.style.display = "flex";
}

// --- DESSIN DES GRAPHISMES CRON / HUD INTERNAL ---
function draw() {
    // Fond clean
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessin de la ligne d'horizon / Sol
    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 460);
    ctx.lineTo(canvas.width, 460);
    ctx.stroke();

    // Dessin du camp J1 Rouge (À gauche)
    ctx.fillStyle = trenchHP.player1 > 0 ? "#4a2118" : "#22110c";
    ctx.fillRect(trenchZones.player1.startX, 440, trenchZones.player1.endX - trenchZones.player1.startX, 20);
    ctx.strokeStyle = COLOR_P1;
    ctx.strokeRect(trenchZones.player1.startX, 440, trenchZones.player1.endX - trenchZones.player1.startX, 20);
    
    // Dessin du camp J2 Bleu (À droite)
    ctx.fillStyle = trenchHP.player2 > 0 ? "#1b2c35" : "#0d161a";
    ctx.fillRect(trenchZones.player2.startX, 440, trenchZones.player2.endX - trenchZones.player2.startX, 20);
    ctx.strokeStyle = COLOR_P2;
    ctx.strokeRect(trenchZones.player2.startX, 440, trenchZones.player2.endX - trenchZones.player2.startX, 20);

    // Dessin des étiquettes sur le sol
    ctx.font = "10px monospace";
    ctx.fillStyle = COLOR_P1;
    ctx.textAlign = "center";
    ctx.fillText("TRANCHÉE ROUGE", (trenchZones.player1.startX + trenchZones.player1.endX) / 2, 480);

    ctx.fillStyle = COLOR_P2;
    ctx.fillText("TRANCHÉE BLEUE", (trenchZones.player2.startX + trenchZones.player2.endX) / 2, 480);

    if (gameRunning) {
        // Dessin du Bombardier actif
        ctx.fillStyle = currentPlayer === 1 ? COLOR_P1 : COLOR_P2;
        ctx.fillRect(plane.x, plane.y, plane.width, plane.height);
        
        // Cockpit / Ailes minimalistes pixel-art style
        ctx.fillStyle = "#ffffff";
        if (plane.direction === 1) {
            ctx.fillRect(plane.x + plane.width - 10, plane.y + 2, 6, 4); // Cockpit vers la droite
        } else {
            ctx.fillRect(plane.x + 4, plane.y + 2, 6, 4); // Cockpit vers la gauche
        }
    }

    // Dessin des bombes en vol
    ctx.fillStyle = "#ffcc00";
    bombs.forEach(bomb => {
        ctx.beginPath();
        ctx.arc(bomb.x, bomb.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });

    // Dessin des particules d'explosions
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Boucle continue
    update();
    requestAnimationFrame(draw);
}

// --- ÉVÉNEMENTS ---
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => {
    prepareGame();
    startGame();
});

// Lancement direct
fetchScores();
prepareGame();
requestAnimationFrame(draw);
