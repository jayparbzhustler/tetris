const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const startButton = document.getElementById('start-button');
const pauseButton = document.getElementById('pause-button');

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 20;

const COLORS = [
    null,
    '#FF0D72', // I
    '#0DC2FF', // O
    '#0DFF72', // T
    '#F538FF', // S
    '#FF8E0D', // Z
    '#FFE138', // J
    '#3877FF', // L
];

let board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let isGameOver = false;
let animationFrameId;
let isPaused = false;

let player = {
    pos: { x: 0, y: 0 },
    matrix: null,
    next: null,
};

function createPiece(type) {
    switch (type) {
        case 'I':
            return [
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
                [0, 1, 0, 0],
            ];
        case 'O':
            return [
                [2, 2],
                [2, 2],
            ];
        case 'T':
            return [
                [0, 3, 0],
                [3, 3, 3],
                [0, 0, 0],
            ];
        case 'S':
            return [
                [0, 4, 4],
                [4, 4, 0],
                [0, 0, 0],
            ];
        case 'Z':
            return [
                [5, 5, 0],
                [0, 5, 5],
                [0, 0, 0],
            ];
        case 'J':
            return [
                [0, 6, 0],
                [0, 6, 0],
                [6, 6, 0],
            ];
        case 'L':
            return [
                [0, 7, 0],
                [0, 7, 0],
                [0, 7, 7],
            ];
        default:
            throw new Error('Invalid piece type');
    }
}

function drawMatrix(matrix, offset, targetContext = context) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                targetContext.fillStyle = COLORS[value];
                targetContext.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}

function draw() {
    // Set the background - using scaled coordinates
    context.fillStyle = '#000';
    context.fillRect(0, 0, COLS, ROWS);

    // Draw the text.
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
    context.fillStyle = 'rgba(255, 255, 255, 0.1)';
    context.font = 'bold 40px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('JayParbz', canvas.width / 2, canvas.height / 2);
    context.restore(); // Restore transform

    // Draw the grid on the scaled context
    drawGrid();

    // Draw the game elements
    drawMatrix(board, { x: 0, y: 0 });
    drawMatrix(player.matrix, player.pos);
}

function drawGrid() {
    context.strokeStyle = '#222';
    context.lineWidth = 1 / BLOCK_SIZE; // Make lines 1px wide after scaling

    for (let x = 0; x < COLS; x++) {
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, ROWS);
        context.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(COLS, y);
        context.stroke();
    }
}

function drawNext() {
    nextContext.fillStyle = '#1e1e1e';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (player.next) {
        drawMatrix(player.next, { x: 1, y: 1 }, nextContext);
    }
}

function merge() {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                board[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function rotate(matrix, dir) {
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }

    if (dir > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}

function playerDrop() {
    player.pos.y++;
    if (collide()) {
        player.pos.y--;
        merge();
        playerReset();
        boardSweep();
        updateScore();
    }
    dropCounter = 0;
}

function playerHardDrop() {
    while (!collide()) {
        player.pos.y++;
    }
    player.pos.y--;
    merge();
    playerReset();
    boardSweep();
    updateScore();
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide()) {
        player.pos.x -= dir;
    }
}

function playerRotate(dir) {
    const pos = player.pos.x;
    let offset = 1;
    rotate(player.matrix, dir);
    while (collide()) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > player.matrix[0].length) {
            rotate(player.matrix, -dir);
            player.pos.x = pos;
            return;
        }
    }
}

function collide() {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 &&
               (board[y + o.y] &&
                board[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerReset() {
    const shapes = 'IOTJLSZ';
    if (player.next === null) {
        player.matrix = createPiece(shapes[shapes.length * Math.random() | 0]);
    } else {
        player.matrix = player.next;
    }
    player.next = createPiece(shapes[shapes.length * Math.random() | 0]);
    player.pos.y = 0;
    player.pos.x = (board[0].length / 2 | 0) -
                   (player.matrix[0].length / 2 | 0);
    if (collide()) {
        board.forEach(row => row.fill(0));
        score = 0;
        updateScore();
        isGameOver = true;
        gameOverElement.style.display = 'flex';
        cancelAnimationFrame(animationFrameId);
    }
    drawNext();
}

function boardSweep() {
    let rowCount = 1;
    outer: for (let y = board.length - 1; y > 0; --y) {
        for (let x = 0; x < board[y].length; ++x) {
            if (board[y][x] === 0) {
                continue outer;
            }
        }

        const row = board.splice(y, 1)[0].fill(0);
        board.unshift(row);
        ++y;

        score += rowCount * 10;
        rowCount *= 2;
    }
}

function updateScore() {
    scoreElement.innerText = score;
}

function update(time = 0) {
    if (isGameOver || isPaused) return;

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    animationFrameId = requestAnimationFrame(update);
}

function startGame() {
    isGameOver = false;
    board.forEach(row => row.fill(0));
    score = 0;
    updateScore();
    playerReset();
    gameOverElement.style.display = 'none';
    startButton.textContent = 'Play Again';
    update();
}

document.addEventListener('keydown', event => {
    if (isGameOver || isPaused) return;
    switch (event.keyCode) {
        case 37: // Left
            playerMove(-1);
            event.preventDefault();
            break;
        case 39: // Right
            playerMove(1);
            event.preventDefault();
            break;
        case 40: // Down
            playerDrop();
            event.preventDefault();
            break;
        case 38: // Up
            playerRotate(1);
            event.preventDefault();
            break;
        case 32: // Space
            playerHardDrop();
            event.preventDefault();
            break;
    }
});

// Touch controls
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;

const touchZone = canvas;

touchZone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: false });

touchZone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    touchEndX = e.touches[0].clientX;
    touchEndY = e.touches[0].clientY;
}, { passive: false });

touchZone.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleSwipe();
}, { passive: false });

function handleSwipe() {
    if (isGameOver || isPaused) return;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // If it's more of a vertical swipe
    if (absDeltaY > absDeltaX) {
        if (deltaY > 50) { // Swipe Down
            playerDrop();
        } else if (deltaY < -50) { // Swipe Up
            playerHardDrop();
        }
    }
    // If it's more of a horizontal swipe
    else if (absDeltaX > absDeltaY) {
        if (deltaX > 50) { // Swipe Right
            playerMove(1);
        } else if (deltaX < -50) { // Swipe Left
            playerMove(-1);
        }
    }
    // If it's a tap (very little movement)
    else if (absDeltaX < 10 && absDeltaY < 10) {
        playerRotate(1);
    }

    // Reset touch coordinates
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
}

// Button controls
const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');
const rotateBtn = document.getElementById('rotate-btn');
const downBtn = document.getElementById('down-btn');
const dropBtn = document.getElementById('drop-btn');

if (leftBtn) {
    leftBtn.addEventListener('click', () => {
        if (!isGameOver && !isPaused) playerMove(-1);
    });
    rightBtn.addEventListener('click', () => {
        if (!isGameOver && !isPaused) playerMove(1);
    });
    rotateBtn.addEventListener('click', () => {
        if (!isGameOver && !isPaused) playerRotate(1);
    });
    downBtn.addEventListener('click', () => {
        if (!isGameOver && !isPaused) playerDrop();
    });
    dropBtn.addEventListener('click', () => {
        if (!isGameOver && !isPaused) playerHardDrop();
    });
}

context.scale(BLOCK_SIZE, BLOCK_SIZE);
nextContext.scale(BLOCK_SIZE, BLOCK_SIZE);

startButton.addEventListener('click', () => {
    startGame();
});

pauseButton.addEventListener('click', () => {
    isPaused = !isPaused;
    if (!isPaused) {
        update();
    }
    pauseButton.textContent = isPaused ? 'Resume' : 'Pause';
});
