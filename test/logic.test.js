/* 게임 로직 검증 (개발용) — 게임 실행에는 필요 없습니다.
   실행: node test/logic.test.js

   script.js 는 브라우저 전용 파일이라 Node 용 export 가 한 줄도 들어 있지 않습니다.
   그래서 이 테스트가 script.js 를 텍스트로 읽어, 최소한의 DOM 스텁과 함께 실행합니다. */

'use strict';
const fs = require('fs');
const path = require('path');

// ── 최소 DOM 스텁 ─────────────────────────
const noop = () => {};
const stubCtx = new Proxy({}, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => (t[p] = v, true) });
const el = () => ({ getContext: () => stubCtx, addEventListener: noop, setAttribute: noop, width: 300, height: 600 });
global.document = { getElementById: el, addEventListener: noop, hidden: false };
global.window = {};   // AudioContext 없음 — ensureAudio() 가 조용히 넘어가는 경로
global.requestAnimationFrame = noop;
global.performance = { now: () => 0 };

const src = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

// ── 검증 본문 ─────────────────────────────
const tests = `
let pass = 0, fail = 0;
const ok = (name, cond) => { cond ? pass++ : (fail++, console.log('  FAIL:', name)); };

// 1. 조각 정의 — 7종, 각 회전 4벌이 정확히 4칸
ok('조각 7종', TYPES.length === 7);
for (const t of TYPES) {
  for (let r = 0; r < 4; r++) {
    const cs = SHAPES[t].rots[r];
    ok(t + ' rot' + r + ' 4칸', cs.length === 4);
    ok(t + ' rot' + r + ' 중복 없음', new Set(cs.map(c => c.join())).size === 4);
  }
}
for (const t of ['T','S','Z','J','L']) {
  const sigs = new Set(SHAPES[t].rots.map(r => JSON.stringify([...r].sort())));
  ok(t + ' 회전 4벌이 서로 다름', sigs.size === 4);
}
ok('O 는 회전해도 같음', new Set(SHAPES.O.rots.map(r => JSON.stringify(r))).size === 1);

// 2. 충돌 판정 — 벽·바닥·쌓인 블록
board = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
ok('왼쪽 벽 밖 거부', !isValid('O', 0, -2, 0));
ok('오른쪽 벽 밖 거부', !isValid('O', 0, COLS - 1, 0));
ok('바닥 밖 거부', !isValid('O', 0, 3, ROWS));
ok('빈 보드 한가운데 허용', isValid('T', 0, 3, 5));
board[19][3] = '#fff';
ok('쌓인 블록과 겹치면 거부', !isValid('O', 0, 2, 18));

// 3. 줄 삭제와 점수
const setup = (n) => {
  board = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
  for (let i = 0; i < n; i++) board[ROWS - 1 - i].fill('#fff');
  score = 0; lines = 0; level = 1; dropInterval = DROP_START;
};
for (const n of [1,2,3,4]) {
  setup(n);
  clearLines();
  ok(n + '줄 삭제 점수 ' + SCORE[n], score === SCORE[n]);
  ok(n + '줄 삭제 후 보드 비었음', board.every(row => row.every(c => c === null)));
  ok(n + '줄 삭제 후 행 수 유지', board.length === ROWS);
}
board = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
board[ROWS-1].fill('#fff');
board[ROWS-2][0] = '#abc';
score = 0; lines = 0; level = 1;
clearLines();
ok('삭제 후 윗 줄이 한 칸 내려옴', board[ROWS-1][0] === '#abc' && board[ROWS-2][0] === null);

// 4. 레벨업과 낙하 속도
setup(4); lines = 6; clearLines();
ok('10줄에서 레벨 2', level === 2);
ok('레벨 2 낙하가 더 빠름', dropInterval === DROP_START - DROP_STEP);
setup(1); lines = 199; clearLines();
ok('낙하 간격 하한 유지', dropInterval === DROP_MIN);

// 5. 하드드롭 — 착지 위치와 보너스
board = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
score = 0; lines = 0; level = 1; nextType = 'O';
piece = { type: 'O', rot: 0, x: 3, y: 0 };
hardDrop();
ok('하드드롭 후 바닥 두 줄이 채워짐', board[ROWS-1][4] && board[ROWS-1][5] && board[ROWS-2][4]);
ok('하드드롭 보너스 점수', score === 18 * HARD_DROP);

// 6. 회전 킥 — 벽에 붙어서도 회전
board = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
piece = { type: 'I', rot: 1, x: -2, y: 5 };
ok('벽에 붙은 세로 I 는 유효', isValid('I', 1, -2, 5));
rotate();
ok('벽 옆에서도 회전 성공', piece.rot === 2 && isValid(piece.type, piece.rot, piece.x, piece.y));

// 7. 게임오버 — 스폰 자리가 막힌 경우
board = Array.from({length: ROWS}, () => new Array(COLS).fill(null));
board[0].fill('#fff'); board[1].fill('#fff');
gameOver = false; score = 0; nextType = 'T';
spawn();
ok('스폰 막히면 게임오버', gameOver === true);

// 8. 7-bag — 7개마다 7종이 한 번씩
bag = [];
const drawn = Array.from({length: 7}, () => nextFromBag());
ok('7-bag 이 7종을 한 번씩', new Set(drawn).size === 7);

// 9. BGM — 음이름 파싱과 주파수
ok('freq(A4) = 440', Math.abs(freq('A4') - 440) < 1e-9);
ok('freq(A5) = 880 (한 옥타브)', Math.abs(freq('A5') - 880) < 1e-9);
ok('freq(C5) ≈ 523.25', Math.abs(freq('C5') - 523.2511) < 0.001);
ok('freq(G#4) ≈ 415.30', Math.abs(freq('G#4') - 415.3047) < 0.001);
for (const [name] of MELODY) {
  if (!name) continue;
  const f = freq(name);
  ok(name + ' 주파수가 가청 범위', Number.isFinite(f) && f > 20 && f < 4000);
}

// 마디가 4박씩 정확히 떨어지는가 —
// 한 음의 박자를 잘못 적으면 이후 마디가 통째로 밀리고, 마디 첫 음을 짚는 베이스까지 어긋납니다
let beat = 0, bars = 0, ragged = 0;
for (const [, beats] of MELODY) {
  ok('박자가 0보다 큼', beats > 0);
  const before = Math.floor(beat / BEATS_PER_BAR);
  beat += beats;
  const after = Math.floor(beat / BEATS_PER_BAR);
  // 한 음이 마디 경계를 걸치면 안 됩니다 (경계에 정확히 끝나는 것은 정상)
  if (after > before && beat % BEATS_PER_BAR !== 0) ragged++;
  bars = after;
}
ok('마디 경계를 걸치는 음이 없음', ragged === 0);
ok('총 길이가 64박 (A 8마디 + B 8마디)', beat === 64);
ok('마디 수 16', bars === 16);
ok('한 바퀴가 약 25.6초', Math.abs(beat * BEAT - 25.6) < 1e-9);

// 마디 첫 음(베이스가 짚는 음)이 모두 실음인가
let b = 0, silentBar = 0;
for (const [name, beats] of MELODY) {
  if (b % BEATS_PER_BAR === 0 && !name) silentBar++;
  b += beats;
}
ok('마디 첫 음이 모두 실음', silentBar === 0);

// 오디오가 없는 환경에서도 조용히 넘어가는가 (AudioContext 미지원 브라우저)
ensureAudio();
ok('AudioContext 없으면 조용히 넘어감', audioCtx === null);

console.log('\\n  ' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exit(1);
`;

// script.js 의 최상위 let/const 는 같은 스코프에서만 보이므로 한 덩어리로 실행합니다
new Function(src + tests)();
