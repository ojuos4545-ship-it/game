# Little Haven — 작업 인계 문서 (다른 AI·다른 컴퓨터로 이어 가기)

이 문서 하나만 읽어도 지금까지의 작업을 이어 갈 수 있도록 정리했다. 최종 갱신: 2026-11-14.
지금까지의 개발은 클라우드의 Claude Code로 진행했다. 앞으로 **사용자 PC의 Claude Code(Windows PowerShell)**나 GPT(ChatGPT, Codex 등)에서 이어 가는 것을 전제로 쓴다. PC에서 시작하는 순서는 14장에 있다.

**읽는 순서**: 이 문서 → `CLAUDE.md`(Claude Code용 작업 규칙, 자동으로 읽힘) 또는 `AGENTS.md`(GPT·Codex용, 내용 같음) → 필요할 때 `IMPLEMENTATION_STATUS.md`(기능별 구현 현황), `FINAL_DESIGN_REPORT.md`(원래 기획), `DEVELOPMENT_GUIDE.md`(단계별 개발 안내), `TEST_RESULTS.md`(검사 기록).

---

## 1. 한눈에 보기

| 항목 | 상태 |
|---|---|
| 게임 | PC 브라우저용 펫 수집·교배·육성 시뮬레이션. `index.html`을 열면 바로 실행된다(서버·설치 불필요) |
| 개발 단계 | 개발 길라잡이 10단계 중 **9단계 완료, 10단계 중 그림 교체 완료**. 그 뒤 사용자 요청으로 그림체 통일(슬달이 방식), 펫·시설 크기 조정, **격자 자유 배치·옮기기**까지 했다. 남은 것은 밸런스 조정과 종족 이름 확정 |
| 자동 검사 | `node tests/regression.js` → **총 180개 중 통과 180, 실패 0** (2026-11-14 기준) |
| 최신 코드 위치 | GitHub `ojuos4545-ship-it/game` 저장소의 **`claude/fervent-sagan-ghojpc` 브랜치**. 이번 작업 전체가 아직 `main`에 합쳐지지 않았다(차이는 `git log --oneline origin/main..origin/claude/fervent-sagan-ghojpc`로 확인) |
| 버전 표기 | 화면 하단 `EARLY PLAYABLE BUILD · v0.3` |
| 저장 데이터 | 브라우저 `localStorage`의 `little-haven-save-v1` 키, 구조 버전 1. v0.1 저장부터 그대로 이어서 불러온다 |

### 남은 일 (우선순위 순)

1. **`main`에 합치기**: 사용자 허락이 필요하다. 최신 작업은 위 브랜치에만 있다.
2. **새 초원 배경 적용 여부**: 시험판을 보여 줬고 답을 기다리는 중이다. 코드는 `proposals/meadow-background.patch`에 보관했고, 적용 방법과 고쳐야 할 검사 2개는 `proposals/README.md`에 있다. 사용자가 "적용해줘"라고 하기 전에는 적용하지 않는다.
3. **밸런스 조정**: 사용자가 며칠 직접 플레이한 느낌이 필요하다. 받으면 `game.js` 상단 `CONFIG` 값만 바꾸는 조정안을 **표로 먼저 보여 주고** 승인 후 바꾼다.
4. **종족 이름 확정**: 15종 이름이 모두 임시다. 바꾸는 방법은 7장에 있다.
5. (선택) 기획서에는 있지만 아직 안 한 것: 11장 "하지 않은 것" 참고. 사용자가 요청할 때만 한다.

---

## 2. 사용자와 소통하는 방법

사용자는 **코딩 초보자**다. 이 부분이 작업 품질만큼 중요하다.

- **모든 답과 결과는 한국어**로 한다. 쉬운 말로 쓰고, 전문용어는 따로 풀어 설명한다(예: "브랜치: 원본을 건드리지 않고 따로 작업하는 사본 줄기").
- **결론부터** 말한다. 기본 답은 "결론 + 핵심 3줄 이내". 배경 설명, 서론, 마무리 인사, 요약 반복은 생략한다. 사용자가 "자세히"라고 하면 그때 길게 설명한다.
- **실행 요청**("만들어줘", "작성해줘", "진행해줘", "해줘")은 바로 실행한다.
- **생각·판단 요청**("어떻게 할까", "어떤 방향이 좋을까", "고민이야")은 **소크라테스 모드**로 답한다.
  - 바로 답하지 말고 핵심을 짚는 질문을 **한 번에 하나씩** 던진다.
  - 사용자의 답을 바탕으로 다음 질문으로 넓혀 가며, 사용자가 스스로 결론에 닿게 돕는다.
  - 충분히 이야기했다고 판단되면 대화 내용을 요약한다.
  - 사용자가 "정리해줘" 또는 "결론 내줘"라고 하면 소크라테스 모드를 끝내고 정리한다.
- 작업이 끝나면 **무엇을 했는지, 검사 결과(통과/실패 개수), 남은 것**을 짧게 보고한다. 실패나 건너뛴 것은 숨기지 말고 그대로 말한다.
- 화면이 바뀌는 작업이면 가능할 때 **화면을 찍어** 보여 준다. 사용자는 실제 화면으로 판단한다.

---

## 3. 작업 규칙 (꼭 지킬 것)

`CLAUDE.md`와 `AGENTS.md`에 같은 내용이 있다. 요약:

- 코드를 바꾸기 전에 현재 파일과 동작을 먼저 확인한다.
- **기능은 한 번에 하나만** 추가한다. 구현 전에 무엇을 어떻게 바꿀지 짧게 알리고 진행한다.
- 이미 동작하는 부분은 최소한으로 고친다. 파일 이름과 전체 구조를 임의로 바꾸지 않는다.
- **밸런스 숫자와 게임 데이터는 `game.js` 상단(`CONFIG` ~ `BREEDING_RULES`)에만** 둔다.
- 특성·버튼·안내 문구는 **실제 동작과 반드시 일치**시킨다.
- **그리기 코드(Canvas)와 게임 규칙 코드를 섞지 않는다.**
- 저장 데이터: 저장 키와 기존 항목의 이름·의미를 바꾸지 않는다. 새 값은 `normalizeGame()`에서 기본값을 채운다. 구조를 바꿔야 하면 `CONFIG.saveVersion`을 올리고 `migrateSave()`에 변환 규칙을 추가한다.
- 시간 진행은 `applyOfflineProgress()` **한 곳만** 거친다.
- 코드를 고친 뒤 `node tests/regression.js`로 **"실패 0"**을 확인한다. 새 기능에는 검사 항목을 추가한다. **검사를 지우거나 느슨하게 고쳐서 통과시키지 않는다.**
- 기능을 바꾸면 `IMPLEMENTATION_STATUS.md`, `README.md`, `TEST_RESULTS.md`를 함께 갱신한다. 검사 개수가 바뀌면 `DEVELOPMENT_GUIDE.md` 4단계의 "총 N개" 문장도 고친다.
- **사용자가 명시적으로 요청하지 않으면 넣지 않는 것**: 새로운 경제 시스템, 미션, 출석 보상, 전투, 친밀도 점수, 복잡한 유전자, 멀티플레이. 단순해 보인다는 이유로 기능을 늘리지 않는다.
- 기존 상용 게임의 캐릭터·명칭·설정·그림을 복제하지 않는다(독립 세계관).
- git: 커밋·푸시는 사용자가 요청할 때 한다. `main`에 직접 올리거나 합치는 것은 사용자 허락을 받는다.

---

## 4. 지금까지 한 일 (시간 순)

### 4-1. 개발 길라잡이 단계별

| 단계 | 내용 | 상태 |
|---|---|---|
| 1~5 | 준비(실행, 설치, git, 자동 검사), 개발 한 바퀴 순서 | 완료 |
| 6 | 시설 업그레이드(최대 Lv.3) | 완료 |
| 7 | 숲 지역 개방, 숲 종족 6종, 조합 전용 종족 | 완료 |
| 8 | 교감(쓰다듬기·놀아주기), 시설 누르기, 펫 이름 바꾸기, 희귀 외형 종족별 기록 | 완료 |
| 9 | 복합 속성(속성 2개) 종족 3종 | 완료 |
| 10-① | 그래픽 교체 | **완료** |
| 10-② | 밸런스 조정 | 시작 전(사용자 플레이 필요) |
| 10-③ | 종족 이름 확정 | 시작 전(사용자 결정 필요) |

### 4-2. 커밋 기록 (오래된 것부터)

`main`에 있는 것:

| 커밋 | 내용 |
|---|---|
| `9b40dc0` | v0.2 시작점 (v0.1에서 찾은 문제 11건 수정본) |
| `32211bf` | 시설 업그레이드 추가 (최대 Lv.3) |
| `cd4f662` | 지역 개방 추가 (숲) |
| `39e0b0f` | 숲 종족 6종과 조합 전용 종족 추가 |
| `a7e7ae2` | 초원 종족 이름 변경 (임시 이름) |
| `948ee73` | 교감과 관찰 추가: 쓰다듬기, 놀아주기, 시설 누르기, 이름 바꾸기 |
| `76500ae` | 복합 속성 추가: 속성 2개 종족 3종 |
| `1018f6a` | 그림 교체 준비, 마을 4단계 기준 조정, 문서 갱신 |

`claude/fervent-sagan-ghojpc` 브랜치에만 있는 것(아직 `main`에 없음):

| 커밋 | 내용 |
|---|---|
| `e61bec5` | 그림 교체 전 마무리: 버튼만 눌러 처음부터 진행하는 플레이 확인, 안내 문구 조사(이/가 등) 자동 선택, 이름 바꾼 펫의 종족 표시, 교배 부모 목록에 속성 표시 |
| `8dd4289` | 펫 15종 픽셀아트 그림 적용, 그림 자르기 도구 추가 |
| `ed5512c` | 그림 자르기 도구의 안내 출력 수정 |
| `10d8848` | 오른쪽 메뉴와 도감에 펫 그림 표시, 화면 크기 검사의 우연 실패 수정 |
| `83badb0` | 시설 6종 픽셀아트 그림 적용 |
| `825b16e` | 그림 교체 마무리: 픽셀 배경, 장식·알·자원 그림, 펫 동작, 희귀 외형 무늬 |
| `3d1494b` | 그림 제작 기록의 크레딧 사용량 수정 |
| (이 문서) | 인계 문서 `HANDOFF.md`, `AGENTS.md`, 한 파일 묶음 도구 추가 |

### 4-3. 이번 작업 기간에 한 일 자세히

1. **자동 검사 환경 확인**: Playwright(브라우저 자동 조작 도구)로 검사가 돌아가는 것을 확인했다.
2. **플레이 확인**: 새 게임에서 화면 버튼만 눌러 다음을 끝까지 진행하며 화면을 찍어 확인했다. 오류 0건.
   - 교감, 시설 누르기, 건설과 배치
   - 교배 27회로 숲 조건 달성, 숲 개방
   - 업그레이드, 복합 속성 종족 부화, 새로고침, 휴대폰 폭
3. **찾아 고친 것**
   - 안내 문구 조사가 어색함: "싹총이이(가)"를 "싹총이가"로. 받침을 보는 `withParticle()` 함수를 추가했다.
   - 이름을 바꾼 펫의 종족을 알 수 없음: 종족 이름을 함께 표시한다.
   - 교배 부모 목록에 속성이 없음: 속성을 함께 표시한다.
4. **그림 교체 전부**: AI 이미지 생성으로 펫 15종, 시설 6종, 장식 5종과 알, 자원 아이콘 4종을 만들었다. 풀밭·길은 코드로 그린 픽셀 배경으로 바꿨다. 다음도 바꿨다.
   - 겹침 순서, 시설 이름표, 작업 펫 위치
   - 걷기·숨쉬기 동작, 희귀 외형 무늬
   - 메뉴 아이콘
   - 그 뒤 사용자가 품질이 마음에 들지 않는다고 해서 **"슬달이 방식"으로 통일**했다. 진한 외곽선, 쨍한 색, 절반 크기 그림을 2배로 그리고, 짙은 초록 배경으로 바꿨다. 경위는 `IMPLEMENTATION_STATUS.md` 8장에 있다.
5. **검사 자체 수정 1건**: "작은 화면에서 펫 누르기" 검사가 펫 두 마리가 우연히 겹칠 때 실패했다. 원인을 재현해 확인했고, 검사만 고쳤다. 확인하는 내용은 같다.
6. **펫 크기 조정**: 펫 15종을 크기 세 가지로 나열해 비교했고, 사용자가 B(화면 56)를 골랐다.
7. **계획 수정, 격자 자유 배치·옮기기**: 기획서 8장에 있던 기능을 사용자와 정해 구현했다.
   - 시설을 원하는 칸에 짓고, 지은 시설을 무료로 옮긴다.
   - 흙길은 없앴다.
   - 철거는 이번에 넣지 않았다.
8. **새 초원 배경 시험(적용 대기)**: 풀 포기, 들꽃, 명암 얼룩이 있는 배경을 코드로 만들어 시험판을 보여 줬다. 사용자 답을 기다리는 중이다(`proposals/`).

---

## 5. 파일 구조

```
game/
├─ index.html            게임 화면 구조(상단 자원, 마을 캔버스, 오른쪽 탭 메뉴, 도움말 창)
├─ style.css             화면 디자인
├─ game.js               게임 전체(데이터, 규칙, 저장, 화면 그리기) — 약 1,480줄
├─ assets/
│  ├─ pets/              펫 그림 15장 (28×28 투명 PNG, 파일 이름 = 종족 ID, 화면에는 2배)
│  ├─ buildings/         시설 그림 6장 (50×42, 파일 이름 = 시설 ID, 화면에는 2배 = 100×84)
│  ├─ decor/             tree·pine 32, bush 22, flowers·rock 18, egg 12 (화면에는 2배)
│  └─ resources/         wood, stone, plant, ore (24×24)
├─ tests/regression.js   자동 검사 180개 (실제 Chromium으로 게임을 조작)
├─ tools/
│  ├─ slice_sprites.py       여러 그림이 든 한 장을 하나씩 잘라 투명 PNG로 만드는 도구
│  ├─ bold_pixels.py         잘라 낸 그림을 진한 외곽선·쨍한 색으로 다듬는 도구(슬달이 방식)
│  └─ build_single_html.py   게임 전체를 HTML 파일 하나로 묶는 도구
├─ package.json / package-lock.json   검사용 Playwright 버전 기록 (게임 실행에는 불필요)
├─ AGENTS.md             GPT/Codex용 작업 규칙 (CLAUDE.md와 같은 내용)
├─ CLAUDE.md             Claude Code용 작업 규칙
├─ HANDOFF.md            이 문서
├─ README.md             실행 방법, 기능, 테스트용 수치, 파일 구성
├─ IMPLEMENTATION_STATUS.md   기획 대비 구현 현황(기능별 표), 저장 호환, 밸런스 변경 내역, 그림 제작 기록
├─ TEST_RESULTS.md       자동 검사·플레이 확인 기록
├─ DEVELOPMENT_GUIDE.md  사용자용 단계별 개발 길라잡이(요청 문장 예시 포함)
├─ FINAL_DESIGN_REPORT.md      원래 기획서(옛 종족 이름이 남아 있음)
├─ CLAUDE_CODE_PROMPT.md       최초 개발 요청서(옛 종족 이름이 남아 있음)
└─ Little_Haven_Final_Design_Report.docx   기획서 Word판
```

---

## 6. 코드 구조 (`game.js`)

한 파일 안에서 위에서 아래로 다음 구역으로 나뉜다.

| 구역 | 줄(대략) | 내용 |
|---|---|---|
| 데이터 표 | 1~210 | `CONFIG`(밸런스 숫자), `RESOURCES`, `ELEMENTS`, `RARITIES`, `SPECIES`, `LEGACY_SPECIES_NAMES`, `TRAITS`, `BUILDING_TYPES`, `REGIONS`, `BREEDING_RULES`. **게임 데이터와 숫자는 여기에만** |
| 공용 상태 | 211~224 | `game`(저장되는 게임 상태), `ui`(저장 안 하는 화면 선택값), `petEffects`(쓰다듬기·놀아주기 연출) |
| 도우미 | 225~260 | `uid`, `clamp`, `weightedPick`, `pairKey`, `formatTime`, `withParticle`(받침에 맞는 조사), `formatDuration` |
| 생성·저장 | 261~410 | `makePet`, `createInitialGame`, `migrateSave`, `normalizeGame`(손상·옛 저장 보정), `loadGame`, `saveGame` |
| 시간 진행 | 410~560 | `applyOfflineProgress`(**시간 계산의 유일한 입구**), `simulatePetSeconds`(작업·휴식·에너지), `simulateSeconds`, `hatchEgg` |
| 마을·지역 규칙 | 558~627 | `villageScore`, `currentVillageLevel`, 지역 개방(`regionRequirements`, `canUnlockRegion`, `unlockRegion`, `grantPendingRegionGifts`) |
| 화면(HTML 메뉴) | 628~905 | `renderResources`, 탭별 `render…Tab`, `renderAll`(구성이 바뀔 때 전체 다시 그림), `refreshLive`(매초 숫자만 제자리 갱신), `bindPanelEvents`, 그림 아이콘(`spriteImgHtml` 등) |
| 버튼 동작 | 908~1080 | `build`, `upgradeBuilding`, `assignSelectedPet`, `feedSelectedPet`, `strokeSelectedPet`, `playWithSelectedPet`, `renameSelectedPet`, `releaseSelectedPet`, `pickChildSpecies`(교배 결과 결정), `startBreeding` |
| 그림 불러오기 | 1088~1145 | `DECOR_IMAGES`, `sprites`, `loadSprites`, `readySprite`, 희귀 외형 무늬(`petSpriteFor`, `rareLookVariant`) |
| 캔버스 그리기 | 1147~1408 | 픽셀 배경(`buildBackground`), 장식 배치(`decorPlacements`), `drawVillage`(앞쪽 물체를 나중에 그림), `drawBuilding`, `drawBuildingLabel`, `petPose`(걷기·숨쉬기), `drawPet`, `drawEgg`, `movePets`(화면상 이동), `animationLoop` |
| 입력·시작 | 1410~끝 | `handleCanvasClick`(펫 우선, 없으면 시설), `tick`(1초마다), `bindGlobalEvents`(탭·도움말·초기화·탭 전환 시 저장), `startGame` |

### 핵심 동작 원리

- **시간**: `game.lastTickAt`부터 지금까지 흐른 정수 초만큼만 `simulateSeconds()`로 진행하고, 그만큼 `lastTickAt`을 옮긴다. 1초 타이머·탭 복귀·게임 시작이 모두 이 길만 쓴다. 최대 24시간까지만 반영한다.
- **작업**: 펫을 생산 시설에 배치하면 60초마다 생산한다. 생산량은 `적성 1.35 × 근면 1.1 × 똑똑 1.1 × 시설 레벨`이고, 소수점은 `yieldProgress`에 쌓인다. 작업 1회에 에너지 2를 쓴다. 최대 에너지의 25% 이하가 되면 쉬고, 90%까지 회복하면 다시 일한다.
- **교배**: 두 부모의 에너지를 각 20 쓰고, 알을 만들 때 결과를 미리 정한다(부화 전 숨김). 180초 뒤 부화한다. 결과는 `pickChildSpecies()`가 다음 순서로 정한다.
  1. 미발견 종족 발견 추첨(18%, 호기심 부모 1마리당 +6%p)
  2. 종족 조합 전용 표(`BREEDING_RULES.speciesPairs`)
  3. 같은 속성 종족 + 속성 조합 표(`elementPairs`)
  - 개방하지 않은 지역의 종족은 언제나 빠진다.
- **화면 갱신**: 버튼을 누르면 `renderAll()`, 매초는 `refreshLive()`로 숫자만 고친다. 드롭다운 선택이나 입력 중인 이름이 풀리지 않게 하려는 구조이니 유지한다.
- **그림**: 표 항목에 `image` 경로가 있으면 불러오고, 실패하거나 없으면 예전 임시 그림(도형·이모지)으로 그린다. 그림은 `imageSmoothingEnabled=false`로 정수 좌표에 그려 픽셀이 또렷하다.

### 저장되는 `game` 구조 (주요 항목)

```
version, createdAt, lastSavedAt, lastTickAt
resources { wood, stone, plant, ore }
buildings [ { id, type, x, y, level } ]
pets [ { id, speciesId, name, traits[], energy, maxEnergy, workBuildingId, resting,
         productionProgress, restProgress, yieldProgress, oreProgress, appearance,
         x, y, targetX, targetY, direction, moving, bob, idleTimer } ]
eggs [ { id, createdAt, remainingSeconds, waitingForSpace?, result { speciesId, traits[], look, name } } ]
discoveredSpecies[], discoveredLooks[], discoveredLooksBySpecies { 종족ID: [외형...] }
unlockedRegions[], regionGiftsGiven[], villageLevel, totalDiscoveries, message
```

v0.3에서 새로 생긴 값은 `unlockedRegions`, `regionGiftsGiven`, `discoveredLooksBySpecies`다. 모두 `normalizeGame()`이 예전 저장에 기본값을 채운다. 저장 버전은 1 그대로다.

건물 `x, y`는 "차지한 칸 묶음의 한가운데"(0~1 비율)다. 불러올 때 `normalizeGame()`이 격자 칸에 맞추고, 겹치면 가장 가까운 빈 칸으로 옮긴다.

---

## 7. 게임 데이터 현황

### 종족 15종 (이름은 모두 임시)

| ID | 이름(임시) | 속성 | 희귀도 | 지역 | 얻는 방법 |
|---|---|---|---|---|---|
| `sproutbun` | 싹총이 | 풀 | 일반 | 초원 | 시작 펫 |
| `pebblelamb` | 몽양이 | 땅 | 일반 | 초원 | 시작 펫 |
| `dewotter` | 슬달이 | 물 | 일반 | 초원 | 교배 중 새 종족 발견 |
| `breezefox` | 산들우 | 바람 | 희귀 | 초원 | 교배 중 새 종족 발견 |
| `embergecko` | 불또마 | 불 | 희귀 | 초원 | 교배 중 새 종족 발견 |
| `sparkchick` | 번아리 | 전기 | 희귀 | 초원 | 교배 중 새 종족 발견 |
| `mossbear` | 끼고미 | 풀 | 일반 | 숲 | 숲 개방 선물(교배로도 발견) |
| `acornsquirrel` | 도토람 | 땅 | 일반 | 숲 | 교배 중 새 종족 발견 |
| `pineowl` | 솔붱이 | 바람 | 희귀 | 숲 | 교배 중 새 종족 발견 |
| `glowhog` | 반디치 | 전기 | 희귀 | 숲 | 교배 중 새 종족 발견 |
| `mistdeer` | 아슴이 | 물 | 에픽 | 숲 | 종족 조합 전용: 산들우 + 슬달이 (약 20%) |
| `elderturtle` | 나북이 | 땅 | 에픽 | 숲 | 종족 조합 전용: 끼고미 + 몽양이 (약 20%) |
| `lotusfrog` | 연구리 | 물·풀 | 에픽 | 숲 | 속성 조합 전용: 풀 + 물 (약 17%) |
| `flarefly` | 화르비 | 불·전기 | 에픽 | 숲 | 속성 조합 전용: 불 + 전기 (약 17%) |
| `sandhamster` | 모래찌 | 땅·바람 | 에픽 | 숲 | 속성 조합 전용: 땅 + 바람 (약 17%) |

**종족 이름을 바꾸는 방법**

1. `SPECIES`의 `name`을 고친다.
2. 바로 전 이름을 `LEGACY_SPECIES_NAMES`의 그 종족 목록에 **추가**한다. 예전 저장의 펫·알에 담긴 옛 이름이 자동으로 바뀐다.
3. 검사 파일 맨 위의 `SPECIES_NAME_MOSSBEAR`(끼고미 이름)도 바꾼다.
4. 다음 문서의 이름 표기를 고친다: `README.md`, `IMPLEMENTATION_STATUS.md`, `TEST_RESULTS.md`, `DEVELOPMENT_GUIDE.md`, 그리고 이 문서.

현재 `LEGACY_SPECIES_NAMES`: 새싹토끼(싹총이), 몽돌양(몽양이), 이슬수달(슬달이), 산들여우(산들우), 불씨도마뱀(불또마), 번개병아리(번아리).

### 시설 6종

| ID | 이름 | 건설 비용 | 생산 | 적성 속성 |
|---|---|---|---|---|
| `plaza` | 중앙 광장 | 기본 제공 | - | - |
| `nursery` | 교배장 | 기본 제공 | - | - |
| `farm` | 농장 | 목재 8, 돌 3 (기본 제공) | 식물 | 풀, 물 |
| `lumber` | 벌목장 | 목재 6, 돌 5 | 목재 | 땅, 바람 |
| `quarry` | 채굴장 | 목재 10, 돌 8 | 돌(+광석 부산물) | 땅 |
| `smelter` | 제련소 | 목재 14, 돌 10, 광석 4 | 광석 | 불, 전기 |

- 업그레이드: 생산 시설만, 최대 Lv.3. 비용은 건설 비용의 2배(Lv.2), 4배(Lv.3)다. 생산량은 레벨 배수.
- 시설 위치는 **격자 자유 배치**다. 마을은 가로 24 × 세로 15칸(`CONFIG.gridCols/gridRows`)이고, 건물은 3×2칸(`CONFIG.buildingCells`)을 차지한다. 처음 시설 3개의 자리는 `createInitialGame()`에 칸 번호로 적혀 있다.
- 건설·옮기기 순서: "건설하기"·"옮기기" → 배치 모드(`ui.placing`, 저장 안 함) → 마을 그림의 칸 클릭 → `placeBuildingAt()`.
  - 지을 때는 확정하는 순간 자원을 쓰고, 옮기기는 무료다.
  - 놓을 수 있는지는 `canPlaceAt()`이 판단하고, 칸 계산은 `buildingCellsOf()`·`cellCenter()`가 맡는다.
  - 미리보기는 `drawPlacement()`가 그린다.

### 특성 7종 (효과 문구 = 실제 동작)

똑똑함(작업 효율 +10%), 건강함(최대 에너지 +20), 민첩함(이동 속도 +35%), 근면함(생산량 +10%), 튼튼함(작업 에너지 소모 -1), 호기심(교배 시 새 종족 발견 확률 +6%p), 활발함(자유 생활 중 더 자주 돌아다님). 똑똑함과 근면함은 지금 같은 효과다.

### 지역

- 초원: 처음부터 열려 있다.
- 숲: 개방 조건은 마을 3단계 + 발견 종족 5종 + 목재 100·돌 60 소모. 개방하면 끼고미 1마리가 합류한다. 마을 그림에 숲은 나오지 않고 목록과 도감에만 있다.

### 마을 단계

점수는 `시설 수 + 발견 종족 수 × 2`이고, 기준은 `[0, 8, 13, 36]`이다. 4단계 기준 36은 "시설 6개 + 15종 전부"의 점수라서, **종족이나 시설 수를 바꾸면 함께 맞춰야 한다**.

### 현재 밸런스 값 (전부 임시, `CONFIG`)

| 항목 | 값 |
|---|---|
| 생산 주기 / 휴식 회복 주기 | 60초 / 60초 |
| 작업 1회 에너지 소모 / 휴식 1분 회복 | 2 / 2 |
| 작업 중단 / 재개 기준 | 최대 에너지 25% 이하 / 90% 이상 |
| 시작 자원 | 목재 30, 돌 24, 식물 30, 광석 8 |
| 적성 보너스 | 생산량 ×1.35 |
| 채굴장 광석 부산물 | 생산 1회당 0.25 × 레벨 |
| 먹이 주기 | 식물 3 → 에너지 +25 |
| 놀아주기 | 에너지 5 |
| 교배 / 부화 | 부모 각 에너지 20 / 180초 |
| 알 최대 / 펫 최대 / 펫 최소 | 5 / 30 / 2 |
| 새 종족 발견 / 희귀 외형 확률 | 18% / 8%(무늬 3종) |
| 오프라인 반영 상한 | 24시간 |

밸런스를 바꾼 기록은 `IMPLEMENTATION_STATUS.md` 5장에 표로 남긴다.

---

## 8. 자동 검사

### 실행 방법

```bash
npm install
```

```bash
npx playwright install chromium
```

```bash
node tests/regression.js
```

- 마지막 줄이 `총 180개 중 통과 180, 실패 0`이면 통과다. 서버를 띄울 필요 없이 `index.html`을 파일로 직접 연다(`LH_URL` 환경변수로 다른 주소 지정 가능).
- 실제 Chromium 브라우저로 버튼을 누르고, 브라우저 시계만 앞으로 돌려 시간 경과를 흉내 낸다. 배포용 수치는 바꾸지 않는다.
- 끝날 때 화면 크기별 스크린샷을 임시 폴더에 남긴다.

### 검사 구성 (구역 번호 = 파일 안 주석)

1. 새 프로필 시작
2. 펫 이동·선택
3. 작업 배치와 자원 증가
4. 에너지 부족 → 휴식 → 재개
5. 건설
   - 5-2 업그레이드
   - 5-3 지역 개방
6. 교배·부화·도감
   - 6-2 숲 종족
   - 6-3 복합 속성
   - 6-4 마을 단계·그림
   - 6-5 메뉴 그림
   - 6-6 그림 교체 마무리(배경·장식·이름표·동작·희귀 외형·메뉴 아이콘)
7. 놓아주기
   - 7-2 교감·이름 바꾸기·시설 누르기
   - 7-3 조사
8. 버튼 연결
9. 새로고침 유지
10. 오프라인 진행
11. 초기화
12. 옛 저장·손상 저장 호환
13. 화면 크기 6종(1440×900 ~ 360×640)

### 검사를 고칠 때의 원칙

- 기능을 **의도적으로** 바꿔 기대값이 달라진 경우에만 검사를 고친다. 바뀐 이유를 `TEST_RESULTS.md`에 적는다.
- 실패를 통과시키려고 조건을 느슨하게 만들지 않는다. 검사 자체의 결함이면 원인을 재현해 확인한 뒤 고치고 기록한다(예: `TEST_RESULTS.md`의 "검사 자체를 고친 기록").

---

## 9. 그림 (그래픽)

### 현재 그림 목록

| 폴더 | 내용 | 크기 | 연결된 곳 |
|---|---|---|---|
| `assets/pets` | 종족 15종 | 28×28 (화면 56) | `SPECIES[id].image` |
| `assets/buildings` | 시설 6종 | 50×42 (화면 100×84) | `BUILDING_TYPES[id].image` |
| `assets/decor` | tree, pine, bush, flowers, rock, egg | 32, 32, 22, 18, 18, 12 | 그리기 코드의 `DECOR_IMAGES` |
| `assets/resources` | wood, stone, plant, ore | 24×24 | `RESOURCES[id].image` |

- **그림 방식(사용자가 고른 "슬달이 방식")**: 진한 1칸 외곽선, 쨍한 색, 적은 색 수. 마을 화면에는 그림 크기의 **정확히 2배**로 그려 한 점이 화면 2칸이 되도록 통일한다. 새 그림도 이 규칙을 따라야 화면이 어울린다.

- **풀밭·길**은 그림 파일이 아니라 코드(`buildBackground()`)로 그린다. 1/4 크기(240×150)에 고정 씨앗값으로 점을 찍어 4배로 키우므로 항상 같은 모양이다. 짙은 초록에 잔무늬를 적게 해서 펫이 또렷이 보이게 했다.
- **희귀 외형 무늬**(1 줄무늬, 2 물방울, 3 반짝임)도 코드(`petSpriteFor()`)로 펫 그림 위에 입힌다. 마을 화면에만 보이고, 메뉴에서는 ✦ 표시만 한다.
- **그림이 없거나 불러오지 못하면** 예전 임시 그림(도형)으로, 메뉴는 이모지로 표시한다.
- 그림을 바꾸려면 **같은 이름·같은 크기의 투명 PNG로 덮어쓰면** 된다. 펫은 **오른쪽을 보게** 그린다(왼쪽으로 갈 때 자동으로 뒤집는다). 발이 그림 맨 아래에 닿게 둔다.

### 그림을 만든 방법 (다시 만들 때 참고)

- **도구**: Higgsfield(이미지 생성 서비스)의 `seedream_5_0_flash` 모델, 4:3 비율, 1k 해상도. 장당 0.5 크레딧이고, 모두 6장을 써서 남은 크레딧은 2.8이다(무료 요금제).
- **그림체 맞추기**: 한 장에 여러 개를 그리게 했다. 첫 장(초원 펫 6종)을 만든 뒤, 나머지는 모두 그 첫 장을 **참고 그림**으로 넣어 같은 그림체로 만들었다. 인계 압축 파일의 `reference_sheets/sheet_meadow.png`가 그 첫 장이다. GPT 이미지 생성으로 이어 만들 때도 이 그림을 참고로 올리면 그림체를 맞추기 쉽다.
- **배경**: 단색 자홍색(마젠타) 배경으로 생성한 뒤 도구로 배경을 지웠다.
- **자르기 → 다듬기 두 단계**: `tools/slice_sprites.py`로 자르고 `tools/bold_pixels.py`로 다듬는다. Python, Pillow, numpy가 필요하다.

```bash
python3 tools/slice_sprites.py 시트.png 임시폴더 sproutbun,pebblelamb,dewotter,breezefox,embergecko,sparkchick 2 28 28
```

```bash
python3 tools/bold_pixels.py 임시폴더 assets/pets --colors 14
```

```bash
python3 tools/slice_sprites.py 시트.png 임시폴더 plaza,nursery,farm,lumber,quarry,smelter 2 50 42
```

```bash
python3 tools/bold_pixels.py 임시폴더 assets/buildings --colors 24 --saturation 1.25
```

- 자르기 도구의 인자는 `시트 출력폴더 이름목록 행수 [가로 세로]` 순서다. 가로·세로를 생략하면 48×48이다.
- 다듬기 값: 펫 색 14개, 시설 색 24개·채도 1.25, 장식 색 18개·채도 1.35, 자원 색 14개·채도 1.3. 장식은 나무 32, 덤불 22, 꽃·바위 18, 알 12 크기로 자른다.
- 배경과 발밑 그림자를 지운 뒤, 큰 덩어리를 이름 수만큼 골라 위→아래, 왼쪽→오른쪽 순으로 이름을 붙인다.
- 그림 사이에 번호 글자가 같이 그려져도 작은 덩어리라 버려진다.
- 배경보다 밝은 분홍(연꽃 봉오리 등)은 지우지 않는다.

**사용한 생성 문장(영어, 그대로 재사용 가능)**

첫 장 — 초원 펫 6종(이 장이 다른 모든 장의 참고 그림):
```
Pixel art sprite sheet for a cozy top-down 2D pet village game. Six different small cute original creatures arranged in a clean grid of 3 columns and 2 rows, evenly spaced, well separated by wide empty gaps, none touching or overlapping. Each creature: full body, chibi proportions, three-quarter side view facing right, simple readable silhouette, soft dark outline, limited warm pastel palette, 32x32 pixel sprite style with crisp chunky pixels, no anti-aliasing, no ground shadow, no text, no labels, no frames, no grid lines. Perfectly flat solid pure magenta background, nothing else in the background.
Row 1, left to right: (1) pale green rabbit with a tiny leaf sprout growing on its head; (2) round beige lamb with fluffy wool and small pebble-grey hooves; (3) light blue otter with a water droplet mark on its forehead.
Row 2, left to right: (4) soft orange fox with a swirl-shaped breezy tail; (5) coral red gecko lizard with a small glowing ember at its tail tip; (6) yellow baby chick with a tiny lightning-bolt shaped head tuft.
```

참고 그림을 넣고 만든 장들은 앞부분이 공통이다:
```
Create a NEW pixel art sprite sheet in exactly the same art style as the reference image: same chunky pixel size, same soft dark outlines, same shading, same pastel palette feeling, same creature scale, same flat solid magenta background. Do NOT repeat any creature from the reference; ...
```
그 뒤에 붙인 내용:
- 숲 펫 6종(3열 2행)
  1. sage green bear cub with a patch of moss growing on its back
  2. tan brown squirrel with a big fluffy tail wearing an acorn cap on its head
  3. small round grey-brown owl with pine needle ear tufts
  4. pale yellow hedgehog with softly glowing spine tips
  5. pale misty blue fawn deer with tiny antlers
  6. olive green turtle with a tiny tree sapling growing on its shell
- 복합 속성 3종(한 줄)
  1. light green frog wearing a round lotus leaf on its head like a hat, with a small pink lotus bud
  2. orange butterfly creature with a small round body and wings whose tips glow like tiny sparks
  3. sandy beige hamster with big puffy cheeks and a small swirl-shaped tuft of fur on its head
- 시설 6종(3열 2행)
  - 공통: `Do NOT draw any creatures`, `slightly elevated three-quarter front view`, `all parts attached together as one piece`, `no grass patch`, `do not use pink, purple or magenta`
  - 그림: village plaza(round cobblestone plaza with a small stone fountain and two flower pots), hatchery hut(round wooden hut with thatched straw roof and a straw nest holding one cream egg), farm(tilled soil plot with green sprouts inside a low wooden fence), lumber camp(log cabin with stacked logs and an axe in a stump), quarry(grey rocky hill with a mine entrance framed by wooden beams, pickaxe, cut stones), smelter(stone furnace with brick chimney and glowing orange fire opening)
- 장식(3열 2행): round leafy tree, tall pine tree, round bush, white and yellow wildflowers, grey mossy rock, cream egg with light brown speckles
- 자원(한 줄): bundle of three wooden logs, pile of three grey stones, bundle of green leafy herbs tied with string, dark ore rock with pale blue crystals

### 이미지 생성에서 겪은 일 (같은 서비스를 쓸 때)

- 무료 요금제에서는 `gpt_image_2_6`, `nano_banana`가 "basic 요금제 이상 필요"로 거절됐다(크레딧 차감 없음).
- `z_image`(장당 0.15)는 대기열에 한참 있다가 두 번 모두 실패했다(차감 없음).
- `seedream_5_0_flash`(장당 0.5)는 빠르고 결과가 좋았다. 단, 두 장을 동시에 요청하면 한 장이 `429 rate_limit_reached`로 거절될 때가 있어 다시 요청했다.

---

## 10. 알려진 제한

- 같은 게임을 탭 두 개에서 열면 나중에 저장한 쪽이 덮어쓴다.
- 휴대폰에서는 마을 그림이 작아져 이름표 글자가 매우 작다(기획상 대상은 PC).
- 건물 철거는 없다. 건물은 모두 같은 크기(3×2칸)다. 숲은 마을 그림에 나오지 않는다.
- 펫 걷기는 그림 한 장을 튀게 하는 방식이라 다리는 움직이지 않는다.
- 글자 사이 작은 기호(🪵, ⚡, 💧 등)와 연출 기호(💤 💗 🎵)는 이모지다.
- Chrome 외 브라우저, 실제 휴대폰 터치, 실제 24시간 연속 실행은 확인하지 못했다(`TEST_RESULTS.md` "확인하지 못한 것").
- 기획 원본 문서(`FINAL_DESIGN_REPORT.md`, `CLAUDE_CODE_PROMPT.md`)에는 옛 종족 이름이 남아 있다(일부러 원본 유지).

---

## 11. 기획서에 있지만 하지 않은 것 (사용자 요청 시에만)

다음은 기획서(`FINAL_DESIGN_REPORT.md`)에 있지만 길라잡이 순서에 없어 하지 않았다. 사용자가 요청할 때만 하나씩 한다.

- 건물 철거(기획서의 "건물 업그레이드·철거·정교한 자유 배치" 중 남은 것)
- 플레이어 직접 명령("여기로 이동")
- 종족별 특성 경향(지금은 특성이 무작위), 친화력 특성(펫 간 상호작용 필요)
- 제련소의 "가공"(지금은 광석을 그냥 생산)
- 추가 지역(화산, 빙하, 해안, 수정 동굴)
- 3속성 특수 종족

---

## 12. 주의할 점 (이 프로젝트에서 실제로 겪은 함정)

1. **파일로 직접 연 페이지의 캔버스 픽셀은 읽을 수 없다**: `file://`로 열면 그림을 그린 캔버스에서 `getImageData`를 부르면 보안 오류가 난다. 그래서 검사는 `ctx.drawImage`/`fillText` 호출을 기록하는 방식으로 "무엇이 그려졌는지" 확인한다. 배경용 작은 캔버스는 그림 파일 없이 도형만 그리므로 픽셀을 읽어도 괜찮다.
2. **화면 갱신 구조를 바꾸지 말 것**: 매초 패널 전체를 다시 그리면 드롭다운 선택이 풀리는 버그가 있었다(v0.1). 매초 갱신은 `refreshLive()`로 숫자만 바꾼다.
3. **시간 계산을 새로 만들지 말 것**: 탭 복귀 시 시간이 두 번 계산되던 버그가 있었다. `applyOfflineProgress()`만 쓴다.
4. **토스트(잠깐 뜨는 알림)는 글자로만 넣는다**(`textContent`). 그 안에 그림 태그를 넣으면 태그가 글자로 보인다. 메뉴용 그림 함수(`resourceIconHtml` 등)는 HTML 영역에서만 쓴다.
5. **조사**: 안내 문구에 펫·시설 이름을 넣을 때는 `withParticle(이름, '이', '가')`처럼 쓴다. 이름 끝이 한글이 아니면 "이(가)"로 표시된다.
6. **장식 배치는 지어진 시설에 따라 바뀐다**: `decorPlacements()`는 길과 지어진 시설을 피하고, 시설을 지으면 그 자리 장식이 사라진다. 시설 위치를 바꾸면 장식도 자동으로 피한다.
7. **작업 중인 펫은 시설 양옆에 선다**(`movePets`): 이름표를 가리지 않게 한 것이다. 이름표는 `drawBuildingLabel()`이 맨 마지막에 그린다.
8. **검사의 우연 실패**: 펫 위치가 무작위라 펫을 누르는 검사는 다른 펫을 먼저 치워야 한다(13번 구역 참고).
9. **Playwright 버전**: `package.json`은 1.65.0 이상을 적어 두었다. 클라우드 환경에는 1.63.0이 미리 깔려 있었고 그대로 잘 돌았다.

---

## 13. GPT에서 이어 가는 방법

### 방법 A — Codex처럼 저장소를 직접 다루는 GPT

1. GitHub 저장소 `ojuos4545-ship-it/game`을 연결하고 **`claude/fervent-sagan-ghojpc` 브랜치**에서 시작한다(또는 사용자가 먼저 `main`에 합친다).
2. Codex는 저장소 맨 위의 `AGENTS.md`를 자동으로 읽는다. 이 문서(`HANDOFF.md`)도 처음에 읽게 한다.
3. 시작하자마자 `node tests/regression.js`를 돌려 "실패 0"을 확인한 뒤 작업한다.

### 방법 B — 채팅창 ChatGPT

1. 인계용 압축 파일(프로젝트 전체 + 참고 그림 + 첫 메시지 문장)을 대화에 올린다.
2. 압축 파일 안 `START_PROMPT.txt`의 내용을 첫 메시지로 붙여 넣는다.
3. 게임을 바로 보여 줘야 하면 `python3 tools/build_single_html.py`로 만든 `little-haven-single.html` 한 파일을 올린다.
4. 채팅창 GPT는 코드를 직접 실행하지 못할 수 있다. 그 경우 고친 파일을 받아 사용자가 PC에서 `node tests/regression.js`를 돌려 결과를 다시 알려 줘야 한다.

### 첫 작업으로 추천하는 것

- 사용자가 아직 정하지 않았다면: "`main`에 합칠지"를 먼저 묻는다.
- 그다음은 사용자가 고르게 한다.
  - 밸런스 조정(플레이 소감 필요)
  - 종족 이름 확정(이름 목록 필요)
  - 11장의 선택 기능 중 하나

---

## 14. 사용자 PC의 Claude Code(Windows PowerShell)에서 이어 가기

처음 한 번만 준비하면, 그다음부터는 4·5단계만 하면 된다.

1. **프로그램 설치**(이미 있으면 건너뜀)
   - Git for Windows: https://git-scm.com/downloads/win (Claude Code가 명령을 실행할 때 쓴다)
   - Node.js 22 이상: https://nodejs.org (자동 검사 실행에 필요하다)
   - Claude Code: PowerShell에서 `irm https://claude.ai/install.ps1 | iex` 실행 후, 새 PowerShell 창에서 `claude --version`으로 확인한다. Claude Code는 Pro 이상 요금제나 Console 계정으로 로그인해야 쓸 수 있다.
2. **저장소 받기**: 원하는 폴더에서 다음을 실행한다. 비공개 저장소라 처음에 GitHub 로그인 창이 뜰 수 있다.
   - `git clone https://github.com/ojuos4545-ship-it/game.git little-haven`
   - `cd little-haven`
   - `git checkout claude/fervent-sagan-ghojpc` (`main`에 합친 뒤에는 이 줄 대신 `main`을 쓴다)
3. **자동 검사 준비**
   - `npm install`
   - `npx playwright install chromium`
   - `node tests/regression.js` → 마지막 줄이 "실패 0"이면 준비 끝
   - PowerShell이 "이 시스템에서 스크립트를 실행할 수 없으므로…"라며 `npm`·`npx`를 막으면 `npm.cmd install`, `npx.cmd playwright install chromium`처럼 `.cmd`를 붙여 실행한다.
4. **Claude Code 시작**: 저장소 폴더에서 `claude`를 실행한다. 첫 실행 때 브라우저가 열리며 로그인한다. `CLAUDE.md`는 자동으로 읽힌다.
5. **첫 메시지**: 아래 문장을 붙여 넣는다.

```text
HANDOFF.md를 끝까지 읽고 지금 상태를 결론 + 핵심 3줄로 알려줘. 그다음 node tests/regression.js를 실행해서 결과를 알려줘.
```

- 게임 확인은 저장소 폴더의 `index.html`을 Chrome으로 여는 것이 가장 정확하다. 파일 하나로 주고받아야 하면 `python tools/build_single_html.py`를 쓴다(Python 필요).
- PC에서 작업한 내용은 Claude Code에게 "커밋하고 푸시해줘"라고 해야 GitHub에 올라간다. 다른 컴퓨터나 클라우드에서 이어 할 때는 먼저 `git pull`로 최신 내용을 받는다.

