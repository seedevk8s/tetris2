# Supabase 도입 가이드

이 테트리스에 **로그인과 점수 저장**을 붙이는 절차입니다.
Supabase 가입부터 시작해, 배포본(<https://seedevk8s.github.io/tetris2/>)에서 동작하기까지의 순서를 정리했습니다.

> **구현 완료 (2026-08-30).** 1~3·6단계는 끝났고 코드도 붙었습니다.
> **남은 것은 4단계의 `Confirm email` 끄기와 5단계 리다이렉트 주소 등록**입니다.
> 4단계를 끝내지 않으면 가입할 때마다 확인 메일이 나가고, 무료 한도에 금방 막힙니다.

**함께 보는 문서**

| 문서 | 내용 |
|---|---|
| [DB_DESIGN.md](DB_DESIGN.md) | 테이블·인덱스·트리거·RLS 설계와 그렇게 정한 이유, 조회 패턴 |
| [PLAN.md](PLAN.md) | 무엇을 어떤 순서로 구현할지 (Phase 2) |
| [GITHUB_PAGES.md](GITHUB_PAGES.md) | 배포 절차 (이미 완료) |

---

## 먼저 — "전환"이 아니라 "신규 도입"입니다

이 프로젝트에는 **지금 백엔드가 없습니다.** 정적 HTML·CSS·JS 뿐이고 서버도, 데이터베이스도,
저장되는 값도 없습니다. 점수는 새로고침하면 사라집니다.
그래서 이 작업은 기존 백엔드를 Supabase로 옮기는 것이 아니라 **없던 백엔드를 새로 붙이는 것**입니다.

옮겨올 데이터도, 맞춰야 할 기존 API도 없다는 뜻이라 오히려 단순합니다.

## 무엇을 만드나

| 기능 | 내용 |
|---|---|
| 회원가입 | **이메일 · 비밀번호 · 닉네임** |
| 로그인 | 이메일 · 비밀번호 |
| 점수 저장 | 게임이 끝나면 점수·지운 줄·레벨을 기록 |
| 전체 랭킹 | 상위 10명을 닉네임과 함께 표시 |
| 내 기록 | 내 최고 점수와 최근 플레이 |

**로그인하지 않아도 게임은 그대로 됩니다.** 로그인은 기록을 남기고 싶을 때만 하는 선택이고,
Supabase가 죽어도 게임 자체는 멀쩡히 돌아가야 합니다. 이 원칙을 구현 내내 지킵니다.

**닉네임을 가입할 때 함께 받습니다.** 이메일 로그인은 GitHub 로그인과 달리 표시할 이름이 없는데,
이메일 주소를 랭킹에 그대로 쓰면 **모르는 사람에게 이메일이 공개됩니다.** 그래서 따로 받습니다.

---

## 역할 분담 — 누가 무엇을 하나

**Supabase 가입·프로젝트 생성·대시보드 설정은 사용자만 할 수 있습니다.**
계정 소유자만 할 수 있는 일이고, 이 환경에는 그 권한이 없습니다.
반면 **SQL 작성·프론트엔드 코드·문서·배포는 제가 합니다.**

| # | 할 일 | 누가 | 어디서 |
|---|---|---|---|
| 1 | Supabase 가입 | **사용자** | supabase.com |
| 2 | 프로젝트 생성 | **사용자** | Supabase 대시보드 |
| 3 | Project URL · anon key 확인해 알려주기 | **사용자** | Supabase 대시보드 |
| 4 | 이메일 로그인 설정 (확인 메일 정책 결정) | **사용자** | Supabase 대시보드 |
| 5 | 메일 링크가 돌아올 주소 등록 | **사용자** | Supabase 대시보드 |
| 6 | 테이블·보안정책 SQL 실행 | **사용자** | Supabase SQL Editor |
| — | 그 SQL 작성해 주기 | **Claude** | 이 터미널 |
| 7 | 프론트엔드 구현 (가입·로그인·저장·랭킹) | **Claude** | 이 터미널 |
| 8 | 문서 갱신 · 커밋 · 배포 | **Claude** | 이 터미널 |
| 9 | 배포본에서 동작 확인 | **사용자** | 브라우저 |

6단계는 **제가 SQL을 써 드리면 사용자가 붙여넣고 실행**하는 형태입니다.
대시보드에 접근할 방법이 없어 실행만 넘깁니다.

---

# 사용자가 해야 하는 일 (1~6단계)

## 1단계 — Supabase 가입

<https://supabase.com> → 우측 상단 **Start your project**

가입 방법은 **GitHub 계정으로 하는 것이 편합니다** — 이미 GitHub을 쓰고 계시고,
비밀번호를 새로 만들 필요가 없습니다. 이메일로 가입해도 무방합니다.

> 헷갈리기 쉬운 부분: **이건 사용자(개발자)가 Supabase 대시보드에 로그인하는 방법**이고,
> **게임 플레이어가 로그인하는 방법(이메일)과는 완전히 별개**입니다.

**신용카드는 필요 없습니다.** 무료 플랜으로 시작합니다.

## 2단계 — 프로젝트 생성

가입 후 **New project** 를 누르면 입력할 것이 넷입니다.

| 항목 | 값 | 이유 |
|---|---|---|
| Organization | 기본값 그대로 | 개인 계정이면 하나만 있습니다 |
| Name | `tetris2` | 배포 저장소와 이름을 맞춰 둡니다 |
| Database Password | **자동 생성 후 안전한 곳에 보관** | 아래 설명 참고 |
| Region | **Northeast Asia (Seoul)** | 한국에서 접속하므로 응답이 가장 빠릅니다 |

**Database Password 를 꼭 따로 저장하세요.** 이 비밀번호는 DB에 직접 붙을 때 쓰는 것으로,
지금 당장은 안 쓰지만 나중에 필요할 때 **다시 볼 수 없습니다**(재설정만 가능).
비밀번호 관리자나 메모에 남겨 두세요. **이 비밀번호는 저에게 알려주지 마세요** — 쓸 일이 없습니다.

프로젝트가 준비되는 데 **1~2분** 걸립니다.

## 3단계 — 접속 정보 확인해서 알려주기

프로젝트 대시보드에서 **Settings**(왼쪽 아래 톱니) → **API**

두 값이 필요합니다.

| 값 | 생김새 | 저에게 알려주기 |
|---|---|---|
| **Project URL** | `https://abcdefgh....supabase.co` | **네, 알려주세요** |
| **anon / public key** | `eyJhbGci...` 로 시작하는 긴 문자열 (또는 `sb_publishable_...`) | **네, 알려주세요** |
| ~~service_role key~~ | `eyJhbGci...` (secret 이라고 표시됨) | **절대 알려주지 마세요** |

**anon key 는 공개해도 되는 키입니다.** 브라우저 코드에 그대로 들어가고,
GitHub Pages는 정적 호스팅이라 소스를 누구나 볼 수 있습니다. 그게 정상입니다.
이 키는 "누구인지"를 증명하지 않고 **"어느 프로젝트인지"만** 가리킵니다.
실제 방어는 6단계의 **RLS(행 수준 보안)** 가 합니다.

**service_role key 는 RLS를 통째로 무시하는 마스터 키입니다.**
브라우저 코드나 저장소에 절대 들어가면 안 됩니다. 화면에서 보더라도 복사하지 마세요.

## 4단계 — 이메일 로그인 설정

Supabase 대시보드 → **Authentication** → **Sign In / Providers** → **Email**

**Email 은 기본으로 켜져 있습니다.** 켜져 있는지만 확인하면 됩니다.
여기서 **결정할 것이 하나** 있습니다.

### Confirm email — 켤 것인가 끌 것인가

가입할 때 **"메일함을 열어 링크를 눌러야 계정이 활성화되는" 절차**입니다. 기본값은 **켜짐**입니다.

| | 끄기 **(이 프로젝트에 권장)** | 켜두기 |
|---|---|---|
| 가입 경험 | 입력하면 **바로 로그인** | 메일 확인 후에야 로그인 |
| 필요한 준비 | 없음 | 실제로 메일이 가야 함 (아래 참고) |
| 적합한 곳 | 수업 과제·데모 | 실서비스 |

**끄는 것을 권합니다.** 이유는 발송 한도입니다.

> **Supabase가 기본 제공하는 메일 발송은 테스트용이고 한도가 매우 낮습니다**(시간당 몇 통 수준).
> 여러 명이 동시에 가입을 시도하면 **메일이 오지 않아 아무도 가입을 못 끝냅니다.**
> 정확한 한도는 대시보드의 **Authentication → Rate Limits** 에서 확인할 수 있습니다.
> 실서비스로 쓰려면 별도 SMTP(SendGrid·Resend 등)를 연결해야 하는데, 이 프로젝트 범위를 넘습니다.

**끄는 방법** — Authentication → Sign In / Providers → Email → **Confirm email** 을 끄고 Save.

이 선택의 대가는 분명합니다. **남의 이메일 주소로도 가입할 수 있게 됩니다.**
점수 랭킹 앱이라 감수할 만하지만, 알고 끄는 것과 모르고 끄는 것은 다릅니다.

### 비밀번호 규칙 (선택)

같은 화면 아래 **Password** 항목에서 최소 길이를 정할 수 있습니다. 기본은 6자입니다.
**8자 이상**을 권합니다. `Prevent use of leaked passwords` 옵션이 있으면 함께 켜 두세요.

## 5단계 — 메일 링크가 돌아올 주소 등록

**비밀번호 재설정**(그리고 확인 메일을 켰다면 가입 확인)은 메일 속 링크를 눌러
우리 페이지로 돌아오는 방식입니다. Supabase는 **미리 등록된 주소로만** 되돌려 줍니다.
아무 데로나 보내면 피싱에 쓰이기 때문입니다.

Supabase 대시보드 → **Authentication** → **URL Configuration**

| 항목 | 값 |
|---|---|
| Site URL | `https://seedevk8s.github.io/tetris2/` |
| Redirect URLs | `https://seedevk8s.github.io/tetris2/**` <br> `http://localhost:8080/**` |

**로컬 주소도 함께 넣어야 합니다.** 개발할 때 `python3 -m http.server 8080` 으로 열어 보는데,
그 주소가 등록돼 있지 않으면 로컬에서는 비밀번호 재설정 흐름을 테스트할 수 없습니다.

경로(`/tetris2/`)까지 정확히 넣어야 합니다. GitHub Pages는 저장소 이름이 경로에 들어갑니다.

> 로그인·회원가입 자체는 **리다이렉트 없이** 동작합니다(6단계 아래 설명 참고).
> 이 설정은 **메일 링크를 통해 돌아올 때만** 쓰입니다.

## 6단계 — 테이블과 보안정책 만들기

무엇을 왜 이렇게 만드는지는 **[DB_DESIGN.md](DB_DESIGN.md)** 에 정리해 두었습니다.
여기서는 실행만 합니다.

Supabase 대시보드 → **SQL Editor** → **New query** → 아래를 **통째로 붙여넣고 Run**

```sql
-- ─────────────────────────────────────────────
-- 1. 프로필 — 랭킹에 보여줄 닉네임
--    이메일 주소를 랭킹에 노출하지 않기 위해 따로 둡니다.
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text not null,
  created_at  timestamptz not null default now()
);

-- 가입할 때 함께 받은 닉네임을 프로필로 옮깁니다.
-- 프론트엔드가 직접 넣게 두면 남의 이름을 사칭하거나 프로필 없는 계정이 생깁니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'username'), ''),
      'player' || substr(new.id::text, 1, 4)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 2. 점수 기록
-- ─────────────────────────────────────────────
create table public.scores (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users on delete cascade,
  score       integer not null check (score >= 0),
  lines       integer not null check (lines >= 0),
  level       integer not null check (level >= 1),
  created_at  timestamptz not null default now()
);

create index scores_rank_idx on public.scores (score desc, created_at);
create index scores_user_idx on public.scores (user_id, score desc);

-- ─────────────────────────────────────────────
-- 3. RLS — 진짜 방어선
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

-- 랭킹은 누구나 볼 수 있어야 합니다 (로그인 안 해도)
create policy "프로필은 누구나 조회" on public.profiles
  for select using (true);

create policy "점수는 누구나 조회" on public.scores
  for select using (true);

-- 쓰기는 '자기 것만'. user_id 를 남의 것으로 넣으면 거부됩니다.
create policy "내 점수만 등록" on public.scores
  for insert with check (auth.uid() = user_id);

-- 기록은 고치거나 지울 수 없습니다 (update·delete 정책을 만들지 않음 = 전부 거부)

-- ─────────────────────────────────────────────
-- 4. 랭킹 조회용 뷰 — 점수와 닉네임을 함께
--    profiles 만 조인하므로 이메일은 어디에도 나오지 않습니다.
-- ─────────────────────────────────────────────
create view public.leaderboard
with (security_invoker = true) as
  select s.id, s.score, s.lines, s.level, s.created_at,
         p.username
  from public.scores s
  join public.profiles p on p.id = s.user_id
  order by s.score desc, s.created_at asc;
```

`Success. No rows returned` 가 나오면 된 것입니다.

**여기까지 끝나면 알려주세요.** 3단계의 Project URL과 anon key와 함께 주시면 구현을 시작합니다.

---

# Claude 가 하는 일 (7~8단계)

준비가 끝나면 아래를 구현합니다. **지금은 하지 않습니다.**

| 파일 | 역할 |
|---|---|
| `supabase-config.js` | Project URL · anon key **한 곳에만**. 환경이 바뀌면 이 파일만 교체 |
| `auth.js` | 회원가입 · 로그인 · 로그아웃 · 세션 저장/복원 · 토큰 갱신 |
| `api.js` | 점수 등록 · 랭킹 조회 · 내 기록 조회 (`fetch` 직접 호출) |
| `index.html` · `style.css` | 가입·로그인 폼, 랭킹 패널, 내 기록 표시 |
| `script.js` | 게임오버 시 점수 전송 (**실패해도 게임은 계속**) |
| `test/` | 랭킹 정렬·응답 파싱·입력 검증 등 순수 로직 검증 |
| 문서 4종 | `PLAN.md` · `README.md` · `WORKFLOW.md` · `CLAUDE.md` 갱신 |

---

# 설계 — 미리 정해 둔 것

## 라이브러리를 쓰지 않습니다

`CLAUDE.md` 의 **"라이브러리를 쓰지 않습니다"** 규약과 충돌하는 지점입니다.
보통은 `@supabase/supabase-js` 를 CDN으로 불러오지만, 그러면 이 프로젝트의 원칙이 깨집니다.

**Supabase는 그냥 HTTP API 입니다.** `fetch` 로 직접 부르면 라이브러리가 필요 없습니다.

```js
// 회원가입 — 닉네임은 data 로 함께 보냅니다 (트리거가 이 값을 읽습니다)
await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password, data: { username } }),
});

// 로그인 — 응답 본문에 토큰이 그대로 들어옵니다
const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const { access_token, refresh_token, expires_in } = await res.json();

// 랭킹 상위 10개 — 로그인 없이도 됩니다
await fetch(`${SUPABASE_URL}/rest/v1/leaderboard?select=*&limit=10`,
  { headers: { apikey: ANON_KEY } });
```

## 이메일 로그인이 OAuth보다 단순한 지점

처음에는 GitHub OAuth로 계획했다가 이메일로 바꿨습니다. **인증 흐름이 훨씬 짧아졌습니다.**

```
[OAuth 였다면]
  버튼 클릭 → GitHub 승인 화면 → Supabase 콜백 → 우리 페이지로 리다이렉트
  → 주소의 #access_token=... 을 파싱 → 주소창 정리 → 저장

[이메일]
  폼 제출 → POST /auth/v1/token → 응답 JSON 에 토큰 → 저장
```

**페이지를 떠났다 돌아오지 않으므로** 해시 파싱도, 주소창 정리도 필요 없습니다.
OAuth 앱 등록·Client Secret 관리도 사라집니다.

대신 **늘어나는 것**도 있습니다.

| 늘어나는 것 | 내용 |
|---|---|
| 화면 | 버튼 하나가 아니라 가입·로그인 폼 두 개 |
| 입력 검증 | 이메일 형식, 비밀번호 길이, 닉네임 길이 |
| 에러 처리 | 이메일 중복, 비밀번호 틀림, 미확인 계정 |
| 비밀번호 재설정 | 이 흐름만 메일 링크 → 리다이렉트가 필요 |

비밀번호를 직접 다루므로 **`type="password"` 를 쓰고, 값을 로그에 남기지 않고,
어디에도 저장하지 않습니다.** GitHub Pages는 HTTPS라 전송 구간은 안전합니다.

## 세션은 직접 유지해야 합니다

라이브러리가 대신 해 주던 일입니다.

| 지점 | 처리 |
|---|---|
| 새로고침하면 로그아웃됨 | `localStorage`에 세션 저장, 로드 시 복원 |
| 토큰 만료(기본 1시간) | `expires_at` 확인 후 `/auth/v1/token?grant_type=refresh_token` |
| 만료된 토큰으로 요청 | 401이 오면 한 번 갱신하고 재시도 |

## 데이터 구조와 보안

설계 전문은 **[DB_DESIGN.md](DB_DESIGN.md)** 에 있습니다. 여기서는 결론만 옮깁니다.

- **테이블은 둘입니다** — `scores`(기록)와 `profiles`(닉네임).
  이메일 로그인에서는 이 분리가 **개인정보 문제**이기도 합니다.
  한 테이블로 합쳐 이메일을 표시에 쓰면 랭킹에 남의 이메일이 공개됩니다.
  → [왜 테이블이 둘인가](DB_DESIGN.md#왜-테이블이-둘인가)
- **anon key가 공개돼도 안전한 이유는 RLS 입니다.** 누구나 API를 부를 수 있지만,
  부르더라도 **자기 계정으로만** 쓸 수 있고 수정·삭제는 아무도 못 합니다.
  → [RLS — 실제 방어선](DB_DESIGN.md#rls--실제-방어선)
- **점수 조작은 막지 못합니다.** 게임이 브라우저에서만 돌기 때문에 개발자 도구로
  가짜 점수를 등록하는 것을 클라이언트 쪽에서 막을 방법이 없습니다.
  알고 넘어가는 한계입니다. → [막지 못하는 것 — 점수 조작](DB_DESIGN.md#막지-못하는-것--점수-조작)

## 무료 플랜에서 알아 둘 것

| 항목 | 내용 |
|---|---|
| 비용 | 무료. 신용카드 불필요 |
| DB 용량 | 500MB — 점수 몇 만 건은 문제없습니다 |
| **메일 발송** | **기본 제공 메일은 테스트용, 시간당 몇 통 수준** (4단계 참고) |
| **일시정지** | **일주일가량 아무 요청이 없으면 프로젝트가 멈춥니다** |
| 되살리기 | 대시보드에서 **Restore** 클릭. 데이터는 남아 있습니다 |
| 프로젝트 수 | 무료 조직당 2개 |

일시정지가 실제로 겪게 될 부분입니다. 오랜만에 열었을 때 **랭킹만 안 뜨고 게임은 되는** 상태가 되면
대시보드에서 되살리면 됩니다. 그래서 **"Supabase가 죽어도 게임은 돌아간다"** 를 원칙으로 잡았습니다.

---

## 잘 안 될 때

| 증상 | 원인 | 해결 |
|---|---|---|
| 가입은 됐는데 로그인이 `Email not confirmed` | 확인 메일이 켜져 있음 | 4단계에서 Confirm email 끄기 (또는 메일함 확인) |
| 확인 메일이 안 옴 | 기본 메일 발송 한도 초과 | 스팸함 확인 → 그래도 없으면 확인 메일을 끄는 쪽으로 |
| 가입이 `User already registered` | 같은 이메일이 이미 있음 | 다른 이메일을 쓰거나 로그인으로 |
| 비밀번호가 `Password should be at least N characters` | 4단계 최소 길이 | 규칙에 맞게 입력 |
| 로그인이 `Invalid login credentials` | 이메일·비밀번호 불일치 | 오타 확인. **어느 쪽이 틀렸는지 알려주지 않는 것이 정상**입니다 |
| 비밀번호 재설정 링크가 엉뚱한 데로 감 | 5단계 Redirect URLs 미등록 | 경로(`/tetris2/`)까지 정확히 등록 |
| 랭킹이 비어 있음 | RLS의 select 정책 누락 | 6단계 SQL을 다시 확인 |
| 점수 등록이 401 | 토큰 없음·만료 | 로그인 상태인지, 갱신이 도는지 |
| 점수 등록이 403 | RLS 위반 | `user_id` 가 로그인한 본인인지 |
| 갑자기 전부 실패 | 프로젝트 일시정지 | 대시보드에서 Restore |
| 닉네임이 `playerXXXX` 로 나옴 | 가입 시 닉네임이 안 넘어감 | `data: { username }` 이 실렸는지 |

---

## 요약

```
[사용자]  1. supabase.com 가입 (대시보드 로그인용 — 플레이어 로그인과 별개)
          2. 프로젝트 생성 (이름 tetris2, 리전 Seoul, DB 비번 보관)
          3. Settings → API 에서 Project URL · anon key 확인
          4. Auth → Providers → Email 확인, Confirm email 끄기(권장)
             비밀번호 최소 길이 8자 권장
          5. Auth → URL Configuration 에 Pages 주소 + localhost 등록
          6. SQL Editor 에 이 문서의 SQL 붙여넣고 Run
              ↓  "끝났다" + Project URL + anon key 알려주기
[Claude]  7. 가입 · 로그인 · 점수 저장 · 랭킹 구현 (fetch 직접 호출, 라이브러리 없음)
          8. 문서 갱신 · 커밋 · tetris2 재배포
              ↓
[사용자]  9. https://seedevk8s.github.io/tetris2/ 에서 확인
```

설계 근거가 궁금하면 [DB_DESIGN.md](DB_DESIGN.md), 구현 순서는 [PLAN.md](PLAN.md)를 보세요.

**저에게 알려줄 것** — Project URL, anon key, 그리고 "6단계까지 끝났다".
**절대 알려주지 말 것** — Database Password, service_role key, 그리고 **플레이어 계정 비밀번호**.
