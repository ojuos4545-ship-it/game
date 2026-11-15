# 변경 기록

## [0.1.0] - 2026-11-15 — 1단계: 프로젝트 기본 구성
### 변경
- GitHub 저장소(ojuos4545-ship-it/game)의 기존 웹 버전 자료 삭제 후 Godot 프로젝트로 교체
### 추가
- Godot 4.7.2 프로젝트 생성 (Compatibility 렌더러, 1280×720)
- 폴더 구조, 관리 문서 6종 + CLAUDE.md
- 한글 폰트(나눔고딕) 기본 적용
- 관리자 3종 뼈대: DataDB(데이터), GameState(진행 상태), SaveManager(저장)
- 실행 확인용 메인 화면 (쿼터뷰 카메라 + 회전 상자 + 한글 제목)
- 자동 점검 도구(`tools/run_tests.sh`) 7개 항목, 화면 캡처 도구(`tools/screenshot.sh`)
