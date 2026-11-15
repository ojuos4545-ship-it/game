# Claude Code 작업 지침 (Little Haven)

이 파일은 어느 PC에서든 Claude Code가 자동으로 읽는다.

## 작업 시작 시
1. `git pull`
2. `HANDOFF.md` → `PROJECT_STATUS.md` → `TASKS.md` 순서로 읽고 현재 단계 파악
3. `tools/run_tests.sh` 로 현재 상태가 정상인지 확인

## 작업 원칙
- 사용자는 비개발자. 결과는 한글로, 화면(스크린샷) 중심으로 설명.
- 한 번에 기능 하나 → 실행 검증(`tools/run_tests.sh`, 필요 시 `tools/screenshot.sh`) → 다음.
- `GAME_DESIGN.md`의 미니판 범위를 넘는 기능은 추가하지 말고 TASKS.md "추후 확장"에 기록.
- 수치·펫·조합표는 코드에 쓰지 말고 `data/*.json`에 둔다.
- 게임 규칙(scripts/systems)과 화면(scenes)을 분리한다. 규칙은 자동 점검으로 검증.
- 변하는 게임 상태는 `GameState`에만 저장. 화면은 signal로 갱신.
- 오류 시 보고: 무엇이 / 왜 / 게임 영향 / 해결 방법 / 수정 후 확인 결과.
- 검증 안 된 기능을 "완료"로 표시하지 않는다.
- 파일 이름은 snake_case, GDScript 들여쓰기는 탭.

## 작업 종료 시
1. `PROJECT_STATUS.md`, `HANDOFF.md`, `TASKS.md` 체크박스, `CHANGELOG.md` 갱신
2. 커밋 후 `git push`
