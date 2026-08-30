# GitHub Pages 배포 가이드

이 테트리스를 **별도 저장소** `seedevk8s/tetris2` 로 옮겨 GitHub Pages 로 공개하는 절차입니다.

> **배포 완료 — 2026-08-30.** <https://seedevk8s.github.io/tetris2/> 에서 동작을 확인했습니다.
> 아래 1~4단계는 모두 끝났고, 이후에는 [코드를 고쳤을 때](#배포-후--코드를-고쳤을-때) 절만 보면 됩니다.

- **배포 주소** — `https://seedevk8s.github.io/tetris2/`
- **배포 대상** — `src/exercise/chjin/day02/tetris/` 의 내용 전부
- **빌드 없음** — 정적 HTML·CSS·JS 라 컴파일·번들 단계가 없습니다. 파일을 그대로 올리면 끝입니다.

---

## 역할 분담 — 누가 무엇을 하나

**저장소를 만들고 Pages 를 켜는 일은 사용자만 할 수 있습니다.** 이 환경에는 `gh` CLI 가 설치돼 있지 않고
GitHub API 토큰도 없어서, 저장소 생성이나 설정 변경을 대신 할 방법이 없습니다.
반면 **SSH 키로 `seedevk8s` 인증은 이미 되어 있어** 저장소가 만들어진 뒤의 push 는 제가 할 수 있습니다.

```
$ ssh -T git@github.com
Hi seedevk8s! You've successfully authenticated...
```

| # | 할 일 | 누가 | 어디서 |
|---|---|---|---|
| 1 | `tetris2` 저장소 생성 (**Public**) | **사용자** | GitHub 웹 |
| 2 | 배포용 커밋 준비 · 원격 연결 · push | **Claude** | 이 터미널 |
| 3 | Settings → Pages 에서 배포 소스 지정 | **사용자** | GitHub 웹 |
| 4 | 배포 완료 확인 · 실제 동작 확인 | **사용자** | 브라우저 |
| 5 | 이후 변경사항 재배포 | **Claude** | 이 터미널 |

3번(Pages 활성화)은 **최초 1회만** 하면 되고, 그 뒤로는 push 만으로 자동 반영됩니다.

---

## 사용자가 해야 하는 일

### 1단계 — 빈 저장소 만들기

<https://github.com/new> 에서:

| 항목 | 값 |
|---|---|
| Repository name | `tetris2` |
| Description | (자유) 예: `라이브러리 없이 만든 테트리스` |
| 공개 범위 | **Public** |
| Add a README file | **체크 해제** |
| .gitignore / license | **None** |

**Public 이어야 합니다.** 무료 계정은 private 저장소에 Pages 를 쓸 수 없습니다
(GitHub Pro 이상 필요). 이 단계에서 private 으로 만들면 3단계에서 Pages 메뉴가 막힙니다.

**README 를 포함하지 마세요.** 빈 저장소여야 2단계 push 가 충돌 없이 들어갑니다.
(이미 만들었다면 알려주세요 — push 방식을 바꿔 처리합니다)

만든 뒤 **"저장소 만들었다"고 알려주시면** 2단계를 진행합니다.

### 3단계 — Pages 켜기

2단계 push 가 끝난 뒤, `https://github.com/seedevk8s/tetris2` 에서:

1. 상단 **Settings** 탭
2. 왼쪽 사이드바 **Pages**
3. **Build and deployment** 항목에서
   - Source: **Deploy from a branch**
   - Branch: **`main`** / 폴더는 **`/ (root)`**
4. **Save**

Source 를 "GitHub Actions" 로 두지 마세요. 그건 빌드 단계가 있는 프로젝트용이고,
이 프로젝트는 빌드가 없어서 워크플로 파일만 늘어납니다.

### 4단계 — 확인

Save 후 **1~2분**(길면 10분) 뒤 `https://seedevk8s.github.io/tetris2/` 가 열립니다.
저장소의 **Actions** 탭에서 `pages build and deployment` 가 초록색이 되면 배포된 것입니다.

브라우저에서 확인할 것:

- 보드와 패널이 그려지고 블록이 내려오는가
- 방향키·스페이스로 조작되는가
- **첫 키를 누르면 음악이 나오는가** (자동재생 정책상 키를 눌러야 소리가 납니다)
- `M` 으로 음소거, `P` 로 일시정지, `R` 로 재시작이 되는가

---

## Claude 가 하는 일 (2단계)

저장소가 만들어지면 아래를 실행합니다. **사용자가 직접 하고 싶다면 그대로 복사해 쓰면 됩니다.**

두 가지 방식이 있습니다. 결과물(배포되는 화면)은 완전히 같고, **저장소에 남는 이력만 다릅니다.**

### 방식 A — 히스토리를 살려서 옮기기 (권장)

수업 저장소에서 이 폴더만 떼어내되, **그 폴더를 건드린 커밋 이력을 그대로** 가져갑니다.
`git subtree split` 이 해당 경로의 커밋만 골라 새 루트 기준으로 재구성해 줍니다.
이 폴더를 건드린 커밋은 **3개**이고, 그것만 옮겨집니다.

```bash
cd ~/work/kosa-vibecoding-2026-4th

# 이 폴더만의 히스토리를 가진 커밋을 만들어 냅니다 (수업 저장소는 변경되지 않습니다)
SPLIT=$(git subtree split -P src/exercise/chjin/day02/tetris)

# 그 커밋을 tetris2 의 main 으로 보냅니다
git push git@github.com:seedevk8s/tetris2.git "$SPLIT":refs/heads/main
```

- 폴더가 저장소 **루트**가 되므로 `index.html` 이 최상위에 놓입니다. Pages 가 요구하는 구조입니다.
- 수업 저장소(`kosa-vibecoding-2026-4th`)에는 아무 변경도 생기지 않습니다.

### 방식 B — 파일만 복사해 새로 시작하기

이력 없이 깨끗한 저장소를 원할 때 씁니다. 커밋 하나로 시작합니다.

```bash
cd /tmp && rm -rf tetris2 && mkdir tetris2
cp -r ~/work/kosa-vibecoding-2026-4th/src/exercise/chjin/day02/tetris/. tetris2/
cd tetris2

git init -b main
git add .
git commit -m "테트리스 — 라이브러리 없이 만든 정적 웹 게임"
git remote add origin git@github.com:seedevk8s/tetris2.git
git push -u origin main
```

### 어느 쪽을 고를까

| | 방식 A (subtree) | 방식 B (복사) |
|---|---|---|
| 커밋 이력 | 3개 그대로 | 1개 |
| 만들어진 과정이 보이는가 | **보임** | 안 보임 |
| 이후 재배포 | 명령 2줄 (아래 참고) | 파일 복사 후 커밋 |
| 복잡도 | 조금 높음 | 낮음 |

부트캠프 결과물이라 **어떻게 만들었는지가 드러나는 A 를 권합니다.**
`WORKFLOW.md` 가 과정을 글로 남기고 있으니, 커밋 이력까지 함께 가면 근거가 됩니다.

---

## 배포 후 — 코드를 고쳤을 때

수업 저장소에서 작업하고, 거기에 커밋·push 한 **다음에** 배포 저장소로 밀어 올립니다.
즉 **수업 저장소가 원본이고 `tetris2` 는 배포용 사본**입니다. 반대로 하지 마세요.

**방식 A 로 배포했다면:**

```bash
cd ~/work/kosa-vibecoding-2026-4th
git push origin main                                    # 먼저 원본에 반영

SPLIT=$(git subtree split -P src/exercise/chjin/day02/tetris)
git push git@github.com:seedevk8s/tetris2.git "$SPLIT":refs/heads/main
```

수업 저장소에 merge 커밋이 쌓이면 split 결과가 달라져 push 가 거부될 수 있습니다.
그때는 마지막 인자를 `"$SPLIT":refs/heads/main --force` 로 바꿉니다.
**배포용 사본이라 강제로 덮어써도 잃을 것이 없습니다** — 원본은 수업 저장소에 있습니다.

**방식 B 로 배포했다면:** 바뀐 파일을 복사해 넣고 커밋·push 합니다.

push 하면 Pages 가 **자동으로 다시 배포**합니다. 3단계 설정을 다시 할 필요는 없습니다.

---

## 이 프로젝트가 배포에 유리한 이유

미리 확인한 것들입니다. **고칠 것이 없습니다.**

| 확인 | 결과 |
|---|---|
| 빌드 단계 | 없음 — 파일을 그대로 올리면 됨 |
| 파일 경로 | `style.css` · `script.js` 모두 **상대 경로** → `/tetris2/` 하위에서도 그대로 동작 |
| 외부 의존성 | Google Fonts 하나뿐, 실패해도 시스템 서체로 동작 |
| 오디오 파일 | 없음 — BGM 을 WebAudio 로 합성하므로 올릴 바이너리가 없음 |
| 서버 필요 여부 | 없음 — `fetch` 를 쓰지 않아 백엔드·CORS 설정이 불필요 |
| HTTPS | Pages 는 기본 HTTPS → WebAudio 사용에 제약 없음 |

**주소가 `/tetris2/` 하위로 들어가는 점**이 흔한 함정인데, 이 프로젝트는 처음부터
경로를 상대로 썼기 때문에 `index.html` 을 한 줄도 고치지 않아도 됩니다.
(`/style.css` 처럼 슬래시로 시작하는 절대 경로를 썼다면 전부 404 가 났을 것입니다)

`.nojekyll` 파일은 넣지 않았습니다. Pages 의 Jekyll 처리는 `_` 로 시작하는 파일을 무시하는데
이 프로젝트에는 그런 파일이 없어 영향이 없습니다. (넣어도 무해합니다)

---

## 함께 올라가는 문서들

배포 저장소에는 게임 파일뿐 아니라 문서 전부(`PLAN.md` · `WORKFLOW.md` · `README.md` ·
`CLAUDE.md` · `SUPABASE.md` · `DB_DESIGN.md` · 이 문서)와 `test/` 도 함께 올라갑니다.
**의도한 것입니다** — 저장소를 열었을 때 결과물만이 아니라 어떻게 만들었는지가 함께 보이는 편이 낫습니다.

빼고 싶다면 방식 B 로 배포하면서 복사 단계에서 제외하면 됩니다.
다만 아래 파일들은 **반드시 루트에** 있어야 합니다.

```
index.html  style.css  script.js
supabase-config.js  auth.js  api.js  account-ui.js
```

`supabase-config.js` 에 들어 있는 anon key 는 **공개해도 되는 키**입니다
(방어는 DB 의 RLS 가 합니다 — `DB_DESIGN.md` 참고).
`service_role` key 와 DB 비밀번호는 어떤 경우에도 이 저장소에 들어가면 안 됩니다.

---

## 잘 안 될 때

| 증상 | 원인 | 해결 |
|---|---|---|
| 주소가 404 | 아직 빌드 중 | Actions 탭에서 `pages build and deployment` 완료를 기다립니다 (최대 10분) |
| Settings 에 Pages 가 없음 | 저장소가 **private** | Settings → General 맨 아래 → Change visibility → Public |
| 페이지는 뜨는데 스타일이 없음 | 경로 문제 | 이 프로젝트는 상대 경로라 해당 없음. 파일이 **루트**에 있는지 확인 |
| 화면은 나오는데 소리가 안 남 | 브라우저 자동재생 정책 | **정상입니다.** 키를 한 번 누르면 시작됩니다. `♪ 음악 켜짐` 표시도 확인 |
| 보드가 잠겨 있고 게임이 안 됨 | **로그인이 필요합니다** | 정상 동작입니다. 오른쪽 패널에서 로그인하거나 가입하세요 |
| 로그인이 안 되고 랭킹도 안 뜸 | Supabase 프로젝트 일시정지 | 대시보드에서 Restore (`SUPABASE.md` 참고) |
| 소리가 계속 안 남 | 음소거 상태이거나 미지원 브라우저 | `M` 을 눌러 토글. 지원하지 않는 브라우저면 게임만 동작합니다 |
| 고쳤는데 반영이 안 됨 | 브라우저 캐시 | 강력 새로고침 (`Ctrl+Shift+R`) |
| push 가 거부됨 (`rejected`) | 저장소에 README 등 다른 커밋이 있음 | 위 1단계대로 **빈 저장소**로 만들었는지 확인 |
| 폰트가 달라 보임 | Google Fonts 로드 실패 | 시스템 서체로 대체된 것이라 정상 동작입니다 |

---

## 요약

```
[사용자]  GitHub 웹에서 tetris2 저장소 생성 (Public, README 없이)
              ↓  "만들었다" 라고 알려주기
[Claude]  git subtree split → tetris2 의 main 으로 push
              ↓
[사용자]  Settings → Pages → Deploy from a branch → main / (root) → Save
              ↓  1~2분
          https://seedevk8s.github.io/tetris2/  ← 완료

이후 코드를 고치면 [Claude] 가 다시 push → Pages 가 자동 재배포
```
