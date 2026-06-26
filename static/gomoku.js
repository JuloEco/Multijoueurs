// --- CONFIGURATION & ELEMENTS DOM ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayStart = document.getElementById("overlay-start");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const scoreP1El = document.getElementById("score-p1");
const scoreP2El = document.getElementById("score-p2");
const stonesP1El = document.getElementById("stones-p1");
const stonesP2El = document.getElementById("stones-p2");

// Couleurs de l'arcade
const COLOR_BG = "#141911";
const COLOR_LINE = "#2c3525";
const COLOR_P1 = "#df5b5b"; // Rouge J1
const COLOR_P2 = "#5b9bdf"; // Bleu J2

// Variables logiques de la grille (Gomoku réglementaire : 15x15)
const gridSize = 15;
const padding = 30; // Marge sur les bords du canvas
const cellSize = (canvas.width - padding * 2) / (gridSize - 1);

let gameRunning = false;
let board = []; // Matrice 15x15 (0: vide, 1: J1, 2: J2)
let currentPlayer = 1; // J1 commence toujours
let stonesP1 = 0;
let stonesP2 = 0;

// --- API FLASK (SCORES) ---
async function fetchScores() {
    try {
        const response = await fetch("/api/scores/gomoku");
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur de récupération des scores :", e); }
}

async function recordWinner(winner) {
    try {
        const response = await fetch("/api/scores/gomoku/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ winner: winner })
        });
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur d'enregistrement du score :", e); }
}

// --- LOGIQUE ET ENTRAÎNEMENT DU JEU ---
function prepareGame() {
    // Initialise le plateau vide
    board = [];
    for (let i = 0; i < gridSize; i++) {
        board[i] = new Array(gridSize).fill(0);
    }
    
    currentPlayer = 1;
    stonesP1 = 0;
    stonesP2 = 0;
    
    stonesP1El.textContent = stonesP1;
    stonesP2El.textContent = stonesP2;
    
    overlay.style.display = "none";
    overlayStart.style.display = "flex";
    gameRunning = false;
    
    draw();
}

function startGame() {
    overlayStart.style.display = "none";
    overlay.style.display = "none";
    gameRunning = true;
}

// Intercepter les clics sur la grille
// Intercepter les clics sur la grille (Corrigé avec facteur d'échelle)
canvas.addEventListener("click", (e) => {
    if (!gameRunning) return;

    // Calculer les coordonnées du clic par rapport au canvas affiché
    const rect = canvas.getBoundingClientRect();
    const xClicked = e.clientX - rect.left;
    const yClicked = e.clientY - rect.top;

    // --- CORRECTION DU DÉCALAGE (RATIO) ---
    // On convertit les coordonnées de l'écran vers les coordonnées internes du canvas (620x620)
    const x = xClicked * (canvas.width / rect.width);
    const y = yClicked * (canvas.height / rect.height);
    // --------------------------------------

    // Trouver l'intersection la plus proche sur la grille interne
    const col = Math.round((x - padding) / cellSize);
    const row = Math.round((y - padding) / cellSize);

    // Vérifier si le clic est bien dans les limites du plateau et sur une case vide
    if (col >= 0 && col < gridSize && row >= 0 && row < gridSize) {
        if (board[row][col] === 0) {
            board[row][col] = currentPlayer;

            // Incrémenter les compteurs individuels du HUD
            if (currentPlayer === 1) {
                stonesP1++;
                stonesP1El.textContent = stonesP1;
            } else {
                stonesP2++;
                stonesP2El.textContent = stonesP2;
            }

            // Vérifier s'il y a un gagnant
            if (checkWin(row, col)) {
                endGame(currentPlayer === 1 ? "player1" : "player2");
            } else if (stonesP1 + stonesP2 === gridSize * gridSize) {
                endGame("draw"); // Plateau complètement rempli
            } else {
                // Changer de joueur
                currentPlayer = currentPlayer === 1 ? 2 : 1;
            }
        }
    }
});
// Algorithme de vérification d'alignement de 5 pierres
function checkWin(row, col) {
    const player = board[row][col];
    const directions = [
        [0, 1],   // Horizontal
        [1, 0],   // Vertical
        [1, 1],   // Diagonale descendante (\)
        [1, -1]   // Diagonale ascendante (/)
    ];

    for (const [dr, dc] of directions) {
        let count = 1;

        // Regarder en avant
        let r = row + dr;
        let c = col + dc;
        while (r >= 0 && r < gridSize && c >= 0 && c < gridSize && board[r][c] === player) {
            count++;
            r += dr;
            c += dc;
        }

        // Regarder en arrière
        r = row - dr;
        c = col - dc;
        while (r >= 0 && r < gridSize && c >= 0 && c < gridSize && board[r][c] === player) {
            count++;
            r -= dr;
            c -= dc;
        }

        // Si on obtient un alignement de 5 pierres consécutives ou plus
        if (count >= 5) return true;
    }
    return false;
}

function endGame(winner) {
    gameRunning = false;
    
    const title = document.getElementById("overlay-title");
    const sub = document.getElementById("overlay-sub");

    if (winner === "player1") {
        recordWinner("player1");
        title.textContent = "ROUGE (J1) GAGNE !";
        title.style.color = COLOR_P1;
        sub.textContent = `Alignement parfait réalisé en ${stonesP1} coups !`;
    } else if (winner === "player2") {
        recordWinner("player2");
        title.textContent = "BLEU (J2) GAGNE !";
        title.style.color = COLOR_P2;
        sub.textContent = `Contre-attaque éclair victorieuse en ${stonesP2} coups !`;
    } else {
        title.textContent = "ÉGALITÉ !";
        title.style.color = "#fff";
        sub.textContent = "Le plateau est plein !";
    }

    overlay.style.display = "flex";
}

// --- DESSIN GRAPHIQUE ---
function draw() {
    // Effacer le canvas avec la couleur de fond
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessiner les lignes de la grille (intersections)
    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 1.5;

    for (let i = 0; i < gridSize; i++) {
        // Lignes horizontales
        ctx.beginPath();
        ctx.moveTo(padding, padding + i * cellSize);
        ctx.lineTo(canvas.width - padding, padding + i * cellSize);
        ctx.stroke();

        // Lignes verticales
        ctx.beginPath();
        ctx.moveTo(padding + i * cellSize, padding);
        ctx.lineTo(padding + i * cellSize, canvas.height - padding);
        ctx.stroke();
    }

    // Dessiner les points de repère traditionnels (Hoshi) présents sur un plateau de Go/Gomoku
    const hoshiPoints = [3, 7, 11];
    ctx.fillStyle = COLOR_LINE;
    for (const r of hoshiPoints) {
        for (const c of hoshiPoints) {
            ctx.beginPath();
            ctx.arc(padding + c * cellSize, padding + r * cellSize, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Dessiner les pierres placées sur le plateau
    for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
            const token = board[row][col];
            if (token !== 0) {
                const x = padding + col * cellSize;
                const y = padding + row * cellSize;

                ctx.beginPath();
                ctx.arc(x, y, cellSize * 0.42, 0, Math.PI * 2);
                
                if (token === 1) {
                    ctx.fillStyle = COLOR_P1;
                } else {
                    ctx.fillStyle = COLOR_P2;
                }
                
                ctx.fill();
                ctx.closePath();
            }
        }
    }

    // Garde la boucle d'affichage active pour un rendu réactif
    requestAnimationFrame(draw);
}

// --- ÉVÉNEMENTS BOUTONS ---
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", () => {
    prepareGame();
    startGame();
});

// Lancement automatique au chargement
fetchScores();
prepareGame();
