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

// colores del tema leídos de las variables CSS (se actualizan en applyTheme)
const theme = { grid: '#22222e', highlight: 'rgba(255,255,255,0.12)', stroke: 'transparent' };

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let combo, maxCombo; // locks consecutivos que limpian al menos una línea

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
  const linesBefore = lines;
  clearLines();
  updateCombo(lines > linesBefore);
  spawn();
}

function updateCombo(cleared) {
  combo = cleared ? combo + 1 : 0;
  maxCombo = Math.max(maxCombo, combo);
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

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.strokeStyle = theme.stroke;
  context.lineWidth = 1;
  context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  context.fillStyle = theme.highlight;
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = theme.grid;
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
  showGameOverRecords();
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
  combo = 0;
  maxCombo = 0;
  hideGameOverRecords();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (handleRecordsKey(e)) return;
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

// ---- Tabla de récords (localStorage) ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const gameoverRecords = document.getElementById('gameover-records');
const recordForm = document.getElementById('record-form');
const recordName = document.getElementById('record-name');
let pendingRecord = null; // puntuación de la partida terminada que entra en el top
let focusTimer;

function emptyRecords() {
  return { top: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || typeof data !== 'object') return emptyRecords();
    const num = v => (Number.isFinite(v) && v > 0 ? v : 0);
    const top = (Array.isArray(data.top) ? data.top : [])
      .filter(r => r && typeof r === 'object' && Number.isFinite(r.score))
      .map(r => ({
        name: (typeof r.name === 'string' ? r.name.slice(0, 12) : '') || 'Anónimo',
        score: r.score,
        lines: num(r.lines),
        combo: num(r.combo),
        date: typeof r.date === 'string' ? r.date : '',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECORDS);
    return { top, bestCombo: num(data.bestCombo), maxLines: num(data.maxLines) };
  } catch {
    return emptyRecords();
  }
}

function saveRecords(rec) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(rec));
  } catch {
    // almacenamiento no disponible: los récords solo duran esta sesión
  }
}

function qualifies(rec, pts) {
  if (pts <= 0) return false;
  return rec.top.length < MAX_RECORDS || pts > rec.top[rec.top.length - 1].score;
}

// pinta una tabla de récords; los nombres siempre via textContent
function renderRecords(root, rec, highlight = -1) {
  const tbody = root.querySelector('.records-body');
  tbody.replaceChildren();
  if (!rec.top.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.className = 'records-empty';
    td.textContent = 'Sin récords todavía';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  rec.top.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i === highlight) tr.className = 'record-new';
    const d = new Date(r.date);
    const cells = [i + 1, r.name, r.score.toLocaleString(), r.lines, r.combo,
      isNaN(d) ? '-' : d.toLocaleDateString()];
    for (const v of cells) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  root.querySelector('.best-combo').textContent = rec.bestCombo;
  root.querySelector('.max-lines').textContent = rec.maxLines;
}

function showGameOverRecords() {
  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);
  pendingRecord = qualifies(rec, score) ? { score, lines, combo: maxCombo } : null;
  recordForm.classList.toggle('hidden', !pendingRecord);
  renderRecords(gameoverRecords, rec);
  gameoverRecords.classList.remove('hidden');
  if (pendingRecord) {
    recordName.value = '';
    // retraso para que las teclas de juego aún pulsadas no se escriban en el nombre
    clearTimeout(focusTimer);
    focusTimer = setTimeout(() => { recordName.value = ''; recordName.focus(); }, 600);
  }
}

function hideGameOverRecords() {
  clearTimeout(focusTimer);
  if (pendingRecord) savePendingRecord(); // Reiniciar sin pulsar Guardar no pierde el récord
  gameoverRecords.classList.add('hidden');
}

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  if (!pendingRecord) return;
  const { rec, index } = savePendingRecord();
  document.activeElement?.blur();
  recordForm.classList.add('hidden');
  renderRecords(gameoverRecords, rec, index);
});

function savePendingRecord() {
  const entry = {
    name: recordName.value.trim().slice(0, 12) || 'Anónimo',
    ...pendingRecord,
    date: new Date().toISOString(),
  };
  const rec = loadRecords();
  rec.top.push(entry);
  rec.top.sort((a, b) => b.score - a.score);
  rec.top = rec.top.slice(0, MAX_RECORDS);
  saveRecords(rec);
  pendingRecord = null;
  return { rec, index: rec.top.indexOf(entry) };
}

function resetRecords(root) {
  if (!confirm('¿Seguro que quieres borrar todos los récords?')) return;
  try { localStorage.removeItem(RECORDS_KEY); } catch { /* sin almacenamiento */ }
  renderRecords(root, emptyRecords());
}

for (const btn of document.querySelectorAll('.reset-records-btn')) {
  btn.addEventListener('click', () => {
    resetRecords(btn.closest('.records-view'));
    btn.blur();
  });
}

function startGame() {
  startScreen.classList.add('hidden');
  playBtn.blur(); // evita que Espacio vuelva a pulsar el botón
  init();
}

// devuelve true si la tecla la consumen la pantalla de inicio o el campo de nombre
function handleRecordsKey(e) {
  if (e.target === recordName) return true;
  if (!startScreen.classList.contains('hidden')) {
    const otherBtn = e.target.tagName === 'BUTTON' && e.target !== playBtn;
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !otherBtn) {
      e.preventDefault();
      startGame();
    }
    return true;
  }
  return !current; // defensivo: sin partida iniciada no hay pieza que mover
}

playBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', () => restartBtn.blur());

renderRecords(startScreen, loadRecords());
