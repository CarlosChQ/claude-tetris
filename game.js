'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - light blue
  '#ffb74d', // L - orange
  '#ff4081', // C - hot pink
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8,8],[8,0,0,8],[0,0,0,0],[0,0,0,0]], // C
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const skinSelect = document.getElementById('skin-select');

// colores del tema leídos de las variables CSS (se actualizan en applyTheme)
const theme = { boardBg: '#1a1a25', grid: '#22222e', highlight: 'rgba(255,255,255,0.12)', stroke: 'transparent' };

// trazo de rectángulo redondeado con arcTo (sin depender de roundRect)
function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// textura de damero para la skin pixel; el patrón se crea una vez por contexto y tamaño
const pixelPatterns = new Map();
function pixelPattern(context, p) {
  if (!pixelPatterns.has(context)) pixelPatterns.set(context, new Map());
  const cache = pixelPatterns.get(context);
  if (!cache.has(p)) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = p * 2;
    const t = tile.getContext('2d');
    t.fillStyle = 'rgba(0,0,0,0.18)';
    t.fillRect(p, 0, p, p);
    t.fillRect(0, p, p, p);
    cache.set(p, context.createPattern(tile, 'repeat'));
  }
  return cache.get(p);
}

// skins: colors alineado con COLORS; boardBg/grid null = usar los del tema claro/oscuro
const SKINS = {
  retro: {
    colors: COLORS,
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      context.fillStyle = color;
      context.fillRect(px + 1, py + 1, size - 2, size - 2);
      context.strokeStyle = theme.stroke;
      context.lineWidth = 1;
      context.strokeRect(px + 1.5, py + 1.5, size - 3, size - 3);
      context.fillStyle = theme.highlight;
      context.fillRect(px + 1, py + 1, size - 2, 4);
    },
  },
  neon: {
    colors: [null, '#00f0ff', '#fff200', '#d400ff', '#39ff14', '#ff073a', '#1f51ff', '#ff8c00', '#ff00a0'],
    boardBg: '#000000',
    grid: '#10141f',
    drawBlock(context, px, py, size, color, alpha) {
      context.shadowColor = color;
      context.shadowBlur = alpha < 1 ? 4 : 12;
      context.strokeStyle = color;
      context.lineWidth = 2;
      context.strokeRect(px + 3, py + 3, size - 6, size - 6);
      context.fillStyle = color;
      context.globalAlpha = alpha * 0.35;
      context.fillRect(px + 4, py + 4, size - 8, size - 8);
      context.globalAlpha = alpha;
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
    },
  },
  pastel: {
    colors: [null, '#a8e6ef', '#fdf0a6', '#d9b8e8', '#b9e4c0', '#f6b8b8', '#b3d4f5', '#fcd5a8', '#f9b4d0'],
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      roundedRectPath(context, px + 1.5, py + 1.5, size - 3, size - 3, size * 0.25);
      context.fillStyle = color;
      context.fill();
      context.strokeStyle = 'rgba(0,0,0,0.12)';
      context.lineWidth = 1;
      context.stroke();
      roundedRectPath(context, px + 5, py + 4, size - 10, size * 0.2, size * 0.1);
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fill();
    },
  },
  pixel: {
    colors: [null, '#3cbcfc', '#f8b800', '#9c4ad8', '#58d854', '#e40058', '#0058f8', '#f87858', '#f83898'],
    boardBg: null,
    grid: null,
    drawBlock(context, px, py, size, color) {
      const p = Math.max(2, Math.round(size / 10));
      context.fillStyle = color;
      context.fillRect(px, py, size, size);
      context.fillStyle = pixelPattern(context, p);
      context.fillRect(px, py, size, size);
      // bisel en escalones: claro arriba/izquierda, oscuro abajo/derecha
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.fillRect(px, py, size - p, p);
      context.fillRect(px, py, p, size - p);
      context.fillStyle = 'rgba(0,0,0,0.45)';
      context.fillRect(px + p, py + size - p, size - p, p);
      context.fillRect(px + size - p, py + p, p, size - p);
    },
  },
};
let skin = SKINS.retro;

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

// delega en la skin activa; save/restore evita que sombras o alpha se filtren
function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const a = alpha ?? 1;
  const px = x * size, py = y * size;
  // celdas power-up (type + POWER) cuando ese modo esté presente
  const isPower = typeof POWER !== 'undefined' && colorIndex > POWER;
  const type = isPower ? colorIndex % POWER : colorIndex;
  context.save();
  context.globalAlpha = a;
  skin.drawBlock(context, px, py, size, skin.colors[type], a, isPower);
  if (isPower) {
    context.globalAlpha = a;
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.font = `bold ${Math.round(size * 0.6)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('★', px + size / 2, py + size / 2 + 1);
  }
  context.restore();
}

function boardBackground() {
  return skin.boardBg ?? theme.boardBg;
}

function drawGrid() {
  ctx.fillStyle = boardBackground();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = skin.grid ?? theme.grid;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = boardBackground();
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return; // endGame() desde aquí no puede cancelar el frame en curso
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target === skinSelect) return; // con el selector enfocado las teclas son suyas
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(name) {
  document.documentElement.dataset.theme = name;
  const css = getComputedStyle(document.documentElement);
  theme.boardBg = css.getPropertyValue('--board-bg').trim();
  theme.grid = css.getPropertyValue('--grid').trim();
  theme.highlight = css.getPropertyValue('--highlight').trim();
  theme.stroke = css.getPropertyValue('--block-stroke').trim();
  const light = name === 'light';
  themeBtn.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeBtn.setAttribute('aria-pressed', String(light));
  // en pausa o game over el bucle está detenido: redibujar a mano
  if (current && next) { draw(); drawNext(); }
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur(); // evita que Espacio reactive el botón
});

applyTheme('dark');

const SKIN_KEY = 'tetris-skin';

function loadSkin() {
  try {
    const name = localStorage.getItem(SKIN_KEY);
    return Object.hasOwn(SKINS, name) ? name : 'retro';
  } catch {
    return 'retro';
  }
}

function applySkin(name) {
  if (!Object.hasOwn(SKINS, name)) name = 'retro';
  skin = SKINS[name];
  skinSelect.value = name;
  try { localStorage.setItem(SKIN_KEY, name); } catch { /* almacenamiento no disponible */ }
  // en pausa o game over el bucle está detenido: redibujar a mano
  if (current && next) { draw(); drawNext(); }
}

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  skinSelect.blur(); // devuelve el teclado al juego
});

applySkin(loadSkin());

init();
