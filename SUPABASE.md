# Supabase 도입 가이드

이 테트리스에 **로그인과 점수 저장**을 붙이는 절차입니다.
Supabase 가입부터 시작해, 배포본(<https://seedevk8s.github.io/tetris2/>)에서 동작하기까지의 순서를 정리했습니다.

> **이 문서는 준비 단계까지입니다.** 코드 구현은 아직 하지 않았습니다.
> 아래 사용자 작업(1~7단계)이 끝나고 요청하시면 그때 구현합니다.

**함께 보는 문서**

| 문서 | 내용 |
|---|---|
| [DB_DESIGN.md](DB_DESIGN.md) | 테이블·인덱스·트리거·RLS 설계와 그렇게 정한 이유, 조회 패턴 |
| [PLAN.md](PLAN.md) | 무엇을 어떤 순서로 구현할지 |
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
| 로그인 | **GitHub 계정으로** 로그인 (버튼 하나) |
| 점수 저장 | 게임이 끝나면 점수·지운 줄·레벨을 기록 |
| 전체 랭킹 | 상위 10명을 닉네임과 함께 표시 |
| 내 기록 | 내 최고 점수와 최근 플레이 |

**로그인하지 않아도 게임은 그대로 됩니다.** 로그인은 기록을 남기고 싶을 때만 하는 선택이고,
Supabase가 죽어도 게임 자체는 멀쩡히 돌아가야 합니다. 이 원칙을 구현 내내 지킵니다.

---

## 역할 분담 — 누가 무엇을 하나

**Supabase 가입·프로젝트 생성·GitHub OAuth 앱 등록은 사용자만 할 수 있습니다.**
계정 소유자만 할 수 있는 일이고, 이 환경에는 그 권한이 없습니다.
반면 **SQL 작성·프론트엔드 코드·문서·배포는 제가 합니다.**

| # | 할 일 | 누가 | 어디서 |
|---|---|---|---|
| 1 | Supabase 가입 | **사용자** | supabase.com |
| 2 | 프로젝트 생성 | **사용자** | Supabase 대시보드 |
| 3 | Project URL · anon key 확인해 알려주기 | **사용자** | Supabase 대시보드 |
| 4 | GitHub OAuth 앱 등록 | **사용자** | GitHub 설정 |
| 5 | Supabase에 GitHub 연동 정보 입력 | **사용자** | Supabase 대시보드 |
| 6 | 로그인 후 돌아올 주소 등록 | **사용자** | Supabase 대시보드 |
| 7 | 테이블·보안정책 SQL 실행 | **사용자** | Supabase SQL Editor |
| — | 그 SQL 작성해 주기 | **Claude** | 이 터미널 |
| 8 | 프론트엔드 구현 (로그인·저장·랭킹) | **Claude** | 이 터미널 |
| 9 | 문서 갱신 · 커밋 · 배포 | **Claude** | 이 터미널 |
| 10 | 배포본에서 동작 확인 | **사용자** | 브라우저 |

7단계는 **제가 SQL을 써 드리면 사용자가 붙여넣고 실행**하는 형태입니다.
대시보드에 접근할 방법이 없어 실행만 넘깁니다.

---

# 사용자가 해야 하는 일 (1~7단계)

## 1단계 — Supabase 가입

<https://supabase.com> → 우측 상단 **Start your project**

가입 방법을 고르는 화면에서 **Continue with GitHub** 를 권합니다.

- 어차피 4단계에서 GitHub OAuth 앱을 등록해야 하고,
- 로그인 방식도 GitHub이라 계정이 한 곳으로 모입니다.
- 비밀번호를 새로 만들 필요도 없습니다.

GitHub 권한 승인 화면이 뜨면 **Authorize** 합니다.
(이건 Supabase에 로그인하기 위한 승인이고, 4단계의 OAuth 앱 등록과는 별개입니다)

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
| ~~service_role key~~ | `eyJhbGci...` (secret 라고 표시됨) | **절대 알려주지 마세요** |

**anon key 는 공개해도 되는 키입니다.** 브라우저 코드에 그대로 들어가고,
GitHub Pages는 정적 호스팅이라 소스를 누구나 볼 수 있습니다. 그게 정상입니다.
이 키는 "누구인지"를 증명하지 않고 **"어느 프로젝트인지"만** 가리킵니다.
실제 방어는 7단계의 **RLS(행 수준 보안)** 가 합니다.

**service_role key 는 RLS를 통째로 무시하는 마스터 키입니다.**
브라우저 코드나 저장소에 절대 들어가면 안 됩니다. 화면에서 보더라도 복사하지 마세요.

## 4단계 — GitHub OAuth 앱 등록

"GitHub으로 로그인"이 동작하려면 GitHub 쪽에 앱을 등록해야 합니다.

<https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**

| 항목 | 값 |
|---|---|
| Application name | `tetris2` (사용자에게 보이는 이름입니다) |
| Homepage URL | `https://seedevk8s.github.io/tetris2/` |
| Authorization callback URL | **`https://<프로젝트-ref>.supabase.co/auth/v1/callback`** |

**Callback URL 이 핵심입니다.** `<프로젝트-ref>` 는 3단계의 Project URL에 들어 있는
`https://` 와 `.supabase.co` 사이의 문자열입니다.
GitHub Pages 주소가 아니라 **Supabase 주소**를 넣어야 합니다 —
GitHub이 로그인을 처리한 뒤 먼저 Supabase에게 돌려주고, Supabase가 다시 우리 페이지로 보내는 순서이기 때문입니다.

등록하면 **Client ID** 가 보이고, **Generate a new client secret** 을 눌러 **Client Secret** 을 만듭니다.
**Secret은 이 화면을 벗어나면 다시 볼 수 없습니다.** 바로 다음 단계로 넘어가세요.

## 5단계 — Supabase에 GitHub 연동 정보 넣기

Supabase 대시보드 → **Authentication** → **Sign In / Providers** → 목록에서 **GitHub**

1. **Enable Sign in with GitHub** 켜기
2. **Client ID** — 4단계에서 받은 값
3. **Client Secret** — 4단계에서 받은 값
4. **Save**

이 두 값도 **저에게 알려주실 필요 없습니다.** 대시보드에만 있으면 됩니다.

## 6단계 — 로그인 후 돌아올 주소 등록

로그인이 끝나면 브라우저를 우리 페이지로 되돌려 보내야 하는데,
Supabase는 **미리 등록된 주소로만** 되돌려 줍니다. 아무 데로나 보내면 피싱에 쓰이기 때문입니다.

Supabase 대시보드 → **Authentication** → **URL Configuration**

| 항목 | 값 |
|---|---|
| Site URL | `https://seedevk8s.github.io/tetris2/` |
| Redirect URLs | `https://seedevk8s.github.io/tetris2/**` <br> `http://localhost:8080/**` |

**로컬 주소도 함께 넣어야 합니다.** 개발할 때 `python3 -m http.server 8080` 으로 열어 보는데,
그 주소가 등록돼 있지 않으면 로컬에서는 로그인 테스트를 아예 못 합니다.

경로(`/tetris2/`)까지 정확히 넣어야 합니다. GitHub Pages는 저장소 이름이 경로에 들어갑니다.

## 7단계 — 테이블과 보안정책 만들기

무엇을 왜 이렇게 만드는지는 **[DB_DESIGN.md](DB_DESIGN.md)** 에 정리해 두었습니다.
여기서는 실행만 합니다.

Supabase 대시보드 → **SQL Editor** → **New query** → 아래를 **통째로 붙여넣고 Run**

```sql
-- ─────────────────────────────────────────────
-- 1. 프로필 — 랭킹에 보여줄 닉네임
-- ─────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text not null,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

-- GitHub 로그인 시 닉네임·아바타를 자동으로 채웁니다.
-- 사용자가 직접 넣게 두면 남의 이름을 사칭할 수 있습니다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', 'player'),
    new.raw_user_meta_data->>'avatar_url'
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
-- ─────────────────────────────────────────────
create view public.leaderboard
with (security_invoker = true) as
  select s.id, s.score, s.lines, s.level, s.created_at,
         p.username, p.avatar_url
  from public.scores s
  join public.profiles p on p.id = s.user_id
  order by s.score desc, s.created_at asc;
```

`Success. No rows returned` 가 나오면 된 것입니다.

**여기까지 끝나면 알려주세요.** 3단계의 Project URL과 anon key와 함께 주시면 구현을 시작합니다.

---

# Claude 가 하는 일 (8~9단계)

준비가 끝나면 아래를 구현합니다. **지금은 하지 않습니다.**

| 파일 | 역할 |
|---|---|
| `supabase-config.js` | Project URL · anon key **한 곳에만**. 환경이 바뀌면 이 파일만 교체 |
| `auth.js` | GitHub 로그인 · 로그아웃 · 세션 복원 |
| `api.js` | 점수 등록 · 랭킹 조회 · 내 기록 조회 (`fetch` 직접 호출) |
| `index.html` · `style.css` | 로그인 버튼, 랭킹 패널, 내 기록 표시 |
| `script.js` | 게임오버 시 점수 전송 (**실패해도 게임은 계속**) |
| `test/` | 랭킹 정렬·응답 파싱 등 순수 로직 검증 |
| 문서 4종 | `PLAN.md` · `README.md` · `WORKFLOW.md` · `CLAUDE.md` 갱신 |

---

# 설계 — 미리 정해 둔 것

## 라이브러리를 쓰지 않습니다

`CLAUDE.md` 의 **"라이브러리를 쓰지 않습니다"** 규약과 충돌하는 지점입니다.
보통은 `@supabase/supabase-js` 를 CDN으로 불러오지만, 그러면 이 프로젝트의 원칙이 깨집니다.

**Supabase는 그냥 HTTP API 입니다.** `fetch` 로 직접 부르면 라이브러리가 필요 없습니다.

```js
// 랭킹 상위 10개
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/leaderboard?select=*&limit=10`,
  { headers: { apikey: ANON_KEY } }
);

// 내 점수 등록
await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
  method: 'POST',
  headers: {
    apikey: ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ user_id, score, lines, level }),
});
```

**대신 라이브러리가 대신 해 주던 일을 직접 써야 합니다** — 로그인 후 주소에 붙어 오는 토큰 파싱,
토큰 만료 시 갱신, 새로고침해도 로그인이 유지되게 하는 세션 저장. 이건 구현할 때 다루겠습니다.

트레이드오프는 분명합니다. **코드는 늘고, 무슨 일이 일어나는지는 드러납니다.**

## 로그인은 이렇게 흘러갑니다

```
[게임 화면]  "GitHub 으로 로그인" 클릭
     │
     ├─→ supabase.co/auth/v1/authorize?provider=github&redirect_to=...
     │        │
     │        └─→ github.com  "이 앱을 승인하시겠습니까?"
     │                │
     │                └─→ supabase.co/auth/v1/callback   ← 4단계에서 등록한 주소
     │                        │
     └────────────────────────┴─→ seedevk8s.github.io/tetris2/#access_token=...
                                        │
                            주소의 # 뒤에 붙어 온 토큰을 읽어 저장하고,
                            주소창을 깨끗하게 지운 뒤 게임으로 복귀
```

토큰이 **`#` 뒤(해시 프래그먼트)에 붙어 오는 것**이 중요합니다.
`?` 뒤 쿼리스트링과 달리 해시는 **서버로 전송되지 않아** 로그 등에 남지 않습니다.
GitHub Pages처럼 서버 코드를 둘 수 없는 정적 호스팅에서 OAuth를 쓸 수 있는 이유가 이것입니다.

## 데이터 구조와 보안

설계 전문은 **[DB_DESIGN.md](DB_DESIGN.md)** 에 있습니다. 여기서는 결론만 옮깁니다.

- **테이블은 둘입니다** — `scores`(기록)와 `profiles`(닉네임).
  닉네임을 점수 행에 함께 저장하면 사칭이 가능해지고, 이름을 바꿨을 때 과거 기록이 따로 놉니다.
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
| **일시정지** | **일주일가량 아무 요청이 없으면 프로젝트가 멈춥니다** |
| 되살리기 | 대시보드에서 **Restore** 클릭. 데이터는 남아 있습니다 |
| 프로젝트 수 | 무료 조직당 2개 |

일시정지가 실제로 겪게 될 부분입니다. 오랜만에 열었을 때 **랭킹만 안 뜨고 게임은 되는** 상태가 되면
대시보드에서 되살리면 됩니다. 그래서 **"Supabase가 죽어도 게임은 돌아간다"** 를 원칙으로 잡았습니다.

---

## 잘 안 될 때

| 증상 | 원인 | 해결 |
|---|---|---|
| 로그인 버튼을 눌러도 GitHub으로 안 감 | 5단계 GitHub provider 미활성 | Authentication → Providers → GitHub 켜기 |
| GitHub이 `redirect_uri_mismatch` | 4단계 Callback URL 오타 | `https://<ref>.supabase.co/auth/v1/callback` 인지 확인 (Pages 주소 아님) |
| 로그인 후 엉뚱한 데로 감 | 6단계 Redirect URLs 미등록 | 경로(`/tetris2/`)까지 정확히 등록 |
| 로컬에서만 로그인이 안 됨 | `localhost:8080` 미등록 | Redirect URLs에 추가 |
| 랭킹이 비어 있음 | RLS의 select 정책 누락 | 7단계 SQL을 다시 확인 |
| 점수 등록이 401 | 토큰 없이 보냄 | 로그인 상태인지, `Authorization` 헤더가 붙는지 |
| 점수 등록이 403 | RLS 위반 | `user_id` 가 로그인한 본인인지 |
| 갑자기 전부 실패 | 프로젝트 일시정지 | 대시보드에서 Restore |
| 닉네임이 `player` 로 나옴 | GitHub 메타데이터를 못 읽음 | 트리거의 `user_name` 키 확인 |

---

## 요약

```
[사용자]  1. supabase.com 가입 (Continue with GitHub)
          2. 프로젝트 생성 (이름 tetris2, 리전 Seoul, DB 비번 보관)
          3. Settings → API 에서 Project URL · anon key 확인
          4. github.com/settings/developers 에서 OAuth 앱 등록
             callback = https://<ref>.supabase.co/auth/v1/callback
          5. Supabase → Auth → Providers → GitHub 에 ID/Secret 입력
          6. Auth → URL Configuration 에 Pages 주소 + localhost 등록
          7. SQL Editor 에 이 문서의 SQL 붙여넣고 Run
              ↓  "끝났다" + Project URL + anon key 알려주기
[Claude]  8. 로그인 · 점수 저장 · 랭킹 구현 (fetch 직접 호출, 라이브러리 없음)
          9. 문서 갱신 · 커밋 · tetris2 재배포
              ↓
[사용자] 10. https://seedevk8s.github.io/tetris2/ 에서 확인
```

설계 근거가 궁금하면 [DB_DESIGN.md](DB_DESIGN.md), 구현 순서는 [PLAN.md](PLAN.md)를 보세요.

**저에게 알려줄 것** — Project URL, anon key, 그리고 "7단계까지 끝났다".
**절대 알려주지 말 것** — Database Password, service_role key, GitHub Client Secret.
