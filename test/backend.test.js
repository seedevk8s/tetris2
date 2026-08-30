/* 백엔드 모듈 검증 (개발용) — 게임 실행에는 필요 없습니다.
   실행: node test/backend.test.js

   실제 Supabase 에 붙지 않습니다. fetch 를 스텁으로 갈아끼워
   "무엇을 어떤 헤더로 보내는가" 와 "실패를 어떻게 감싸는가" 를 확인합니다. */

'use strict';
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

// ── 스텁 ──────────────────────────────────
let calls = [];
let nextResponse = { ok: true, status: 200, json: async () => [] };

global.window = {};
global.fetch = async (url, opts = {}) => {
  calls.push({ url, method: (opts.method || 'GET'), headers: opts.headers || {}, body: opts.body });
  return nextResponse;
};

let fakeUser = { id: 'user-1', username: '나' };
global.TetrisAuth = {
  currentUser: () => fakeUser,
  getAccessToken: async () => (fakeUser ? 'token-abc' : null),
};

// supabase-config.js 와 api.js 를 한 덩어리로 실행합니다
// (최상위 const 는 같은 스코프에서만 보입니다)
const SUPABASE_CONFIG = new Function(
  'TetrisAuth',
  read('supabase-config.js') + read('api.js') + '\nreturn SUPABASE_CONFIG;'
)(global.TetrisAuth);
const API = global.window.TetrisBackend;

const respond = (status, body) => {
  nextResponse = { ok: status < 400, status, json: async () => body };
};

(async function run() {
  // ── 검증 ──────────────────────────────────
  let pass = 0, fail = 0;
  const ok = (name, cond) => { cond ? pass++ : (fail++, console.log('  FAIL:', name)); };

  // 1. 설정이 한 곳에서만 온다
  ok('URL 이 config 에서 옴', /supabase\.co$/.test(SUPABASE_CONFIG.url));
  ok('anon key 가 config 에서 옴', SUPABASE_CONFIG.anonKey.startsWith('eyJ'));
  // 문자열 검색이 아니라 키를 실제로 해독해 확인합니다 (주석에 단어가 나올 수 있으므로)
  const payload = JSON.parse(
    Buffer.from(SUPABASE_CONFIG.anonKey.split('.')[1], 'base64url').toString('utf8')
  );
  ok('키의 role 이 anon 이다 (service_role 아님)', payload.role === 'anon');
  ok('config 에 다른 JWT 가 섞여 있지 않음',
     (read('supabase-config.js').match(/eyJ[A-Za-z0-9._-]{40,}/g) || []).length === 1);

  // 2. 랭킹 정렬 — 점수 내림차순, 동점이면 먼저 도달한 쪽이 위
  const rows = [
    { username: 'a', score: 100, created_at: '2026-08-30T10:00:00Z' },
    { username: 'b', score: 300, created_at: '2026-08-30T10:00:00Z' },
    { username: 'c', score: 300, created_at: '2026-08-30T09:00:00Z' },
  ];
  const sorted = API.rankSort(rows);
  ok('점수 내림차순', sorted[0].score === 300 && sorted[2].score === 100);
  ok('동점이면 먼저 도달한 쪽이 위', sorted[0].username === 'c' && sorted[1].username === 'b');
  ok('원본 배열을 바꾸지 않음', rows[0].username === 'a');
  ok('빈 배열도 안전', API.rankSort([]).length === 0);

  // 3. 시각 표시
  ok('formatWhen 형식', /^\d{2}-\d{2} \d{2}:\d{2}$/.test(API.formatWhen('2026-08-30T12:34:56.789Z')));
  ok('잘못된 시각은 빈 문자열', API.formatWhen('이건날짜가아님') === '');

  // 4. 랭킹 조회 — 로그인 없이, 토큰 없이
  calls = []; respond(200, []);
  await API.getLeaderboard();
  let c = calls[0];
  ok('랭킹은 leaderboard 뷰를 부름', c.url.includes('/rest/v1/leaderboard'));
  ok('랭킹에 apikey 를 붙임', c.headers.apikey === SUPABASE_CONFIG.anonKey);
  ok('랭킹에 Authorization 을 붙이지 않음', !c.headers.Authorization);
  ok('랭킹 select 에 이메일이 없음', !/email/.test(c.url));
  ok('랭킹은 상위 10개', c.url.includes('limit=10'));

  // 5. 점수 등록 — 토큰을 붙이고 본인 id 로 보냄
  calls = []; respond(201, null);
  let r = await API.submitScore({ score: 1200, lines: 8, level: 2 });
  c = calls[0];
  ok('등록은 POST', c.method === 'POST');
  ok('등록에 토큰을 붙임', c.headers.Authorization === 'Bearer token-abc');
  ok('등록 본문에 본인 user_id', JSON.parse(c.body).user_id === 'user-1');
  ok('등록 본문에 점수·줄·레벨', JSON.parse(c.body).score === 1200 && JSON.parse(c.body).lines === 8);
  ok('등록 성공 시 ok:true', r.ok === true);

  // 6. 로그인하지 않았으면 등록을 시도조차 하지 않음
  fakeUser = null;
  calls = [];
  r = await API.submitScore({ score: 10, lines: 0, level: 1 });
  ok('비로그인 등록은 건너뜀', r.skipped === true && calls.length === 0);
  ok('비로그인 내기록은 빈 값', (await API.getMyBest()).data === null);
  fakeUser = { id: 'user-1', username: '나' };

  // 7. 실패를 던지지 않고 감쌈 — 게임이 멈추면 안 됩니다
  respond(403, { message: 'new row violates row-level security policy' });
  r = await API.submitScore({ score: 1, lines: 0, level: 1 });
  ok('RLS 거부를 ok:false 로 감쌈', r.ok === false && /row-level security/.test(r.error));

  respond(500, { message: 'boom' });
  r = await API.getLeaderboard();
  ok('서버 오류를 ok:false 로 감쌈', r.ok === false);

  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  r = await API.getLeaderboard();
  ok('네트워크 실패도 던지지 않음', r.ok === false && typeof r.error === 'string');

  // 8. 게임 코드가 백엔드를 직접 다루지 않는다 (CLAUDE.md 규약)
  const game = read('script.js');
  ok('script.js 에 fetch 없음', !/\bfetch\s*\(/.test(game));
  ok('script.js 에 supabase 주소 없음', !/supabase\.co/.test(game));
  ok('script.js 는 TetrisBackend 만 부름', /window\.TetrisBackend/.test(game));

  // 9. 이메일이 화면 경로에 실리지 않는다
  const ui = read('account-ui.js');
  ok('account-ui 가 이메일을 표시하지 않음', !/textContent\s*=\s*[^;]*email/i.test(ui));
  ok('닉네임 표시에 innerHTML 을 쓰지 않음', !/innerHTML/.test(ui));

  console.log(`\n  ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
})();
