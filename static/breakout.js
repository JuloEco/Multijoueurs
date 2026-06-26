// --- CONFIGURATION & ELEMENTS DOM ---
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayStart = document.getElementById("overlay-start");
const btnStart = document.getElementById("btn-start");
const btnRestart = document.getElementById("btn-restart");

const scoreP1El = document.getElementById("score-p1");
const scoreP2El = document.getElementById("score-p2");
const bricksP1El = document.getElementById("bricks-p1");
const bricksP2El = document.getElementById("bricks-p2");

// Couleurs harmonisées avec l'interface
const COLOR_BG = "#141911";
const COLOR_LINE = "#2c3525";
const COLOR_P1 = "#df5b5b"; // Rouge J1
const COLOR_P2 = "#5b9bdf"; // Bleu J2
const COLOR_BALL = "#d1e3cb";

// Variables globales de jeu
let gameRunning = false;
const paddleWidth = 100;
const paddleHeight = 12;
const ballRadius = 7;

// Grille de briques
const brickRows = 5;
const brickCols = 5;
const brickHeight = 18;
const brickPadding = 8;
const brickOffsetTop = 40;
const brickOffsetLeft = 30;

// Calcul automatique de la largeur des briques pour chaque moitié de terrain
const brickWidth = (canvas.width / 2 - brickOffsetLeft * 2 - (brickCols - 1) * brickPadding) / brickCols;

// --- ETATS DES JOUEURS ---
const p1 = {
    paddleX: 0,
    ballX: 0,
    ballY: 0,
    dx: 5,
    dy: -5,
    bricks: [],
    remainingBricks: 0
};

const p2 = {
    paddleX: 0,
    ballX: 0,
    ballY: 0,
    dx: -5,
    dy: -5,
    bricks: [],
    remainingBricks: 0
};

// --- CONTROLES MOTEUR ---
const keys = {
    q: false, d: false,
    ArrowLeft: false, ArrowRight: false
};

window.addEventListener("keydown", (e) => {
    if (e.key === "q" || e.key === "Q") keys.q = true;
    if (e.key === "d" || e.key === "D") keys.d = true;
    if (e.key === "ArrowLeft") keys.ArrowLeft = true;
    if (e.key === "ArrowRight") keys.ArrowRight = true;
});

window.addEventListener("keyup", (e) => {
    if (e.key === "q" || e.key === "Q") keys.q = false;
    if (e.key === "d" || e.key === "D") keys.d = false;
    if (e.key === "ArrowLeft") keys.ArrowLeft = false;
    if (e.key === "ArrowRight") keys.ArrowRight = false;
});

// --- API FLASK (SCORES) ---
async function fetchScores() {
    try {
        const response = await fetch("/api/scores/breakout");
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur de récupération des scores:", e); }
}

async function recordWinner(winner) {
    try {
        const response = await fetch("/api/scores/breakout/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ winner: winner })
        });
        const data = await response.json();
        scoreP1El.textContent = data.player1;
        scoreP2El.textContent = data.player2;
    } catch (e) { console.error("Erreur d'enregistrement du score:", e); }
}

// --- INITIALISATION & PREPARATION ---
function initBricks(player, xOffset) {
    player.bricks = [];
    player.remainingBricks = brickRows * brickCols;
    for (let c = 0; c < brickCols; c++) {
        player.bricks[c] = [];
        for (let r = 0; r < brickRows; r++) {
            const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft + xOffset;
            const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
            player.bricks[c][r] = { x: brickX, y: brickY, status: 1 };
        }
    }
}

function resetBall(player, isP1) {
    player.ballX = isP1 ? canvas.width / 4 : 3 * canvas.width / 4;
    player.ballY = canvas.height - 50;
    player.dx = isP1 ? 5 : -5;
    player.dy = -5;
}

// Génère les briques et positionne les éléments en arrière-plan dès l'ouverture de la page
function prepareGame() {
    initBricks(p1, 0);
    initBricks(p2, canvas.width / 2);
    
    p1.paddleX = (canvas.width / 4) - paddleWidth / 2;
    p2.paddleX = (3 * canvas.width / 4) - paddleWidth / 2;
    
    resetBall(p1, true);
    resetBall(p2, false);

    bricksP1El.textContent = p1.remainingBricks;
    bricksP2El.textContent = p2.remainingBricks;
    
    overlay.style.display = "none";
    overlayStart.style.display = "flex"; // Force l'affichage du menu "COMMENCER"
}

function startGame() {
    overlayStart.style.display = "none";
    overlay.style.display = "none";
    gameRunning = true;
}

function restartGame() {
    prepareGame();
    startGame();
}

// --- PHYSIQUE & DEPLACEMENTS ---
function movePaddles() {
    // Déplacement J1 (Bloqué dans sa moitié gauche : 0 -> canvas.width / 2)
    if (keys.q && p1.paddleX > 0) p1.paddleX -= 7;
    if (keys.d && p1.paddleX < (canvas.width / 2) - paddleWidth) p1.paddleX += 7;

    // Déplacement J2 (Bloqué dans sa moitié droite : canvas.width / 2 -> canvas.width)
    if (keys.ArrowLeft && p2.paddleX > canvas.width / 2) p2.paddleX -= 7;
    if (keys.ArrowRight && p2.paddleX < canvas.width - paddleWidth) p2.paddleX += 7;
}

function updateBall(player, isP1, leftBound, rightBound) {
    player.ballX += player.dx;
    player.ballY += player.dy;

    // Rebond sur les murs latéraux de la zone dédiée
    if (player.ballX - ballRadius < leftBound || player.ballX + ballRadius > rightBound) {
        player.dx = -player.dx;
    }
    // Rebond sur le plafond supérieur
    if (player.ballY - ballRadius < 0) {
        player.dy = -player.dy;
    }

    // Perte de balle (Sol) -> Reset la balle du joueur fautif
    if (player.ballY + ballRadius > canvas.height) {
        resetBall(player, isP1);
        return;
    }

    // Rebond sur la raquette
    if (player.ballY + ballRadius >= canvas.height - paddleHeight - 10 && 
        player.ballY - ballRadius <= canvas.height - 10) {
        if (player.ballX > player.paddleX && player.ballX < player.paddleX + paddleWidth) {
            // Calcul de l'angle de rebond selon l'endroit de l'impact
            let relativeIntersectX = (player.paddleX + (paddleWidth / 2)) - player.ballX;
            let normalizedIntersectX = (relativeIntersectX / (paddleWidth / 2));
            player.dx = -normalizedIntersectX * 7;
            player.dy = -Math.abs(player.dy); // Renvoi vers le haut systématique
        }
    }

    // Collision avec la grille de briques
    for (let c = 0; c < brickCols; c++) {
        for (let r = 0; r < brickRows; r++) {
            let b = player.bricks[c][r];
            if (b.status === 1) {
                if (player.ballX + ballRadius > b.x && player.ballX - ballRadius < b.x + brickWidth &&
                    player.ballY + ballRadius > b.y && player.ballY - ballRadius < b.y + brickHeight) {
                    player.dy = -player.dy;
                    b.status = 0;
                    player.remainingBricks--;
                    
                    // Actualisation immédiate du HUD
                    if (isP1) bricksP1El.textContent = p1.remainingBricks;
                    else bricksP2El.textContent = p2.remainingBricks;

                    // Détection victoire
                    if (player.remainingBricks === 0) {
                        endGame(isP1 ? "player1" : "player2");
                    }
                }
            }
        }
    }
}

function endGame(winner) {
    gameRunning = false;
    recordWinner(winner);
    
    const title = document.getElementById("overlay-title");
    const sub = document.getElementById("overlay-sub");
    
    if (winner === "player1") {
        title.textContent = "ROUGE (J1) GAGNE !";
        title.style.color = COLOR_P1;
        sub.textContent = "Toutes les briques du camp gauche ont été détruites.";
    } else {
        title.textContent = "BLEU (J2) GAGNE !";
        title.style.color = COLOR_P2;
        sub.textContent = "Le camp droit a été vidé à une vitesse fulgurante !";
    }
    overlay.style.display = "flex";
}

// --- AFFICHAGE / RENDU GRAPHISME ---
function drawPaddle(x, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight);
}

// Correction majeure : On dessine uniquement si les coordonnées sont valides (supérieures à 0)
function drawBall(x, y) {
    if (x <= 0 || y <= 0) return;
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_BALL;
    ctx.fill();
    ctx.closePath();
}

function drawBricks(player, color) {
    if (!player.bricks || player.bricks.length === 0) return;
    for (let c = 0; c < brickCols; c++) {
        for (let r = 0; r < brickRows; r++) {
            if (player.bricks[c][r] && player.bricks[c][r].status === 1) {
                ctx.fillStyle = color;
                ctx.fillRect(player.bricks[c][r].x, player.bricks[c][r].y, brickWidth, brickHeight);
            }
        }
    }
}

function draw() {
    // Fond d'écran du Canvas
    ctx.fillStyle = COLOR_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ligne médiane de séparation
    ctx.strokeStyle = COLOR_LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();

    // Mettre à jour la logique physique seulement si la partie a démarré
    if (gameRunning) {
        movePaddles();
        updateBall(p1, true, 0, canvas.width / 2);
        updateBall(p2, false, canvas.width / 2, canvas.width);
    }

    // Affichage Joueur 1 (Gauche)
    drawBricks(p1, COLOR_P1);
    drawPaddle(p1.paddleX, COLOR_P1);
    drawBall(p1.ballX, p1.ballY);

    // Affichage Joueur 2 (Droite)
    drawBricks(p2, COLOR_P2);
    drawPaddle(p2.paddleX, COLOR_P2);
    drawBall(p2.ballX, p2.ballY);

    requestAnimationFrame(draw);
}

// --- COUPLAGE EVENEMENTS & LANCEMENT ---
btnStart.addEventListener("click", startGame);
btnRestart.addEventListener("click", restartGame);

// Déclenchement automatique de la pile de démarrage
fetchScores();
prepareGame();
requestAnimationFrame(draw);
