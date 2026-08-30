/* 테트리스 — 게임 로직
   라이브러리 없이 Canvas 2D + DOM API 만 사용합니다.

   구조
     보드 상태(board 배열)  ──→  draw() 가 배열만 읽어 렌더
     모든 이동·회전·낙하    ──→  isValid() 한 곳에서만 충돌 판정
*/

'use strict';

/* ──────────────────────────────────────────
   상수 — 규칙을 조정할 지점은 전부 여기 모아 둡니다
   ────────────────────────────────────────── */

const COLS = 10;          // 보드 가로 칸 수
const ROWS = 20;          // 보드 세로 칸 수
const CELL = 30;          // 칸 하나의 픽셀 크기 (canvas 300x600 과 맞물림)
const NEXT_CELL = 24;     // 다음 조각 미리보기 칸 크기

const DROP_START = 800;   // 레벨 1 의 낙하 간격(ms)
const DROP_STEP = 70;     // 레벨이 1 오를 때 줄어드는 간격(ms)
const DROP_MIN = 100;     // 낙하 간격 하한 — 이보다 빨라지지 않습니다
const LINES_PER_LEVEL = 10;

const SCORE = { 1: 100, 2: 300, 3: 500, 4: 800 };  // 한 번에 지운 줄 수별 점수
const SOFT_DROP = 1;      // ↓ 로 한 칸 내릴 때 보너스
const HARD_DROP = 2;      // Space 로 내려간 칸당 보너스

const MAX_DELTA = 100;    // 프레임 간격 상한(ms). 탭을 백그라운드에 뒀다 돌아와도
                          // 조각이 순간이동하지 않도록 누적 시간을 잘라 냅니다.

const KICKS = [0, -1, 1, -2, 2];  // 회전이 막혔을 때 좌우로 밀어 보는 거리

/* 조각 정의 — 7종의 색과 회전 상태 4벌.
   회전을 런타임에 행렬로 돌리지 않고 좌표를 미리 펼쳐 둡니다.
   I·O 의 회전 중심 예외를 따로 처리할 필요가 없어집니다.
   각 좌표는 조각 자신의 격자 안에서의 [x, y] 입니다. */
const SHAPES = {
  I: { color: '#5BC8D6', rots: [
    [[0,1],[1,1],[2,1],[3,1]],
    [[2,0],[2,1],[2,2],[2,3]],
    [[0,2],[1,2],[2,2],[3,2]],
    [[1,0],[1,1],[1,2],[1,3]],
  ]},
  O: { color: '#E3C04A', rots: [
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[2,1]],
  ]},
  T: { color: '#A87BD8', rots: [
    [[1,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[2,1],[1,2]],
    [[1,0],[0,1],[1,1],[1,2]],
  ]},
  S: { color: '#6DBE78', rots: [
    [[1,0],[2,0],[0,1],[1,1]],
    [[1,0],[1,1],[2,1],[2,2]],
    [[1,1],[2,1],[0,2],[1,2]],
    [[0,0],[0,1],[1,1],[1,2]],
  ]},
  Z: { color: '#DE6E6E', rots: [
    [[0,0],[1,0],[1,1],[2,1]],
    [[2,0],[1,1],[2,1],[1,2]],
    [[0,1],[1,1],[1,2],[2,2]],
    [[1,0],[0,1],[1,1],[0,2]],
  ]},
  J: { color: '#7093EA', rots: [
    [[0,0],[0,1],[1,1],[2,1]],
    [[1,0],[2,0],[1,1],[1,2]],
    [[0,1],[1,1],[2,1],[2,2]],
    [[1,0],[1,1],[0,2],[1,2]],
  ]},
  L: { color: '#E3A44A', rots: [
    [[2,0],[0,1],[1,1],[2,1]],
    [[1,0],[1,1],[1,2],[2,2]],
    [[0,1],[1,1],[2,1],[0,2]],
    [[0,0],[1,0],[1,1],[1,2]],
  ]},
};

const TYPES = Object.keys(SHAPES);
const SPAWN_X = 3;        // 모든 조각의 격자를 3번 열에 맞춰 내려보냅니다

/* ──────────────────────────────────────────
   DOM
   ────────────────────────────────────────── */

const boardCanvas = document.getElementById('board');
const ctx = boardCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayDesc = document.getElementById('overlayDesc');
const btnRestart = document.getElementById('btnRestart');

/* ──────────────────────────────────────────
   상태
   ────────────────────────────────────────── */

let board;          // ROWS × COLS. 빈 칸은 null, 채워진 칸은 색 문자열
let piece;          // { type, rot, x, y }
let nextType;
let bag = [];       // 7-bag — 같은 조각이 연달아 몰리는 것을 막습니다
let score, lines, level, dropInterval;
let dropTimer = 0;
let lastTime = 0;
let paused = false;
let gameOver = false;

/* ──────────────────────────────────────────
   조각 · 충돌
   ────────────────────────────────────────── */

/** 조각의 보드상 절대 좌표 4개. 판정과 렌더가 모두 이 함수를 씁니다. */
function cellsOf(type, rot, x, y) {
  return SHAPES[type].rots[rot].map(([cx, cy]) => [x + cx, y + cy]);
}

/** 유일한 충돌 판정 — 벽·바닥·이미 쌓인 블록을 검사합니다.
    이동·회전·낙하·하드드롭이 전부 이 함수를 거칩니다. */
function isValid(type, rot, x, y) {
  return cellsOf(type, rot, x, y).every(([cx, cy]) =>
    cx >= 0 && cx < COLS && cy < ROWS &&
    (cy < 0 || board[cy][cx] === null)   // 천장 위(cy<0)는 아직 보드 밖이라 통과
  );
}

/** 7종을 섞어 한 벌씩 꺼내 씁니다. 벌이 비면 다시 섞습니다. */
function nextFromBag() {
  if (bag.length === 0) {
    bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return bag.pop();
}

/** 다음 조각을 현재 조각으로 올리고, 새 다음 조각을 뽑습니다.
    스폰 자리가 이미 막혀 있으면 게임오버입니다. */
function spawn() {
  piece = { type: nextType, rot: 0, x: SPAWN_X, y: 0 };
  nextType = nextFromBag();
  drawNext();

  if (!isValid(piece.type, piece.rot, piece.x, piece.y)) {
    gameOver = true;
    showOverlay('게임 오버', `점수 ${score.toLocaleString()}\nR 또는 아래 버튼으로 다시 시작`);
  }
}

/* ──────────────────────────────────────────
   조작
   ────────────────────────────────────────── */

function move(dx, dy) {
  if (!isValid(piece.type, piece.rot, piece.x + dx, piece.y + dy)) return false;
  piece.x += dx;
  piece.y += dy;
  return true;
}

/** 회전. 그 자리에서 막히면 좌우로 조금씩 밀어 봅니다(간단한 월킥). */
function rotate() {
  const rot = (piece.rot + 1) % 4;
  for (const dx of KICKS) {
    if (isValid(piece.type, rot, piece.x + dx, piece.y)) {
      piece.rot = rot;
      piece.x += dx;
      return;
    }
  }
}

/** 한 칸 낙하. 더 못 내려가면 그 자리에 굳힙니다. */
function stepDown() {
  if (!move(0, 1)) lock();
}

function softDrop() {
  if (move(0, 1)) {
    score += SOFT_DROP;
    dropTimer = 0;      // 직접 내렸으니 자동 낙하 타이머는 초기화
    updateStats();
  } else {
    lock();
  }
}

function hardDrop() {
  let dropped = 0;
  while (move(0, 1)) dropped++;
  score += dropped * HARD_DROP;
  lock();
}

/* ──────────────────────────────────────────
   고정 · 줄 삭제
   ────────────────────────────────────────── */

function lock() {
  const color = SHAPES[piece.type].color;
  for (const [cx, cy] of cellsOf(piece.type, piece.rot, piece.x, piece.y)) {
    if (cy >= 0) board[cy][cx] = color;
  }
  clearLines();
  dropTimer = 0;
  spawn();
}

function clearLines() {
  let cleared = 0;

  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every(cell => cell !== null)) {
      board.splice(y, 1);                        // 꽉 찬 줄 제거
      board.unshift(new Array(COLS).fill(null)); // 위에 빈 줄 추가
      cleared++;
      y++;                                       // 내려온 줄을 다시 검사
    }
  }

  if (cleared === 0) return;

  score += SCORE[cleared];
  lines += cleared;
  level = Math.floor(lines / LINES_PER_LEVEL) + 1;
  dropInterval = Math.max(DROP_MIN, DROP_START - (level - 1) * DROP_STEP);
  updateStats();
}

/* ──────────────────────────────────────────
   렌더링 — 보드 배열만 읽어 그립니다
   ────────────────────────────────────────── */

function drawCell(c, x, y, size, color) {
  c.fillStyle = color;
  c.fillRect(x + 1, y + 1, size - 2, size - 2);

  // 위쪽에 옅은 하이라이트를 얹어 칸 경계를 또렷하게
  c.fillStyle = 'rgba(255,255,255,.18)';
  c.fillRect(x + 1, y + 1, size - 2, 3);
}

function draw() {
  ctx.fillStyle = '#12161E';
  ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  // 격자
  ctx.strokeStyle = '#1A202B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * CELL + .5, 0);
    ctx.lineTo(x * CELL + .5, ROWS * CELL);
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.moveTo(0, y * CELL + .5);
    ctx.lineTo(COLS * CELL, y * CELL + .5);
  }
  ctx.stroke();

  // 쌓인 블록
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawCell(ctx, x * CELL, y * CELL, CELL, board[y][x]);
    }
  }

  // 내려오는 중인 조각
  if (piece && !gameOver) {
    const color = SHAPES[piece.type].color;
    for (const [cx, cy] of cellsOf(piece.type, piece.rot, piece.x, piece.y)) {
      if (cy >= 0) drawCell(ctx, cx * CELL, cy * CELL, CELL, color);
    }
  }
}

function drawNext() {
  nextCtx.fillStyle = '#171C26';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

  const cells = SHAPES[nextType].rots[0];
  const xs = cells.map(c => c[0]);
  const ys = cells.map(c => c[1]);
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * NEXT_CELL;
  const h = (Math.max(...ys) - Math.min(...ys) + 1) * NEXT_CELL;
  const ox = (nextCanvas.width - w) / 2 - Math.min(...xs) * NEXT_CELL;
  const oy = (nextCanvas.height - h) / 2 - Math.min(...ys) * NEXT_CELL;

  for (const [cx, cy] of cells) {
    drawCell(nextCtx, ox + cx * NEXT_CELL, oy + cy * NEXT_CELL, NEXT_CELL, SHAPES[nextType].color);
  }
}

function updateStats() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

/* ──────────────────────────────────────────
   오버레이
   ────────────────────────────────────────── */

function showOverlay(title, desc) {
  overlayTitle.textContent = title;
  overlayDesc.textContent = desc;
  overlay.hidden = false;
}

function hideOverlay() {
  overlay.hidden = true;
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (paused) showOverlay('일시정지', 'P 를 눌러 계속');
  else hideOverlay();
}

/* ──────────────────────────────────────────
   게임 루프 — requestAnimationFrame + 경과시간 누적
   ────────────────────────────────────────── */

function loop(time) {
  const delta = Math.min(time - lastTime, MAX_DELTA);
  lastTime = time;

  if (!paused && !gameOver) {
    dropTimer += delta;
    if (dropTimer >= dropInterval) {
      dropTimer = 0;
      stepDown();
    }
  }

  draw();
  requestAnimationFrame(loop);
}

/* ──────────────────────────────────────────
   입력
   ────────────────────────────────────────── */

const GAME_KEYS = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Spacebar'];

document.addEventListener('keydown', (e) => {
  // 방향키·스페이스는 페이지를 스크롤시키므로 게임 키에 대해 막습니다
  if (GAME_KEYS.includes(e.key)) e.preventDefault();

  const key = e.key.toLowerCase();

  if (key === 'r') { start(); return; }
  if (key === 'p') { togglePause(); return; }
  if (paused || gameOver) return;

  switch (e.key) {
    case 'ArrowLeft':  move(-1, 0); break;
    case 'ArrowRight': move(1, 0);  break;
    case 'ArrowUp':    rotate();    break;
    case 'ArrowDown':  softDrop();  break;
    case ' ':
    case 'Spacebar':   hardDrop();  break;
  }
});

btnRestart.addEventListener('click', () => {
  start();
  btnRestart.blur();   // 포커스가 남으면 Space 가 버튼을 다시 누릅니다
});

// 탭을 벗어나면 자동으로 멈춥니다
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !paused && !gameOver) togglePause();
});

/* ──────────────────────────────────────────
   시작
   ────────────────────────────────────────── */

function start() {
  board = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));
  bag = [];
  nextType = nextFromBag();
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = DROP_START;
  dropTimer = 0;
  paused = false;
  gameOver = false;

  hideOverlay();
  updateStats();
  spawn();
}

start();
lastTime = performance.now();
requestAnimationFrame(loop);
