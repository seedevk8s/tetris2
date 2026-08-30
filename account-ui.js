/* 계정·랭킹 화면 배선
   auth.js(인증)와 api.js(데이터)를 화면에 붙입니다. 게임 로직은 여기 없습니다.

   사용자 입력을 화면에 넣을 때는 textContent 만 씁니다 —
   닉네임에 <script> 를 넣어 두는 것을 막기 위해서입니다. */

'use strict';

(function () {

  const MIN_PASSWORD = 8;
  const MIN_USERNAME = 2;
  const MAX_USERNAME = 16;

  const $ = id => document.getElementById(id);

  const accountOut = $('accountOut');
  const accountIn = $('accountIn');
  const accountName = $('accountName');
  const accountBest = $('accountBest');

  const rankList = $('rankList');
  const rankMsg = $('rankMsg');

  const modal = $('authModal');
  const authTitle = $('authTitle');
  const authTabs = $('authTabs');
  const authForm = $('authForm');
  const authEmail = $('authEmail');
  const authUsername = $('authUsername');
  const authPassword = $('authPassword');
  const authMsg = $('authMsg');
  const fieldUsername = $('fieldUsername');
  const fieldPassword = $('fieldPassword');
  const btnSubmit = $('btnAuthSubmit');
  const btnForgot = $('btnForgot');

  let mode = 'signin';   // signin | signup | forgot | reset

  /* ── 모달 ── */

  function openModal(next = 'signin') {
    setMode(next);
    modal.hidden = false;
    if (window.TetrisGame) TetrisGame.suspend();
    authEmail.focus();
  }

  function closeModal() {
    modal.hidden = true;
    authForm.reset();
    setMsg('');
    if (window.TetrisGame) TetrisGame.resume();
    applyGate(TetrisAuth.currentUser());   // 로그인하지 않고 닫으면 다시 잠금 화면으로
  }

  function setMsg(text, ok = false) {
    authMsg.textContent = text;
    authMsg.classList.toggle('is-ok', ok);
  }

  const TITLES = {
    signin: ['로그인', '로그인'],
    signup: ['회원가입', '가입하기'],
    forgot: ['비밀번호 재설정', '재설정 메일 받기'],
    reset:  ['새 비밀번호 설정', '비밀번호 변경'],
  };

  function setMode(next) {
    mode = next;
    const [title, submit] = TITLES[mode];
    authTitle.textContent = title;
    btnSubmit.textContent = submit;
    setMsg('');

    fieldUsername.hidden = mode !== 'signup';
    fieldPassword.hidden = mode === 'forgot';
    authEmail.parentElement.hidden = mode === 'reset';
    btnForgot.hidden = mode !== 'signin';
    authTabs.hidden = mode === 'forgot' || mode === 'reset';

    authPassword.autocomplete = (mode === 'signin') ? 'current-password' : 'new-password';

    for (const tab of authTabs.querySelectorAll('.tab')) {
      tab.classList.toggle('is-on', tab.dataset.mode === mode);
    }
  }

  /* ── 입력 검증 — 보내기 전에 한 번 거릅니다.
        서버도 검사하지만 왕복 없이 알려주는 편이 낫습니다.
        진짜 방어는 서버와 RLS 입니다. ── */

  function invalidReason() {
    const email = authEmail.value.trim();
    const pw = authPassword.value;
    const name = authUsername.value.trim();

    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return '이메일 형식을 확인해 주세요.';
    }
    if (mode !== 'forgot' && pw.length < MIN_PASSWORD) {
      return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다.`;
    }
    if (mode === 'signup' && (name.length < MIN_USERNAME || name.length > MAX_USERNAME)) {
      return `닉네임은 ${MIN_USERNAME}~${MAX_USERNAME}자로 입력해 주세요.`;
    }
    return null;
  }

  /* ── 제출 ── */

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const bad = invalidReason();
    if (bad) { setMsg(bad); return; }

    const email = authEmail.value.trim();
    const pw = authPassword.value;
    const name = authUsername.value.trim();

    btnSubmit.disabled = true;
    setMsg('처리 중…');

    try {
      if (mode === 'signup') {
        const r = await TetrisAuth.signUp(email, pw, name);
        if (r.needsEmailConfirm) {
          setMode('signin');
          setMsg('가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요.', true);
          return;
        }
        closeModal();

      } else if (mode === 'signin') {
        await TetrisAuth.signIn(email, pw);
        closeModal();

      } else if (mode === 'forgot') {
        const back = location.origin + location.pathname;
        await TetrisAuth.requestPasswordReset(email, back);
        setMsg('재설정 메일을 보냈습니다. 메일함을 확인해 주세요.', true);

      } else if (mode === 'reset') {
        await TetrisAuth.updatePassword(pw);
        setMode('signin');
        setMsg('비밀번호를 바꿨습니다. 다시 로그인해 주세요.', true);
      }
    } catch (err) {
      setMsg(explain(err));
    } finally {
      btnSubmit.disabled = false;
    }
  });

  /** Supabase 의 영문 오류를 필요한 만큼만 우리말로 바꿉니다.
      로그인 실패는 이메일과 비밀번호 중 무엇이 틀렸는지 구분해 알려주지 않습니다. */
  function explain(err) {
    const m = (err && err.message) || '';
    if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 올바르지 않습니다.';
    if (/Email not confirmed/i.test(m))       return '메일의 확인 링크를 먼저 눌러 주세요.';
    if (/already registered|already exists/i.test(m)) return '이미 가입된 이메일입니다.';
    if (/Password should be at least (\d+)/i.test(m)) {
      return `비밀번호는 ${m.match(/at least (\d+)/i)[1]}자 이상이어야 합니다.`;
    }
    if (/rate limit|too many/i.test(m)) return '요청이 너무 잦습니다. 잠시 뒤 다시 시도해 주세요.';
    if (/Failed to fetch|NetworkError/i.test(m)) return '서버에 연결할 수 없습니다.';
    return m || '알 수 없는 오류가 발생했습니다.';
  }

  /* ── 화면 갱신 ── */

  function renderAccount(user) {
    accountOut.hidden = !!user;
    accountIn.hidden = !user;
    if (user) accountName.textContent = user.username || '(닉네임 없음)';
  }

  async function renderMyBest() {
    if (!TetrisAuth.currentUser()) return;
    const r = await TetrisBackend.getMyBest();
    if (!r.ok) { accountBest.textContent = '기록을 불러오지 못했습니다'; return; }
    accountBest.textContent = r.data
      ? `최고 ${r.data.score.toLocaleString()}점 · ${r.data.lines}줄`
      : '최고 기록 없음';
  }

  async function renderRanking() {
    const r = await TetrisBackend.getLeaderboard();

    if (!r.ok) {
      // 랭킹을 못 불러와도 게임은 그대로입니다. 상태만 알립니다.
      rankMsg.hidden = false;
      rankMsg.textContent = '랭킹을 불러오지 못했습니다';
      return;
    }

    const rows = TetrisBackend.rankSort(r.data || []);
    const me = TetrisAuth.currentUser();

    rankList.textContent = '';
    for (const row of rows) {
      const li = document.createElement('li');
      if (me && row.username === me.username) li.classList.add('is-me');

      const name = document.createElement('span');
      name.className = 'rank__name';
      name.textContent = row.username;        // textContent — 닉네임을 HTML 로 해석하지 않습니다

      const score = document.createElement('span');
      score.className = 'rank__score';
      score.textContent = row.score.toLocaleString();

      li.append(name, score);
      rankList.append(li);
    }

    rankMsg.hidden = rows.length > 0;
    if (!rows.length) rankMsg.textContent = '아직 기록이 없습니다';
  }

  function refreshAll() {
    renderRanking();
    renderMyBest();
  }

  /* ── 이벤트 ── */

  $('btnOpenAuth').addEventListener('click', () => openModal('signin'));
  $('btnCloseAuth').addEventListener('click', closeModal);

  $('btnSignOut').addEventListener('click', async () => {
    await TetrisAuth.signOut();
    accountBest.textContent = '최고 기록 없음';
    renderRanking();
  });

  btnForgot.addEventListener('click', () => setMode('forgot'));

  authTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) setMode(tab.dataset.mode);
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  document.addEventListener('keydown', (e) => {
    if (!modal.hidden && e.key === 'Escape') closeModal();
  });

  /* 로그인 게이트 — 로그인해야 게임이 시작됩니다.
     게임은 자기가 왜 잠겼는지 모르고, 잠금 문구는 여기서 넘깁니다. */
  function applyGate(user) {
    if (!window.TetrisGame) return;
    if (user) TetrisGame.unlock();
    else TetrisGame.lock('로그인이 필요합니다', '오른쪽 패널에서 로그인하거나 가입해 주세요');
  }

  TetrisAuth.onChange((user) => {
    renderAccount(user);
    applyGate(user);
    refreshAll();
  });

  /* 게임이 끝나면 점수가 올라가므로 랭킹을 다시 읽습니다.
     전송이 끝날 시점을 알 수 없어 짧게 기다렸다 갱신합니다. */
  const origSubmit = TetrisBackend.submitScore;
  TetrisBackend.submitScore = async function (result) {
    const r = await origSubmit(result);
    if (r.ok) refreshAll();
    return r;
  };

  /* ── 시작 ── */

  (async function boot() {
    // script.js 가 이미 잠긴 채로 시작합니다. 여기서는 세션을 확인해 풀기만 합니다.
    // 확인이 끝나기 전에는 잠긴 상태가 유지되므로 로그인 없이 플레이할 틈이 없습니다.
    const fromLink = await TetrisAuth.init();
    if (fromLink && fromLink.type === 'recovery') openModal('reset');
    applyGate(TetrisAuth.currentUser());
    refreshAll();
  })();

})();
