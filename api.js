/* 점수·랭킹 API — Supabase 의 PostgREST 를 fetch 로 직접 부릅니다.

   여기 있는 모든 함수는 실패를 던지지 않고 결과 객체로 돌려줍니다.
   게임이 백엔드 때문에 멈추면 안 되기 때문입니다. (CLAUDE.md 백엔드 규약)

   window.TetrisBackend 로 노출합니다. */

'use strict';

window.TetrisBackend = (function () {

  const BASE = SUPABASE_CONFIG.url;
  const ANON = SUPABASE_CONFIG.anonKey;

  const TOP_N = 10;        // 랭킹에 보여줄 수
  const RECENT_N = 5;      // 내 최근 플레이 수

  function messageOf(body, status) {
    if (!body) return `요청이 실패했습니다 (HTTP ${status})`;
    return body.message || body.error_description || body.error || `요청이 실패했습니다 (HTTP ${status})`;
  }

  /** 인증이 필요한 요청은 만료 전에 토큰을 갱신해 붙입니다. */
  async function rest(path, options = {}, withAuth = false) {
    const headers = { apikey: ANON, 'Content-Type': 'application/json', ...(options.headers || {}) };

    if (withAuth) {
      const token = await TetrisAuth.getAccessToken();
      if (!token) throw new Error('로그인이 필요합니다.');
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE}/rest/v1${path}`, { ...options, headers });

    let body = null;
    try { body = await res.json(); } catch { /* 201 + return=minimal 등 본문 없음 */ }

    if (!res.ok) {
      const err = new Error(messageOf(body, res.status));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /** 실패를 { ok:false, error } 로 감쌉니다. 호출부가 try/catch 를 잊어도 게임이 멈추지 않습니다. */
  async function guard(fn) {
    try {
      return { ok: true, data: await fn() };
    } catch (e) {
      return { ok: false, error: e.message || '네트워크에 연결할 수 없습니다.' };
    }
  }

  /* ── 조회 ── */

  /** 전체 랭킹 상위 N. 로그인하지 않아도 볼 수 있습니다(RLS 가 공개 조회를 허용). */
  function getLeaderboard(limit = TOP_N) {
    return guard(() => rest(
      `/leaderboard?select=score,lines,level,created_at,username&limit=${limit}`
    ));
  }

  /** 내 최고 점수 한 건. */
  function getMyBest() {
    const user = TetrisAuth.currentUser();
    if (!user) return Promise.resolve({ ok: true, data: null });

    return guard(async () => {
      const rows = await rest(
        `/scores?select=score,lines,level,created_at&user_id=eq.${encodeURIComponent(user.id)}` +
        `&order=score.desc&limit=1`, {}, true
      );
      return rows && rows[0] ? rows[0] : null;
    });
  }

  /** 내 최근 플레이. */
  function getMyRecent(limit = RECENT_N) {
    const user = TetrisAuth.currentUser();
    if (!user) return Promise.resolve({ ok: true, data: [] });

    return guard(() => rest(
      `/scores?select=score,lines,level,created_at&user_id=eq.${encodeURIComponent(user.id)}` +
      `&order=created_at.desc&limit=${limit}`, {}, true
    ));
  }

  /* ── 등록 ── */

  /** 점수 등록. 로그인하지 않았으면 조용히 넘어갑니다 — 게임은 그대로 끝납니다. */
  function submitScore({ score, lines, level }) {
    const user = TetrisAuth.currentUser();
    if (!user) return Promise.resolve({ ok: false, skipped: true });

    return guard(() => rest('/scores', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      // user_id 는 클라이언트가 보내지만 RLS 가 토큰의 주인과 대조합니다.
      // 남의 id 를 넣으면 403 으로 거부됩니다.
      body: JSON.stringify({ user_id: user.id, score, lines, level }),
    }, true));
  }

  /* ── 표시용 순수 함수 (테스트 대상) ── */

  /** 랭킹 정렬 — 점수 내림차순, 동점이면 먼저 도달한 쪽이 위.
      뷰가 이미 정렬해 주지만, 여러 곳에서 합쳐 보여줄 때를 위해 같은 규칙을 여기에도 둡니다. */
  function rankSort(rows) {
    return [...rows].sort((a, b) =>
      b.score - a.score || new Date(a.created_at) - new Date(b.created_at)
    );
  }

  /** 2026-08-30T12:34:56.789Z → "08-30 12:34" */
  function formatWhen(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  return {
    getLeaderboard, getMyBest, getMyRecent, submitScore,
    rankSort, formatWhen,
    TOP_N, RECENT_N,
  };
})();
