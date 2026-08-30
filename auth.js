/* 인증 — 이메일 · 비밀번호
   라이브러리를 쓰지 않고 Supabase 의 GoTrue 를 fetch 로 직접 부릅니다.
   라이브러리가 대신 해 주던 세션 저장·토큰 갱신을 여기서 처리합니다.

   window.TetrisAuth 로 노출합니다. */

'use strict';

window.TetrisAuth = (function () {

  const BASE = SUPABASE_CONFIG.url;
  const ANON = SUPABASE_CONFIG.anonKey;

  const STORE_KEY = 'tetris.session';
  const REFRESH_MARGIN = 60;     // 만료 60초 전에 미리 갱신합니다

  let session = null;            // { access_token, refresh_token, expires_at, user:{id, username} }
  let refreshing = null;         // 갱신 요청이 겹치지 않도록 잡아 둡니다
  const listeners = [];

  /* ── 저장소 — 실패해도 조용히 넘어갑니다 (사생활 보호 모드 등) ── */

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      session = raw ? JSON.parse(raw) : null;
    } catch { session = null; }
  }

  function saveSession() {
    try {
      if (session) localStorage.setItem(STORE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORE_KEY);
    } catch { /* 저장 못 해도 이번 세션 동안은 동작합니다 */ }
  }

  /* ── 공통 요청 ── */

  /** GoTrue·PostgREST 가 돌려주는 여러 형태의 오류에서 사람이 읽을 문장을 뽑습니다. */
  function messageOf(body, status) {
    if (!body) return `요청이 실패했습니다 (HTTP ${status})`;
    return body.error_description || body.msg || body.message ||
           body.error || `요청이 실패했습니다 (HTTP ${status})`;
  }

  async function authFetch(path, options) {
    const res = await fetch(BASE + path, {
      ...options,
      headers: { apikey: ANON, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });

    let body = null;
    try { body = await res.json(); } catch { /* 204 등 본문 없음 */ }

    if (!res.ok) {
      const err = new Error(messageOf(body, res.status));
      err.status = res.status;
      throw err;
    }
    return body;
  }

  /* ── 세션 ── */

  function now() { return Math.floor(Date.now() / 1000); }

  function setSession(data, username) {
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at || (now() + (data.expires_in || 3600)),
      user: { id: data.user && data.user.id, username: username || null },
    };
    saveSession();
  }

  function clearSession() {
    session = null;
    saveSession();
    emit();
  }

  function emit() {
    const u = currentUser();
    for (const fn of listeners) {
      try { fn(u); } catch { /* 구독자 하나가 터져도 나머지는 돕니다 */ }
    }
  }

  /** 만료가 임박했으면 refresh_token 으로 갱신합니다. */
  async function ensureFresh() {
    if (!session) return null;
    if (session.expires_at - now() > REFRESH_MARGIN) return session.access_token;

    if (!refreshing) {
      refreshing = authFetch('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: session.refresh_token }),
      }).then(data => {
        const name = session && session.user ? session.user.username : null;
        setSession(data, name);
        return session.access_token;
      }).catch(() => {
        clearSession();      // 갱신이 안 되면 로그인 상태를 유지할 수 없습니다
        return null;
      }).finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  /* ── 프로필 ── */

  /** 닉네임을 profiles 에서 읽어 옵니다. 이메일은 어디에도 쓰지 않습니다. */
  async function loadUsername() {
    if (!session || !session.user.id) return;
    try {
      const rows = await authFetch(
        `/rest/v1/profiles?select=username&id=eq.${encodeURIComponent(session.user.id)}`,
        { method: 'GET' }
      );
      if (rows && rows[0] && rows[0].username) {
        session.user.username = rows[0].username;
        saveSession();
      }
    } catch { /* 닉네임을 못 읽어도 로그인 자체는 유효합니다 */ }
  }

  /* ── 공개 API ── */

  function currentUser() {
    return session && session.user.id ? { ...session.user } : null;
  }

  /** 회원가입. 확인 메일 설정에 따라 결과가 둘로 갈립니다. */
  async function signUp(email, password, username) {
    const data = await authFetch('/auth/v1/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, data: { username } }),
    });

    // 확인 메일이 꺼져 있으면 토큰이 바로 옵니다.
    if (data && data.access_token) {
      setSession(data, username);
      await loadUsername();
      emit();
      return { signedIn: true };
    }

    // 켜져 있으면 사용자 정보만 오고, 메일의 링크를 눌러야 로그인됩니다.
    return { signedIn: false, needsEmailConfirm: true };
  }

  async function signIn(email, password) {
    const data = await authFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setSession(data, null);
    await loadUsername();
    emit();
    return currentUser();
  }

  async function signOut() {
    const token = session && session.access_token;
    clearSession();                       // 먼저 지웁니다 — 서버 호출이 실패해도 로그아웃은 됩니다
    if (!token) return;
    try {
      await authFetch('/auth/v1/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* 서버에서 못 지워도 이 브라우저에서는 로그아웃 상태입니다 */ }
  }

  /** 비밀번호 재설정 메일 — 링크를 누르면 redirectTo 로 돌아옵니다. */
  async function requestPasswordReset(email, redirectTo) {
    await authFetch(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /** 재설정 링크로 돌아온 뒤 새 비밀번호를 저장합니다. */
  async function updatePassword(password) {
    const token = await ensureFresh();
    if (!token) throw new Error('세션이 만료되었습니다. 재설정 메일을 다시 받아 주세요.');
    await authFetch('/auth/v1/user', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
  }

  /** 주소의 # 뒤에 토큰이 붙어 오는 경우는 비밀번호 재설정 링크뿐입니다.
      토큰이 주소창에 남지 않도록 즉시 지웁니다. */
  function consumeHashSession() {
    if (!location.hash || location.hash.length < 2) return null;

    const p = new URLSearchParams(location.hash.slice(1));
    const access = p.get('access_token');
    const type = p.get('type');
    if (!access) return null;

    setSession({
      access_token: access,
      refresh_token: p.get('refresh_token'),
      expires_in: Number(p.get('expires_in')) || 3600,
      user: { id: null },
    }, null);

    history.replaceState(null, '', location.pathname + location.search);
    return { type };
  }

  async function init() {
    loadSession();
    const fromLink = consumeHashSession();

    if (session) {
      const token = await ensureFresh();
      if (token) {
        if (!session.user.id) await loadCurrentUserId();
        if (!session.user.username) await loadUsername();
      }
    }
    emit();
    return fromLink;
  }

  /** 해시로 들어온 세션에는 사용자 id 가 없어 한 번 조회합니다. */
  async function loadCurrentUserId() {
    try {
      const user = await authFetch('/auth/v1/user', {
        method: 'GET',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (user && user.id) { session.user.id = user.id; saveSession(); }
    } catch { /* 못 읽으면 로그인 표시만 안 됩니다 */ }
  }

  function onChange(fn) { listeners.push(fn); }

  return {
    init, onChange, currentUser,
    signUp, signIn, signOut,
    requestPasswordReset, updatePassword,
    getAccessToken: ensureFresh,
  };
})();
