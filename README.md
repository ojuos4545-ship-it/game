# Little Haven (가칭)

펫을 모으고 조합해 새 펫을 발견하고, 펫들이 작업장에서 일하며 자원을 만드는 3D 쿼터뷰 경영 시뮬레이션 (미니판).

## 실행 방법 (처음 한 번)

1. **Godot 4.7.2 (Standard 버전)** 설치 — https://godotengine.org/download
   - ".NET" 버전이 아닌 **일반(Standard)** 버전을 받습니다.
   - 설치가 필요 없는 압축 파일입니다. 풀어서 `Godot_v4.7.2-stable_win64.exe`를 실행하면 됩니다.
2. 이 프로젝트를 GitHub에서 내려받습니다 (아래 "PC 간 작업 이어가기" 참고).
3. Godot 실행 → **가져오기(Import)** → 이 폴더의 `project.godot` 선택 → **가져오기 및 편집**.
4. 에디터 오른쪽 위 **▶ (F5)** 버튼을 누르면 게임이 실행됩니다.

> 처음 열 때 몇 초간 "가져오는 중" 화면이 나오는 것은 정상입니다 (`.godot/` 캐시 폴더를 만드는 중).

## PC 간 작업 이어가기 (회사 PC ↔ 집 PC)

| 시점 | 할 일 |
|---|---|
| 작업 시작 | `git pull` — 다른 PC에서 한 작업을 받아옴 |
| 작업 끝 | Claude Code에게 "작업 마무리해줘" → 문서 갱신 + 커밋 + `git push` |
| 이어받기 | `HANDOFF.md`부터 읽기 (Claude Code도 자동으로 읽음) |

- 게임 **저장 파일**은 각 PC에 따로 생깁니다 (PC 간 게임 진행도는 공유되지 않음, 개발에는 영향 없음).

## 폴더 구조

```
game/  (이 저장소)
├─ project.godot          Godot 프로젝트 설정
├─ data/                  게임 데이터 (펫·조합표·작업장 수치) ← 밸런스 조정은 여기만 수정
├─ scenes/                화면 구성 파일(.tscn)과 그 동작 코드(.gd)
│  ├─ main/               메인 화면
│  ├─ world/              지형, 카메라, 조명
│  ├─ pets/               펫 3D 모습 + 노동 애니메이션
│  ├─ workshops/          작업장 3D 모습
│  └─ ui/                 버튼, 창, 도감 등 화면 UI
├─ scripts/
│  ├─ autoload/           항상 켜져 있는 관리자 (DataDB, GameState, SaveManager)
│  ├─ systems/            게임 규칙 (조합, 생산 등) — 화면과 분리된 순수 로직
│  └─ visual/             임시 3D 도형 도우미
├─ assets/                폰트, UI 테마, 3D 모델, 이미지, 소리
├─ tests/                 자동 점검 (Claude Code가 매 작업 후 실행)
├─ tools/                 점검·화면 캡처 도구
└─ docs/                  스크린샷 등 참고 자료
```

## 개발용 명령 (Claude Code가 사용)

```bash
tools/run_tests.sh
```

```bash
tools/screenshot.sh build/screen.png
```

## 라이선스 / 에셋 출처

- 폰트: 나눔고딕 (SIL Open Font License) — `assets/fonts/NanumGothic-OFL.txt`
