# PROJECT_STATUS — 현재 진행 상황

**마지막 갱신**: 2026-11-15
**현재 버전**: 0.6.0
**현재 단계**: 6단계 완료 → 7단계(최종 완성) 대기
**웹 테스트 주소**: https://ojuos4545-ship-it.github.io/game/ (GitHub Pages 켜야 열림 — README 참고)

## 진행 현황

| 단계 | 상태 |
|---|---|
| 1. 환경 및 프로젝트 확인 | ✅ 완료 |
| 2. 기본 게임 화면 | ✅ 완료 |
| 3. 펫 시스템 | ✅ 완료 |
| 4. 조합 시스템 | ✅ 완료 |
| 5. 작업장 시스템 | ✅ 완료 |
| 6. 저장 및 통합 | ✅ 완료 |
| 7. 최종 완성 | ⬜ 대기 |

## 지금 작동하는 것 (검증됨)
- 쿼터뷰 마을 화면: 작업장 부지 3곳(이름표), 길, 나무·바위·꽃 (`docs/screenshots/stage2_main.png`)
- 상단 자원바(목재·광석·열매), 숫자가 바뀌면 자동 갱신
- 하단 펫·조합·도감 버튼 → 빈 창 열기/닫기 (`docs/screenshots/stage2_window.png`)
- 펫 8종 임시 3D 모형 (`docs/screenshots/stage3_pets_all.png`)
- 펫 창: 보유 펫 카드, 입양 버튼 (`docs/screenshots/stage3_pet_window.png`)
- 도감 창: 발견 4/8, 미발견 실루엣 (`docs/screenshots/stage3_dex.png`)
- 알림 메시지 (입양, 새 펫 발견)
- 조합 창: 재료 선택, 결과 미리보기(미발견은 실루엣), 비용 보유/필요 표시 (`docs/screenshots/stage4_preview.png`)
- 조합 4종 모두 작동, 2차 조합 루미 (`docs/screenshots/stage4_rumi.png`, `stage4_dex.png`)
- 작업장 3곳: 펫 배치 → 도끼질·곡괭이질·수확 동작 → 5초마다 생산 "+N" → 창고 → 수집 (`docs/screenshots/stage5_working.png`, `stage5_animations.png`)
- 작업장 창: 자리·쉬는 펫·수집·업그레이드 (`docs/screenshots/stage5_window.png`)
- 웹 버전이 실제 브라우저에서 작동 (`docs/screenshots/stage5_web_collect.png`)
- 이제 실제 플레이로 펫 → 노동 → 자원 → 조합·입양·업그레이드 → 도감 완성까지 가능
- 자동 수집: 생산 즉시 내 자원으로
- 자동 저장·불러오기, 새 게임, 도감 완성 축하 (`docs/screenshots/stage6_menu.png`, `stage6_celebrate.png`)
- 웹 버전 새로고침 후에도 진행 유지 (`docs/screenshots/stage6_web_reloaded.png`)
- 자동 점검 176개 항목 모두 통과

## 아직 없는 것
- 밸런스 (지금은 2~3분이면 도감 완성) → 7단계
- Windows 실행 파일(.exe) → 7단계
- 작업장 부지 클릭 반응 (5단계)

## 확인 안 된 것
- 사용자 PC(Windows)에서의 실행 — 클라우드(리눅스)에서만 확인함

## 알려진 문제
- 없음 (클라우드 환경의 "오디오 장치 없음" 경고는 정상, 게임과 무관)
