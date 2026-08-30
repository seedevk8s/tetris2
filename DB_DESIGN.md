# DB 설계

테트리스에 붙일 Supabase(PostgreSQL) 스키마 설계입니다.
가입·프로젝트 생성 등 준비 절차는 [SUPABASE.md](SUPABASE.md), 구현 계획은 [PLAN.md](PLAN.md)에 있습니다.

- **저장하는 것** — 누가, 언제, 몇 점을 냈는가
- **보여주는 것** — 전체 랭킹 TOP 10 · 내 최고 기록 · 내 최근 플레이
- **원칙** — 로그인하지 않아도 게임은 되고, 랭킹은 로그인 없이도 볼 수 있다

---

## 한눈에

```
auth.users  (Supabase 가 관리 — 우리가 만들지 않음)
     │  id (uuid)
     │
     ├──1:1──→  profiles            랭킹에 보여줄 닉네임
     │            id  (= auth.users.id)
     │            username
     │            avatar_url
     │
     └──1:N──→  scores              게임 한 판의 결과
                  id
                  user_id  ─────────┘
                  score · lines · level
                  created_at

                  leaderboard  (뷰)  scores ⋈ profiles — 점수와 닉네임을 함께
```

---

## 왜 테이블이 둘인가

점수 행에 닉네임을 함께 저장하면 테이블 하나로 끝납니다. 그런데 두 가지가 깨집니다.

| 문제 | 내용 |
|---|---|
| **사칭** | 닉네임이 클라이언트가 보내는 값이 되어 남의 이름으로 점수를 올릴 수 있습니다. RLS는 `user_id`가 본인인지는 검사해도 닉네임까지 검증하지 못합니다. |
| **이름 변경** | GitHub 아이디를 바꾸면 과거 기록만 옛 이름으로 남아 같은 사람이 둘로 보입니다. |

그래서 **이름은 `profiles`에 한 번만** 두고, 점수 행은 `user_id`로 가리키기만 합니다.
`profiles`는 사용자가 직접 쓰지 않고 **로그인할 때 트리거가 GitHub 정보로 채웁니다.**
쓸 수 없으니 사칭할 수도 없습니다.

---

## 테이블

### `profiles` — 표시용 신원

`auth.users`는 Supabase가 관리하는 테이블이라 우리가 컬럼을 더할 수 없습니다.
화면에 보여줄 정보만 따로 뽑아 둔 곳입니다.

| 컬럼 | 타입 | 제약 | 왜 |
|---|---|---|---|
| `id` | `uuid` | PK, `→ auth.users(id)`, `on delete cascade` | 별도 키를 만들지 않고 인증 계정 id를 그대로 씁니다. 1:1이 구조로 보장됩니다 |
| `username` | `text` | `not null` | GitHub 로그인명. 랭킹에 표시 |
| `avatar_url` | `text` | | GitHub 프로필 이미지. 없을 수 있어 nullable |
| `created_at` | `timestamptz` | `not null default now()` | 가입 시각 |

`on delete cascade` — 계정을 지우면 프로필도 함께 사라집니다.
`timestamptz`를 쓰는 이유는 `timestamp`가 시간대를 잃어버려 접속 지역이 다르면 시각이 어긋나기 때문입니다.

### `scores` — 게임 한 판의 결과

| 컬럼 | 타입 | 제약 | 왜 |
|---|---|---|---|
| `id` | `bigint` | `generated always as identity`, PK | 판이 계속 쌓이므로 `int`가 아니라 `bigint` |
| `user_id` | `uuid` | `not null`, `→ auth.users(id)`, `on delete cascade` | 누구의 기록인가. **RLS가 이 컬럼으로 판단합니다** |
| `score` | `integer` | `not null`, `check (score >= 0)` | 점수 |
| `lines` | `integer` | `not null`, `check (lines >= 0)` | 지운 줄 |
| `level` | `integer` | `not null`, `check (level >= 1)` | 도달 레벨. 게임은 레벨 1에서 시작하므로 0 이하가 올 수 없습니다 |
| `created_at` | `timestamptz` | `not null default now()` | 플레이 시각. 동점 정렬 기준 |

`profiles(id)`가 아니라 **`auth.users(id)`를 참조**합니다.
RLS 조건이 `auth.uid() = user_id`인데, `auth.uid()`가 돌려주는 값이 `auth.users.id`이기 때문입니다.
프로필이 아직 안 만들어진 찰나에도 점수 등록이 막히지 않습니다.

`check` 제약은 클라이언트 코드를 신뢰하지 않기 위한 것입니다.
브라우저에서 오는 값이라 음수가 올 수 있고, **DB에서 막는 것이 마지막 방어선**입니다.

---

## 인덱스

```sql
create index scores_rank_idx on public.scores (score desc, created_at);
create index scores_user_idx on public.scores (user_id, score desc);
```

| 인덱스 | 어떤 조회를 위한 것 |
|---|---|
| `scores_rank_idx` | 랭킹 — `order by score desc, created_at asc limit 10` |
| `scores_user_idx` | 내 기록 — `where user_id = ? order by score desc` |

정렬 순서까지 인덱스에 맞춘 이유는, 순서가 어긋나면 DB가 인덱스를 읽고도 **다시 정렬**하기 때문입니다.
지금은 데이터가 적어 차이가 없지만 나중에 늘었을 때 구조를 고치지 않아도 됩니다.

**동점 처리** — 점수가 같으면 `created_at`이 빠른 쪽이 위입니다. 먼저 도달한 사람이 앞섭니다.
이 규칙이 없으면 새로고침할 때마다 같은 점수의 순위가 뒤바뀝니다.

---

## 트리거 — 프로필 자동 생성

```sql
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
```

처음 로그인해 `auth.users`에 행이 생기는 순간 프로필을 만듭니다.
**프론트엔드에서 "프로필 있나 확인하고 없으면 만들기"를 하지 않는 이유**는,
그 코드가 사칭 가능한 지점이 되고 네트워크가 끊기면 프로필 없는 계정이 남기 때문입니다.

- `coalesce(..., 'player')` — GitHub 메타데이터에 `user_name`이 없을 때를 대비한 기본값입니다.
  `username`이 `not null`이라 이게 없으면 로그인 자체가 실패합니다.
- `security definer` — 함수 소유자 권한으로 실행합니다. 이게 없으면 RLS에 막혀 삽입이 실패합니다.
- `set search_path = ''` — `security definer` 함수의 정석입니다.
  검색 경로를 비우지 않으면 같은 이름의 함수를 심어 권한을 가로채는 공격이 가능합니다.
  그래서 안에서 `public.profiles`처럼 **스키마를 붙여 씁니다.**

---

## 뷰 — `leaderboard`

```sql
create view public.leaderboard
with (security_invoker = true) as
  select s.id, s.score, s.lines, s.level, s.created_at,
         p.username, p.avatar_url
  from public.scores s
  join public.profiles p on p.id = s.user_id
  order by s.score desc, s.created_at asc;
```

랭킹은 **점수와 닉네임을 함께** 보여줘야 하는데, 프론트엔드에서 두 번 조회해 합치면
요청이 두 번 나가고 조인 로직이 클라이언트로 새어 나옵니다. 뷰로 DB에서 끝냅니다.

`security_invoker = true` 가 중요합니다. 이게 없으면 뷰가 **만든 사람 권한**으로 돌아
RLS를 우회합니다. 지금은 둘 다 공개 조회라 결과가 같지만, 나중에 정책을 조이면 구멍이 됩니다.

---

## RLS — 실제 방어선

anon key는 브라우저에 노출되므로 **누구나 API를 부를 수 있습니다.**
그걸 막는 게 아니라 **부르더라도 할 수 있는 일을 제한**하는 것이 RLS입니다.

```sql
alter table public.profiles enable row level security;
alter table public.scores   enable row level security;

create policy "프로필은 누구나 조회" on public.profiles for select using (true);
create policy "점수는 누구나 조회"   on public.scores   for select using (true);
create policy "내 점수만 등록"       on public.scores   for insert with check (auth.uid() = user_id);
```

| 하려는 일 | 결과 | 근거 |
|---|---|---|
| 랭킹 보기 (로그인 없이) | 허용 | `for select using (true)` |
| 내 점수 등록 | 허용 | `auth.uid() = user_id` |
| 남의 `user_id`로 점수 등록 | **거부** | 위 조건에서 걸림 |
| 점수 수정·삭제 (내 것 포함) | **거부** | update·delete 정책 없음 = 전부 거부 |
| 프로필 수정 | **거부** | 트리거만 씁니다 |

**`enable row level security`를 빠뜨리면 정책을 아무리 써도 무의미합니다.**
RLS를 켜지 않은 테이블은 anon key만 있으면 통째로 읽고 쓸 수 있습니다.

**정책을 만들지 않는 것이 곧 거부**입니다. RLS를 켠 테이블에서 정책이 없는 동작은 전부 막힙니다.
기록을 고치거나 지울 수 없게 한 것은 의도입니다 — 기록은 남는 것이 맞습니다.

### 막지 못하는 것 — 점수 조작

게임이 브라우저에서만 돌기 때문에 **개발자 도구로 가짜 점수를 등록하는 것은 막을 수 없습니다.**
RLS가 보장하는 것은 "자기 계정으로만 쓸 수 있다"까지이고,
"정직하게 얻은 점수인가"는 검증하지 않습니다.

막으려면 게임 진행 자체를 서버에서 검증해야 하는데(Edge Function 등) 이 프로젝트 범위를 넘습니다.
**친구들끼리 보는 랭킹 수준**으로 쓰는 것이 맞습니다.
적어 두는 이유는 나중에 "왜 안 막았나"가 아니라 **"알고 안 막았다"**가 되게 하기 위해서입니다.

---

## 조회 패턴

프론트엔드가 실제로 부를 요청들입니다. 라이브러리 없이 `fetch`로 직접 부릅니다.

### 랭킹 TOP 10 (로그인 불필요)

```
GET /rest/v1/leaderboard?select=score,lines,level,created_at,username,avatar_url&limit=10
headers: apikey
```

뷰에 `order by`가 들어 있어 정렬 파라미터를 따로 붙이지 않아도 됩니다.

### 내 최고 기록

```
GET /rest/v1/scores?select=score,lines,level,created_at&user_id=eq.<uid>&order=score.desc&limit=1
headers: apikey, Authorization: Bearer <token>
```

### 내 최근 플레이 5판

```
GET /rest/v1/scores?select=score,lines,level,created_at&user_id=eq.<uid>&order=created_at.desc&limit=5
```

### 점수 등록

```
POST /rest/v1/scores
headers: apikey, Authorization: Bearer <token>, Content-Type: application/json
body:    { "user_id": "<uid>", "score": 1200, "lines": 8, "level": 2 }
```

`user_id`를 클라이언트가 보내지만 **RLS가 토큰의 주인과 대조**하므로 남의 것을 넣으면 거부됩니다.

---

## 의도적으로 넣지 않은 것

| 뺀 것 | 이유 |
|---|---|
| `best_score` 집계 컬럼 | `scores`에서 `max()`로 구하면 됩니다. 중복 저장은 어긋날 여지만 만듭니다 |
| 소프트 삭제(`deleted_at`) | 기록을 지울 수 없게 설계했으므로 필요 없습니다 |
| 판당 상세(조각 수·플레이 시간) | 지금 화면에 쓸 데가 없습니다. 필요해지면 컬럼을 더하면 됩니다 |
| 닉네임 직접 수정 | 사칭 방지가 우선입니다. GitHub 이름을 그대로 씁니다 |
| 사용자별 통계 테이블 | 판 수가 적어 매번 집계해도 충분합니다 |

---

## 실행

이 문서의 SQL 전문은 [SUPABASE.md 7단계](SUPABASE.md#7단계--테이블과-보안정책-만들기)에 있고,
Supabase 대시보드 → **SQL Editor** 에 붙여넣어 실행합니다.

스키마를 고칠 때는 이 문서를 먼저 고치고, 그 다음 SQL을 실행합니다.
설계 근거가 남지 않으면 다음에 왜 그렇게 했는지 알 수 없게 됩니다.
