'use strict';

/* Little Haven MVP
 * Prototype constants are intentionally centralized so balancing can be adjusted later.
 * 밸런스 숫자는 모두 이 파일 상단(CONFIG ~ BREEDING_RULES)에서만 고친다.
 */
const CONFIG = {
  saveKey: 'little-haven-save-v1',
  saveVersion: 1, // 저장 데이터 구조가 바뀌면 숫자를 올리고 migrateSave()에 변환 규칙을 추가한다.
  autosaveIntervalMs: 15000,
  offlineCapSeconds: 24 * 60 * 60,
  awayReportSeconds: 60, // 이 시간 이상 자리를 비웠을 때만 요약 알림을 띄운다.

  // 작업·에너지
  productionIntervalSeconds: 60,
  restIntervalSeconds: 60,
  energyDrainPerProduction: 2,
  energyRegenPerMinute: 2,
  pauseEnergyRatio: 0.25,
  resumeEnergyRatio: 0.9,
  baseEnergy: 100,
  minEnergyToAssign: 10,
  maxWorkersPerBuilding: 2,
  affinityMultiplier: 1.35, // 건물과 속성이 맞을 때 생산량 배수
  quarryOrePerProduction: 0.25, // 채굴장 부산물(광석)

  // 시설 업그레이드: 생산 시설만 가능하고, 레벨만큼 생산량이 곱해진다(Lv.2 = 2배, Lv.3 = 3배).
  maxBuildingLevel: 3,
  upgradeCostMultipliers: { 2: 2, 3: 4 }, // 그 레벨로 올리는 비용 = 건설 비용 × 이 값

  // 특성 효과
  healthyEnergyBonus: 20,
  sturdyDrainReduction: 1,
  diligentMultiplier: 1.1,
  smartMultiplier: 1.1,
  nimbleSpeedMultiplier: 1.35,
  curiousDiscoveryBonus: 0.06, // 호기심 부모 1마리당 새 종족 발견 확률 추가
  livelyIdleMultiplier: 0.35, // 활발함: 멈춰 쉬는 시간이 이 비율로 줄어든다.

  // 교감
  feedPlantCost: 3,
  feedEnergyGain: 25,
  playEnergyCost: 5, // 놀아주기 에너지 소모
  strokeEffectSeconds: 1.6, // 쓰다듬기 연출 시간
  playEffectSeconds: 4, // 놀아주기 연출 시간
  playSpeedMultiplier: 2.4, // 놀아주는 동안 이동 속도 배수
  maxPetNameLength: 10,

  // 교배·부화
  breedEnergyCost: 20,
  eggHatchSeconds: 180, // prototype value: 3 minutes, not final balance
  fullNurseryRetrySeconds: 30,
  maxEggs: 5,
  discoveryChance: 0.18,
  inheritTraitChance: 0.65,
  newTraitChance: 0.3,
  rareLookChance: 0.08,
  rareLookVariants: 3,
  sameSpeciesExtraWeight: 2,

  // 시작 자원
  startingResources: { wood: 30, stone: 24, plant: 30, ore: 8 },

  // 펫 보유
  maxPets: 30,
  minPets: 2, // 놓아주기를 해도 이 수 아래로는 내려가지 않는다(교배가 불가능해지는 것을 방지).

  // 마을 발전: 점수 = 건물 수 + 발견 종족 수 × 2. 배열의 n번째 값 이상이면 n+1단계.
  // 4단계 기준(36)은 "모든 시설 6개 + 전체 종족 15종 발견"의 점수다. 종족이나 시설 수를 바꾸면 함께 맞춘다.
  villageLevelThresholds: [0, 8, 13, 36],

  // 화면 연출
  baseMoveSpeed: 0.11,
  idleSecondsMin: 1.5,
  idleSecondsMax: 5,

  // 격자 배치는 아직 구현 전이다(기획상 예정). 현재 코드에서는 사용하지 않는다.
  gridCols: 12,
  gridRows: 8
};

const RESOURCES = {
  wood: { label: '목재', icon: '🪵', image: 'assets/resources/wood.png' },
  stone: { label: '돌', icon: '🪨', image: 'assets/resources/stone.png' },
  plant: { label: '식물', icon: '🌿', image: 'assets/resources/plant.png' },
  ore: { label: '광석', icon: '⛏️', image: 'assets/resources/ore.png' }
};

// 속성은 종족과 분리된 데이터다. 종족은 속성 ID만 참조한다.
const ELEMENTS = {
  fire: { label: '불', icon: '🔥' },
  water: { label: '물', icon: '💧' },
  earth: { label: '땅', icon: '🪨' },
  wind: { label: '바람', icon: '🌪️' },
  grass: { label: '풀', icon: '🌿' },
  electric: { label: '전기', icon: '⚡' }
};

// 희귀도 4단계. discoveryWeight가 클수록 교배에서 새 종족으로 먼저 발견되기 쉽다.
const RARITIES = {
  common: { label: '일반', discoveryWeight: 3 },
  rare: { label: '희귀', discoveryWeight: 2 },
  epic: { label: '에픽', discoveryWeight: 1 },
  legendary: { label: '전설', discoveryWeight: 0.5 }
};

/* 그림 교체 방법 (종족 표 SPECIES와 시설 표 BUILDING_TYPES 공통)
 * 항목에 image: 'assets/pets/sproutbun.png' 처럼 그림 파일 경로를 적으면 임시 그림 대신 그 그림으로 그린다.
 * image가 없거나 파일을 불러오지 못한 항목은 지금의 임시 그림(도형과 이모지)으로 그린다.
 * 그림 크기: 펫 32×32, 시설 60×50, 자원 24×24 (투명 배경 PNG). 마을 화면에는 2배로 키워 그린다(한 점 = 화면 2칸).
 * 진한 외곽선·쨍한 색으로 다듬는 방법은 tools/bold_pixels.py에 있다. 펫은 오른쪽을 보게 그린다(왼쪽으로 갈 때는 자동으로 뒤집는다).
 * 펫 15종은 assets/pets, 시설 6종은 assets/buildings, 자원 4종(RESOURCES)은 assets/resources 폴더의 그림을 쓴다(파일 이름은 표의 ID와 같다).
 * 나무·꽃·바위·알 같은 장식 그림은 게임 데이터가 아니므로 아래 그리기 코드의 DECOR_IMAGES에 있다.
 * 시설 그림은 아래쪽 가운데가 시설 위치에 오도록 그린다. 땅에 닿는 부분을 그림 맨 아래에 맞춘다.
 */

/* 종족 표. 이름은 모두 임시이며 나중에 한꺼번에 바꿀 예정이다(이름은 이 표에서만 고치면 된다).
 * element / element2: 속성(ELEMENTS의 ID). element2는 복합 속성 종족만 적는다.
 * region: 소속 지역(REGIONS의 ID). 그 지역을 개방해야 교배로 태어날 수 있다.
 * breedOnly: true면 BREEDING_RULES에 등록된 부모 조합에서만 태어난다(새 종족 발견 추첨과 기본 규칙에서 제외).
 */
const SPECIES = {
  sproutbun: { name: '싹총이', icon: '🐰', image: 'assets/pets/sproutbun.png', element: 'grass', color: '#c9d99a', rarity: 'common', region: 'meadow', description: '새싹을 좋아하는 온순한 초원 펫.' },
  pebblelamb: { name: '몽양이', icon: '🐑', image: 'assets/pets/pebblelamb.png', element: 'earth', color: '#d9c7a5', rarity: 'common', region: 'meadow', description: '튼튼한 발굽으로 땅을 다지는 펫.' },
  dewotter: { name: '슬달이', icon: '🦦', image: 'assets/pets/dewotter.png', element: 'water', color: '#8cc6d8', rarity: 'common', region: 'meadow', description: '맑은 물가를 찾아다니는 호기심 많은 펫.' },
  breezefox: { name: '산들우', icon: '🦊', image: 'assets/pets/breezefox.png', element: 'wind', color: '#e8b58a', rarity: 'rare', region: 'meadow', description: '바람처럼 빠르게 숲을 누비는 펫.' },
  embergecko: { name: '불또마', icon: '🦎', image: 'assets/pets/embergecko.png', element: 'fire', color: '#df916e', rarity: 'rare', region: 'meadow', description: '따뜻한 바위에서 쉬기를 좋아한다.' },
  sparkchick: { name: '번아리', icon: '🐥', image: 'assets/pets/sparkchick.png', element: 'electric', color: '#e7d779', rarity: 'rare', region: 'meadow', description: '작은 몸에 반짝이는 에너지를 품고 있다.' },

  mossbear: { name: '끼고미', icon: '🐻', image: 'assets/pets/mossbear.png', element: 'grass', color: '#9db08a', rarity: 'common', region: 'forest', description: '등에 이끼가 자라는 느긋한 숲 펫.' },
  acornsquirrel: { name: '도토람', icon: '🐿️', image: 'assets/pets/acornsquirrel.png', element: 'earth', color: '#c9a47a', rarity: 'common', region: 'forest', description: '도토리를 묻어 두고 어디 묻었는지 잊어버린다.' },
  pineowl: { name: '솔붱이', icon: '🦉', image: 'assets/pets/pineowl.png', element: 'wind', color: '#b9a48c', rarity: 'rare', region: 'forest', description: '소리 없이 나뭇가지 사이를 난다.' },
  glowhog: { name: '반디치', icon: '🦔', image: 'assets/pets/glowhog.png', element: 'electric', color: '#d8cf8a', rarity: 'rare', region: 'forest', description: '가시 끝이 밤마다 깜빡인다.' },
  mistdeer: { name: '아슴이', icon: '🦌', image: 'assets/pets/mistdeer.png', element: 'water', color: '#b7cfd6', rarity: 'epic', region: 'forest', breedOnly: true, description: '안개 낀 새벽에만 모습을 보인다.' },
  elderturtle: { name: '나북이', icon: '🐢', image: 'assets/pets/elderturtle.png', element: 'earth', color: '#a8b58f', rarity: 'epic', region: 'forest', breedOnly: true, description: '등껍질에 작은 나무가 자란다.' },

  // 복합 속성(속성 2개) 종족. BREEDING_RULES.elementPairs에 등록된 부모 속성 조합에서 태어난다.
  lotusfrog: { name: '연구리', icon: '🐸', image: 'assets/pets/lotusfrog.png', element: 'water', element2: 'grass', color: '#a9d6a0', rarity: 'epic', region: 'forest', breedOnly: true, description: '연잎을 우산처럼 쓰고 다닌다.' },
  flarefly: { name: '화르비', icon: '🦋', image: 'assets/pets/flarefly.png', element: 'fire', element2: 'electric', color: '#f0b072', rarity: 'epic', region: 'forest', breedOnly: true, description: '날갯짓마다 작은 불티가 튄다.' },
  sandhamster: { name: '모래찌', icon: '🐹', image: 'assets/pets/sandhamster.png', element: 'earth', element2: 'wind', color: '#e3cf9f', rarity: 'epic', region: 'forest', breedOnly: true, description: '볼주머니에 모래바람을 담아 다닌다.' }
};

/* 종족의 예전 이름.
 * 펫과 알은 태어날 때의 종족 이름을 저장 데이터에 함께 담고 있다. 종족 이름을 바꾸면 예전 이름을 여기에 적어 둔다.
 * 그러면 예전 저장을 불러올 때 그 이름이 지금 이름으로 바뀐다. (이름을 다시 바꿀 때는 직전 이름을 목록에 추가한다.)
 */
const LEGACY_SPECIES_NAMES = {
  sproutbun: ['새싹토끼'],
  pebblelamb: ['몽돌양'],
  dewotter: ['이슬수달'],
  breezefox: ['산들여우'],
  embergecko: ['불씨도마뱀'],
  sparkchick: ['번개병아리']
};

// effect 문구는 아래 코드의 실제 동작과 반드시 일치시킨다.
const TRAITS = {
  smart: { name: '똑똑함', effect: '작업 효율 +10%' },
  healthy: { name: '건강함', effect: '최대 에너지 +20' },
  nimble: { name: '민첩함', effect: '이동 속도 +35%' },
  diligent: { name: '근면함', effect: '생산량 +10%' },
  sturdy: { name: '튼튼함', effect: '작업 에너지 소모 -1' },
  curious: { name: '호기심', effect: '교배 시 새 종족 발견 확률 +6%p' },
  lively: { name: '활발함', effect: '자유 생활 중 더 자주 돌아다님' }
};

// affinityElements: 이 속성의 펫은 해당 시설에서 생산량 보너스를 받는다(다른 속성도 작업은 가능).
const BUILDING_TYPES = {
  plaza: { name: '중앙 광장', icon: '🏡', image: 'assets/buildings/plaza.png', cost: {}, output: null, capacity: 0, affinityElements: [], description: '마을의 중심 공간' },
  nursery: { name: '교배장', icon: '🥚', image: 'assets/buildings/nursery.png', cost: {}, output: null, capacity: 0, affinityElements: [], description: '두 펫의 만남과 알 부화' },
  farm: { name: '농장', icon: '🌱', image: 'assets/buildings/farm.png', cost: { wood: 8, stone: 3 }, output: 'plant', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['grass', 'water'], description: '식물 자원을 생산' },
  // 벌목장 목재 비용은 6이다. 목재는 벌목장에서만 생산되므로, 시작 자원(목재 30)으로
  // 어떤 순서로 지어도 네 시설을 모두 지을 수 있게 맞춘 값이다(12였을 때는 영영 못 짓는 경우가 있었다).
  lumber: { name: '벌목장', icon: '🪵', image: 'assets/buildings/lumber.png', cost: { wood: 6, stone: 5 }, output: 'wood', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['earth', 'wind'], description: '목재 자원을 생산' },
  quarry: { name: '채굴장', icon: '⛏️', image: 'assets/buildings/quarry.png', cost: { wood: 10, stone: 8 }, output: 'stone', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['earth'], description: '돌과 광석을 생산' },
  smelter: { name: '제련소', icon: '🔥', image: 'assets/buildings/smelter.png', cost: { wood: 14, stone: 10, ore: 4 }, output: 'ore', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['fire', 'electric'], description: '광석을 모으고 정제' }
};

/* 지역 표.
 * unlock이 null이면 처음부터 열려 있는 지역이다.
 * unlock: { villageLevel: 필요한 마을 단계, discoveredSpecies: 필요한 발견 종족 수, cost: 개방할 때 소모하는 자원 }
 * giftSpecies: 지역을 개방하면 1마리 합류하는 종족(SPECIES의 ID)
 */
const REGIONS = {
  meadow: { name: '초원', icon: '🌾', description: '마을이 자리 잡은 평화로운 풀밭.', unlock: null },
  forest: { name: '숲', icon: '🌲', description: '키 큰 나무가 우거진 그늘진 땅.', unlock: { villageLevel: 3, discoveredSpecies: 5, cost: { wood: 100, stone: 60 } }, giftSpecies: 'mossbear' }
};

/* 교배 조합표.
 * 키는 두 ID를 가나다(알파벳) 순으로 정렬해 '+'로 이은 문자열이다. 예: 'fire+water'
 * 값은 [{ speciesId, weight }] 후보 목록이다.
 * - speciesPairs: 특정 부모 "종족" 조합 전용 결과 (가장 먼저 확인. 있으면 이 목록에서만 뽑는다)
 * - elementPairs: 부모 "속성" 조합에서 추가로 나올 수 있는 종족 (기본 규칙의 후보에 더해진다)
 * 기본 규칙: 부모와 속성이 하나라도 같은 종족 중 하나(각 weight 1).
 * 새 종족을 SPECIES에 추가한 뒤 여기에 한 줄만 넣으면 전용 조합이 된다.
 * 아직 개방하지 않은 지역의 종족은 후보에서 자동으로 빠진다.
 * weight는 나올 비율이다. 아래 두 줄은 전용 종족 1 : 부모 종족 2 : 2 → 전용 종족이 약 20%.
 */
const BREEDING_RULES = {
  speciesPairs: {
    'breezefox+dewotter': [{ speciesId: 'mistdeer', weight: 1 }, { speciesId: 'dewotter', weight: 2 }, { speciesId: 'breezefox', weight: 2 }],
    'mossbear+pebblelamb': [{ speciesId: 'elderturtle', weight: 1 }, { speciesId: 'mossbear', weight: 2 }, { speciesId: 'pebblelamb', weight: 2 }]
  },
  // 기본 후보가 3~4종(weight 합 3~4)이므로 아래 값이면 복합 속성 종족이 약 17%로 나온다.
  elementPairs: {
    'grass+water': [{ speciesId: 'lotusfrog', weight: 0.6 }],
    'electric+fire': [{ speciesId: 'flarefly', weight: 0.6 }],
    'earth+wind': [{ speciesId: 'sandhamster', weight: 0.8 }]
  }
};

const $ = (selector) => document.querySelector(selector);
const canvas = $('#villageCanvas');
const ctx = canvas.getContext('2d');
let activeTab = 'village';
let selectedPetId = null;
let lastFrame = 0;
let animationHandle = null;
let game;
let awaySnapshot = null;
// 화면 조작 중인 값. 패널을 다시 그려도 선택이 풀리지 않도록 따로 기억한다(저장 데이터에는 넣지 않는다).
const ui = { parentA: null, parentB: null, pendingWork: null, pendingName: null, selectedBuildingId: null };
// 쓰다듬기·놀아주기 연출 상태(펫 ID → { type, startedAt, until }). 화면 연출용이라 저장하지 않는다.
const petEffects = new Map();

function uid(prefix = 'id') { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randomItem(items) { return items[Math.floor(Math.random() * items.length)]; }
function weightedPick(entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * total;
  for (const entry of entries) { roll -= entry.weight; if (roll <= 0) return entry.id; }
  return entries[entries.length - 1].id;
}
function pairKey(a, b) { return [a, b].sort().join('+'); }
function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}분 ${String(r).padStart(2, '0')}초` : `${r}초`;
}
/* 낱말 끝 글자에 받침이 있는지 보고 알맞은 조사를 붙인다.
 * 예: withParticle('몽양이', '이', '가') → '몽양이가', withParticle('제련소', '을', '를') → '제련소를'
 * 끝 글자가 한글이 아니면(영어·숫자·기호) 고를 수 없으므로 '이(가)'처럼 둘 다 보여 준다.
 */
function withParticle(word, consonantForm, vowelForm) {
  const text = String(word);
  const code = text.charCodeAt(text.length - 1);
  if (!(code >= 0xAC00 && code <= 0xD7A3)) return consonantForm === '으로' ? `${text}(으)로` : `${text}${consonantForm}(${vowelForm})`;
  const finalConsonant = (code - 0xAC00) % 28;
  if (consonantForm === '으로' && finalConsonant === 8) return text + vowelForm; // ㄹ 받침 뒤에는 '로'
  return text + (finalConsonant ? consonantForm : vowelForm);
}
function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
  return `${minutes}분`;
}

function baseMaxEnergy(traits) { return CONFIG.baseEnergy + (traits.includes('healthy') ? CONFIG.healthyEnergyBonus : 0); }

function makePet(speciesId, traits = null) {
  const species = SPECIES[speciesId];
  const availableTraits = Object.keys(TRAITS);
  const selectedTraits = traits || [randomItem(availableTraits)];
  const maxEnergy = baseMaxEnergy(selectedTraits);
  return {
    id: uid('pet'), speciesId, name: species.name, traits: selectedTraits,
    energy: maxEnergy, maxEnergy,
    workBuildingId: null, resting: false, productionProgress: 0, restProgress: 0, yieldProgress: 0, oreProgress: 0, appearance: null,
    x: 0.18 + Math.random() * 0.64, y: 0.2 + Math.random() * 0.62,
    targetX: 0.18 + Math.random() * 0.64, targetY: 0.2 + Math.random() * 0.62,
    direction: Math.random() > .5 ? 1 : -1, moving: true, bob: Math.random() * 6.28, idleTimer: null
  };
}

// 저장된 이름이 비어 있거나 그 종족의 예전 이름이면 지금 종족 이름을 돌려준다.
function currentPetName(speciesId, savedName) {
  const legacy = LEGACY_SPECIES_NAMES[speciesId] || [];
  return typeof savedName === 'string' && savedName && !legacy.includes(savedName) ? savedName : SPECIES[speciesId].name;
}

function defaultOpenRegions() { return Object.keys(REGIONS).filter(id => !REGIONS[id].unlock); }

function createInitialGame() {
  const plaza = { id: uid('building'), type: 'plaza', x: 0.5, y: 0.48, level: 1 };
  const nursery = { id: uid('building'), type: 'nursery', x: 0.73, y: 0.35, level: 1 };
  const farm = { id: uid('building'), type: 'farm', x: 0.28, y: 0.68, level: 1 };
  const p1 = makePet('sproutbun', ['curious']);
  const p2 = makePet('pebblelamb', ['sturdy']);
  return {
    version: CONFIG.saveVersion, createdAt: Date.now(), lastSavedAt: Date.now(), lastTickAt: Date.now(),
    resources: { ...CONFIG.startingResources },
    buildings: [plaza, nursery, farm], pets: [p1, p2], eggs: [],
    discoveredSpecies: ['sproutbun', 'pebblelamb'], discoveredLooks: [], discoveredLooksBySpecies: {},
    unlockedRegions: defaultOpenRegions(), regionGiftsGiven: [],
    villageLevel: 1, totalDiscoveries: 2, message: '평화로운 초원에 새로운 하루가 시작됐어요.'
  };
}

// 예전 버전의 저장 데이터를 현재 구조로 바꾼다. 구조를 바꿀 때마다 여기에 단계를 추가한다.
function migrateSave(saved) {
  const version = Number(saved.version) || 1;
  // 예: if (version < 2) { ...v1 → v2 변환... }
  if (version > CONFIG.saveVersion) console.warn('This save was made by a newer build; loading it as-is.');
  saved.version = Math.max(version, CONFIG.saveVersion);
  return saved;
}

function normalizeGame(saved) {
  if (!saved || typeof saved !== 'object' || !saved.resources || !Array.isArray(saved.pets) || !Array.isArray(saved.buildings)) return createInitialGame();
  migrateSave(saved);
  const finite = (value, fallback) => (Number.isFinite(Number(value)) && value !== null ? Number(value) : fallback);

  saved.resources = { ...saved.resources };
  Object.keys(RESOURCES).forEach(key => { saved.resources[key] = Math.max(0, finite(saved.resources[key], 0)); });

  saved.buildings = saved.buildings.filter(b => b && BUILDING_TYPES[b.type]).map(b => ({
    ...b, id: b.id || uid('building'), level: Math.min(CONFIG.maxBuildingLevel, Math.max(1, Math.floor(Number(b.level)) || 1)),
    x: finite(b.x, .5), y: finite(b.y, .5)
  }));
  const workplaceIds = new Set(saved.buildings.filter(b => BUILDING_TYPES[b.type].output).map(b => b.id));

  saved.pets = saved.pets.filter(p => p && SPECIES[p.speciesId]).map(p => {
    const traits = Array.isArray(p.traits) ? p.traits.filter((t, i, arr) => TRAITS[t] && arr.indexOf(t) === i) : [];
    const maxEnergy = Number(p.maxEnergy) > 0 ? Number(p.maxEnergy) : baseMaxEnergy(traits);
    const workBuildingId = workplaceIds.has(p.workBuildingId) ? p.workBuildingId : null;
    return {
      ...p, id: p.id || uid('pet'), traits, maxEnergy,
      name: currentPetName(p.speciesId, p.name),
      energy: clamp(Number(p.energy) || 0, 0, maxEnergy),
      workBuildingId, resting: Boolean(workBuildingId && p.resting),
      productionProgress: clamp(Number(p.productionProgress) || 0, 0, CONFIG.productionIntervalSeconds),
      restProgress: clamp(Number(p.restProgress) || 0, 0, CONFIG.restIntervalSeconds),
      yieldProgress: Math.max(0, Number(p.yieldProgress) || 0), oreProgress: Math.max(0, Number(p.oreProgress) || 0),
      appearance: p.appearance || null,
      x: clamp(finite(p.x, .5), 0, 1), y: clamp(finite(p.y, .5), 0, 1),
      targetX: clamp(finite(p.targetX, .5), 0, 1), targetY: clamp(finite(p.targetY, .5), 0, 1),
      bob: finite(p.bob, 0), idleTimer: null
    };
  });

  saved.eggs = (Array.isArray(saved.eggs) ? saved.eggs : []).filter(egg => egg && egg.result && SPECIES[egg.result.speciesId]).map(egg => ({
    ...egg, id: egg.id || uid('egg'), remainingSeconds: Math.max(0, Number(egg.remainingSeconds) || 0),
    result: { ...egg.result, name: currentPetName(egg.result.speciesId, egg.result.name), traits: Array.isArray(egg.result.traits) ? egg.result.traits.filter(t => TRAITS[t]) : [] }
  }));

  // 펫도 알도 없으면 더 이상 진행할 방법이 없으므로 새 마을로 시작한다.
  if (saved.pets.length === 0 && saved.eggs.length === 0) return createInitialGame();

  const discovered = Array.isArray(saved.discoveredSpecies) ? saved.discoveredSpecies : [];
  saved.pets.forEach(p => discovered.push(p.speciesId)); // 보유 중인 종족은 항상 도감에 있어야 한다.
  saved.discoveredSpecies = discovered.filter((id, i, arr) => SPECIES[id] && arr.indexOf(id) === i);
  saved.discoveredLooks = Array.isArray(saved.discoveredLooks) ? saved.discoveredLooks.filter(look => typeof look === 'string') : [];
  // 종족별 희귀 외형 기록. 예전 저장에는 없으므로 지금 데리고 있는 펫의 외형으로 채운다.
  const savedLooks = saved.discoveredLooksBySpecies && typeof saved.discoveredLooksBySpecies === 'object' ? saved.discoveredLooksBySpecies : {};
  const looksBySpecies = {};
  const addLook = (speciesId, look) => {
    if (!SPECIES[speciesId] || typeof look !== 'string' || !look) return;
    if (!looksBySpecies[speciesId]) looksBySpecies[speciesId] = [];
    if (!looksBySpecies[speciesId].includes(look)) looksBySpecies[speciesId].push(look);
  };
  Object.keys(savedLooks).forEach(id => { if (Array.isArray(savedLooks[id])) savedLooks[id].forEach(look => addLook(id, look)); });
  saved.pets.forEach(p => addLook(p.speciesId, p.appearance));
  saved.discoveredLooksBySpecies = looksBySpecies;
  saved.totalDiscoveries = saved.discoveredSpecies.length;
  // 개방한 지역 목록. 예전 저장에는 없으므로 처음부터 열려 있는 지역만 채운다.
  const regions = defaultOpenRegions().concat(Array.isArray(saved.unlockedRegions) ? saved.unlockedRegions : []);
  saved.unlockedRegions = regions.filter((id, i, arr) => REGIONS[id] && arr.indexOf(id) === i);
  // 개방 선물을 이미 받은 지역 목록. 없으면 "아직 안 받음"으로 보고, 게임을 열 때 지급한다.
  saved.regionGiftsGiven = (Array.isArray(saved.regionGiftsGiven) ? saved.regionGiftsGiven : []).filter((id, i, arr) => saved.unlockedRegions.includes(id) && arr.indexOf(id) === i);
  saved.villageLevel = Number(saved.villageLevel) || 1;
  saved.lastTickAt = Number(saved.lastTickAt) || Date.now();
  saved.lastSavedAt = Number(saved.lastSavedAt) || Date.now();
  return saved;
}

function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.saveKey);
    if (!raw) return createInitialGame();
    return normalizeGame(JSON.parse(raw));
  } catch (error) {
    console.warn('Save load failed; starting a new village.', error);
    return createInitialGame();
  }
}

function saveGame(showLabel = false) {
  try {
    game.version = CONFIG.saveVersion;
    game.lastSavedAt = Date.now();
    localStorage.setItem(CONFIG.saveKey, JSON.stringify(game));
    $('#saveState').textContent = showLabel ? '저장 완료' : '자동 저장됨';
    if (showLabel) setTimeout(() => { $('#saveState').textContent = '자동 저장됨'; }, 1200);
  } catch (error) {
    console.error('Save failed:', error);
    $('#saveState').textContent = '저장 오류';
    toast('저장 공간이 부족하거나 브라우저 저장이 차단됐습니다.');
  }
}

/* 시간 진행의 유일한 입구.
 * 마지막으로 계산한 시각(game.lastTickAt)부터 지금까지 흐른 "정수 초"만큼만 시뮬레이션하고,
 * 계산한 만큼 lastTickAt을 앞으로 옮긴다. 1초 타이머, 탭 복귀, 게임 시작이 모두 이 함수만 쓰기 때문에
 * 같은 시간이 두 번 계산되거나(중복) 건너뛰어지는(누락) 일이 없다.
 * 반환값: 실제로 시뮬레이션한 초.
 */
function applyOfflineProgress() {
  const now = Date.now();
  if (!Number.isFinite(game.lastTickAt) || game.lastTickAt > now) game.lastTickAt = now; // PC 시계를 뒤로 돌린 경우
  const elapsed = Math.floor((now - game.lastTickAt) / 1000);
  if (elapsed <= 0) return 0;
  game.lastTickAt += elapsed * 1000;
  const capped = Math.min(elapsed, CONFIG.offlineCapSeconds);
  simulateSeconds(capped);
  return capped;
}

function takeAwaySnapshot(at) { return { at, resources: { ...game.resources } }; }
function reportAway(snapshot) {
  if (!snapshot) return;
  const away = Math.floor((Date.now() - snapshot.at) / 1000);
  if (away < CONFIG.awayReportSeconds) return;
  const capped = Math.min(away, CONFIG.offlineCapSeconds);
  const gains = Object.keys(RESOURCES).map(key => [key, Math.floor(game.resources[key]) - Math.floor(snapshot.resources[key])]).filter(([, diff]) => diff > 0)
    .map(([key, diff]) => `${RESOURCES[key].icon}+${diff}`).join(' ');
  const capNote = away > capped ? ' (최대 24시간까지만 반영)' : '';
  toast(`자리를 비운 ${formatDuration(capped)} 동안 마을이 운영됐어요.${gains ? ` ${gains}` : ''}${capNote}`, 5000);
}

function getBuilding(type) { return game.buildings.find(b => b.type === type); }
function getBuildingById(id) { return game.buildings.find(b => b.id === id); }
function getSelectedPet() { return game.pets.find(p => p.id === selectedPetId); }
function assignedCount(buildingId) { return game.pets.filter(p => p.workBuildingId === buildingId).length; }
function traitHas(pet, trait) { return pet.traits.includes(trait); }
function canAfford(cost) { return Object.entries(cost).every(([key, value]) => game.resources[key] >= value); }
function pay(cost) { Object.entries(cost).forEach(([key, value]) => { game.resources[key] -= value; }); }
function costLabel(cost) { return Object.entries(cost).map(([key, value]) => `${RESOURCES[key].icon} ${value}`).join(' · '); }
// 업그레이드는 생산 시설만, 최대 레벨 전까지, 비용 배수가 설정된 레벨로만 가능하다.
function canUpgrade(building) {
  return Boolean(BUILDING_TYPES[building.type].output) && building.level < CONFIG.maxBuildingLevel
    && CONFIG.upgradeCostMultipliers[building.level + 1] > 0;
}
function upgradeCost(building) {
  const multiplier = CONFIG.upgradeCostMultipliers[building.level + 1];
  const cost = {};
  Object.entries(BUILDING_TYPES[building.type].cost).forEach(([key, value]) => { cost[key] = Math.ceil(value * multiplier); });
  return cost;
}
function getWorkBuilding(pet) {
  const building = pet.workBuildingId ? getBuildingById(pet.workBuildingId) : null;
  return building && BUILDING_TYPES[building.type].output ? building : null;
}
// 펫의 속성 중 하나라도 시설의 적성 속성과 맞으면 보너스를 받는다.
function hasAffinity(pet, buildingType) { return speciesElements(SPECIES[pet.speciesId]).some(id => BUILDING_TYPES[buildingType].affinityElements.includes(id)); }
// 화면 표시(상태 문구·캔버스)와 시뮬레이션이 같은 기준을 쓰도록 한곳에서 판단한다.
function isWorking(pet) { return Boolean(getWorkBuilding(pet) && !pet.resting && pet.energy > 0); }
function isResting(pet) { return !isWorking(pet) && (pet.resting || pet.energy < pet.maxEnergy * CONFIG.pauseEnergyRatio); }

function simulatePetSeconds(pet, seconds) {
  let remaining = seconds;
  while (remaining > 0) {
    const building = getWorkBuilding(pet);
    const hasWork = Boolean(building);
    const working = hasWork && !pet.resting && pet.energy > 0;

    if (working) {
      const progress = Number(pet.productionProgress) || 0;
      const step = Math.max(0, Math.min(remaining, CONFIG.productionIntervalSeconds - progress));
      pet.productionProgress = progress + step;
      pet.restProgress = 0;
      remaining -= step;
      if (pet.productionProgress >= CONFIG.productionIntervalSeconds) {
        pet.productionProgress = 0;
        const type = BUILDING_TYPES[building.type].output;
        const affinity = hasAffinity(pet, building.type) ? CONFIG.affinityMultiplier : 1;
        const diligent = traitHas(pet, 'diligent') ? CONFIG.diligentMultiplier : 1;
        const smart = traitHas(pet, 'smart') ? CONFIG.smartMultiplier : 1;
        const drain = Math.max(1, CONFIG.energyDrainPerProduction - (traitHas(pet, 'sturdy') ? CONFIG.sturdyDrainReduction : 0));
        const rawYield = (pet.yieldProgress || 0) + affinity * diligent * smart * building.level;
        const amount = Math.floor(rawYield);
        pet.yieldProgress = rawYield - amount;
        game.resources[type] += amount;
        if (building.type === 'quarry') {
          pet.oreProgress = (pet.oreProgress || 0) + CONFIG.quarryOrePerProduction * building.level;
          const ore = Math.floor(pet.oreProgress);
          pet.oreProgress -= ore;
          game.resources.ore += ore;
        }
        pet.energy = clamp(pet.energy - drain, 0, pet.maxEnergy);
        if (pet.energy <= pet.maxEnergy * CONFIG.pauseEnergyRatio) pet.resting = true;
      }
    } else {
      if (hasWork && !pet.resting && pet.energy <= pet.maxEnergy * CONFIG.pauseEnergyRatio) pet.resting = true;
      const progress = Number(pet.restProgress) || 0;
      const step = Math.max(0, Math.min(remaining, CONFIG.restIntervalSeconds - progress));
      pet.restProgress = progress + step;
      pet.productionProgress = 0;
      remaining -= step;
      if (!hasWork) pet.resting = false;
      if (pet.restProgress >= CONFIG.restIntervalSeconds) {
        pet.restProgress = 0;
        pet.energy = clamp(pet.energy + CONFIG.energyRegenPerMinute, 0, pet.maxEnergy);
        if (hasWork && pet.energy >= pet.maxEnergy * CONFIG.resumeEnergyRatio) pet.resting = false;
      }
    }
  }
}

// 주어진 초만큼 게임 규칙을 진행한다. 시각(lastTickAt) 관리는 applyOfflineProgress가 맡는다.
function simulateSeconds(seconds) {
  if (seconds <= 0) return;
  game.pets.forEach(pet => simulatePetSeconds(pet, seconds));
  game.eggs.forEach(egg => { egg.remainingSeconds = Math.max(0, egg.remainingSeconds - seconds); });
  const ready = game.eggs.filter(egg => egg.remainingSeconds <= 0);
  const hatched = ready.filter(hatchEgg);
  game.eggs = game.eggs.filter(egg => !hatched.includes(egg));
  updateVillageLevel();
  if (hatched.length > 0) { saveGame(); renderAll(); }
}

// 부화에 성공하면 true. 펫 한도가 차 있으면 알을 유지하고 false.
function hatchEgg(egg) {
  if (game.pets.length >= CONFIG.maxPets) {
    egg.remainingSeconds = CONFIG.fullNurseryRetrySeconds;
    if (!egg.waitingForSpace) toast('펫 보관 한도에 도달했어요. 펫을 놓아주면 알이 부화합니다.');
    egg.waitingForSpace = true;
    return false;
  }
  const baby = egg.result;
  const speciesName = SPECIES[baby.speciesId].name;
  const pet = makePet(baby.speciesId, baby.traits.length ? baby.traits : null);
  pet.appearance = baby.look || null;
  pet.name = baby.name || speciesName;
  pet.energy = Math.min(pet.maxEnergy, baby.energy || pet.maxEnergy);
  const nursery = getBuilding('nursery');
  if (nursery) { pet.x = clamp(nursery.x + .06, .06, .94); pet.y = clamp(nursery.y + .08, .08, .9); }
  game.pets.push(pet);
  if (!game.discoveredSpecies.includes(baby.speciesId)) {
    game.discoveredSpecies.push(baby.speciesId);
    game.totalDiscoveries = game.discoveredSpecies.length;
    game.message = `새로운 종족 ${withParticle(speciesName, '을', '를')} 발견했어요!`;
    toast(`새 종족 발견: ${speciesName}!`);
  } else {
    game.message = `${withParticle(pet.name, '이', '가')} 마을에 합류했어요.`;
    toast(`${withParticle(speciesName, '이', '가')} 부화했어요.`);
  }
  if (baby.look) {
    if (!game.discoveredLooks.includes(baby.look)) game.discoveredLooks.push(baby.look);
    const looks = game.discoveredLooksBySpecies[baby.speciesId] || (game.discoveredLooksBySpecies[baby.speciesId] = []);
    if (!looks.includes(baby.look)) looks.push(baby.look);
  }
  return true;
}

function villageScore() { return game.buildings.length + game.discoveredSpecies.length * 2; }
function currentVillageLevel() {
  const score = villageScore();
  let level = 1;
  CONFIG.villageLevelThresholds.forEach((threshold, index) => { if (score >= threshold) level = index + 1; });
  return level;
}

// 지역 개방 규칙
function isRegionUnlocked(regionId) { return game.unlockedRegions.includes(regionId); }
function regionRequirements(regionId) {
  const unlock = REGIONS[regionId].unlock || {};
  const list = [];
  if (unlock.villageLevel) list.push({ label: '마을 단계', current: currentVillageLevel(), target: unlock.villageLevel });
  if (unlock.discoveredSpecies) list.push({ label: '발견 종족', current: game.discoveredSpecies.length, target: unlock.discoveredSpecies });
  Object.entries(unlock.cost || {}).forEach(([key, value]) => list.push({ label: `${resourceLabel(key)} (개방 시 소모)`, current: Math.floor(game.resources[key]), target: value }));
  return list.map(item => ({ ...item, met: item.current >= item.target }));
}
function canUnlockRegion(regionId) {
  return Boolean(REGIONS[regionId]) && !isRegionUnlocked(regionId) && regionRequirements(regionId).every(item => item.met);
}
function unlockRegion(regionId) {
  const region = REGIONS[regionId];
  if (!region || isRegionUnlocked(regionId)) return;
  if (!canUnlockRegion(regionId)) return toast('아직 개방 조건을 채우지 못했어요.');
  pay(region.unlock.cost || {});
  game.unlockedRegions.push(regionId);
  game.message = `${region.name} 지역의 안개가 걷혔어요.`;
  toast(`${region.name} 지역 개방!`);
  if (!grantPendingRegionGifts() && isRegionGiftPending(regionId)) toast('펫 자리가 가득 찼어요. 자리가 나면 새 친구가 찾아와요.');
  saveGame(); renderAll();
}
function isRegionGiftPending(regionId) {
  const speciesId = REGIONS[regionId].giftSpecies;
  return Boolean(speciesId && SPECIES[speciesId]) && isRegionUnlocked(regionId) && !game.regionGiftsGiven.includes(regionId);
}
// 개방한 지역의 선물 펫을 아직 받지 못했다면 지급한다. 펫 자리가 없으면 다음 기회로 미룬다.
// (지역 개방 직후, 게임을 열 때, 펫을 놓아준 뒤에 호출된다.) 한 마리라도 지급하면 true.
function grantPendingRegionGifts() {
  let granted = false;
  game.unlockedRegions.forEach(regionId => {
    if (!isRegionGiftPending(regionId)) return;
    if (game.pets.length + game.eggs.length >= CONFIG.maxPets) return;
    const speciesId = REGIONS[regionId].giftSpecies;
    const pet = makePet(speciesId);
    game.pets.push(pet);
    game.regionGiftsGiven.push(regionId);
    if (!game.discoveredSpecies.includes(speciesId)) {
      game.discoveredSpecies.push(speciesId);
      game.totalDiscoveries = game.discoveredSpecies.length;
    }
    game.message = `${REGIONS[regionId].name}에서 ${withParticle(pet.name, '이', '가')} 마을로 찾아왔어요.`;
    toast(`${REGIONS[regionId].name}의 새 친구 ${withParticle(pet.name, '이', '가')} 합류했어요!`);
    granted = true;
  });
  return granted;
}

function updateVillageLevel() {
  const thresholds = CONFIG.villageLevelThresholds;
  const score = villageScore();
  const level = currentVillageLevel();
  game.villageLevel = level;
  const current = thresholds[level - 1];
  const next = thresholds[level];
  const progress = next === undefined ? 100 : clamp((score - current) / (next - current) * 100, 8, 100);
  $('#villageLevel').textContent = `${level} 단계`;
  $('#levelProgress').style.width = `${progress}%`;
}

function resourceLabel(key) { return `${RESOURCES[key].icon} ${RESOURCES[key].label}`; }
function renderResources() {
  $('#resourceStrip').innerHTML = Object.entries(RESOURCES).map(([key, value]) => `
    <div class="resource-chip"><span class="ico">${resourceIconHtml(key)}</span><div><small>${value.label}</small><strong>${Math.floor(game.resources[key])}</strong></div></div>
  `).join('');
}

function petStateLabel(pet) {
  if (isWorking(pet)) return '작업 중';
  if (isResting(pet)) return '휴식 중';
  return '자유 생활';
}
function energyPercent(pet) { return Math.round((pet.energy / pet.maxEnergy) * 100); }
function energyText(pet) { return `${Math.round(pet.energy)}/${pet.maxEnergy} 에너지`; }
// 종족의 속성 목록(1개 또는 2개). 속성을 다루는 곳은 모두 이 함수를 거친다.
function speciesElements(species) { return [species.element, species.element2].filter(id => ELEMENTS[id]); }
function elementNames(species) { return speciesElements(species).map(id => ELEMENTS[id].label).join('·'); }
function elementLabel(species) { return speciesElements(species).map(id => `${ELEMENTS[id].icon} ${ELEMENTS[id].label}`).join(' · '); }
// 오른쪽 메뉴에 쓰는 그림 아이콘. 그림 파일이 있으면 그림으로, 없거나 불러오지 못했으면 이모지로 보여 준다.
function spriteImgHtml(key, path, emoji, className) {
  const sprite = sprites[key];
  if (!path || (sprite && sprite.failed)) return emoji;
  return `<img class="${className}" src="${escapeHtml(path)}" alt="${escapeHtml(emoji)}" draggable="false" onerror="this.replaceWith(this.alt)">`;
}
// small: 글자 줄 안에 넣는 작은 크기.
function speciesIconHtml(speciesId, small = false) { const species = SPECIES[speciesId]; return spriteImgHtml(`pet:${speciesId}`, species.image, species.icon, `pet-sprite${small ? ' small' : ''}`); }
function buildingIconHtml(type, small = false) { const meta = BUILDING_TYPES[type]; return spriteImgHtml(`building:${type}`, meta.image, meta.icon, `building-sprite${small ? ' small' : ''}`); }
function resourceIconHtml(key) { return spriteImgHtml(`resource:${key}`, RESOURCES[key].image, RESOURCES[key].icon, 'resource-sprite'); }
function eggIconHtml() { return spriteImgHtml('decor:egg', DECOR_IMAGES.egg, '🥚', 'egg-sprite'); }
function speciesLooks(speciesId) { return game.discoveredLooksBySpecies[speciesId] || []; }
function traitNames(pet) { return pet.traits.map(t => TRAITS[t].name).join(' / ') || '특성 없음'; }
// 이름을 바꾼 펫은 이름만으로 종족을 알 수 없으므로 종족 이름을 함께 보여 준다(이름이 종족 이름 그대로면 빈 문자열).
function renamedSpeciesName(pet) { const speciesName = SPECIES[pet.speciesId].name; return pet.name === speciesName ? '' : speciesName; }
// 교배는 부모의 속성 조합이 중요하므로 부모 목록에 종족과 속성을 함께 적는다.
function parentOptionLabel(pet) {
  const speciesName = renamedSpeciesName(pet);
  return `${pet.name}${speciesName ? `(${speciesName})` : ''} · ${elementNames(SPECIES[pet.speciesId])} · ${traitNames(pet)} · 에너지 ${Math.round(pet.energy)}`;
}

function renderPetCard(pet) {
  const species = SPECIES[pet.speciesId];
  const selected = selectedPetId === pet.id ? 'selected' : '';
  return `<button class="pet-card ${selected}" data-pet-id="${pet.id}">
    <span class="pet-avatar">${speciesIconHtml(pet.speciesId)}</span><span class="pet-main"><span class="pet-name">${escapeHtml(pet.name)}${pet.appearance ? ' ✦' : ''}</span><span class="pet-detail">${renamedSpeciesName(pet) ? `${renamedSpeciesName(pet)} · ` : ''}${elementNames(species)} · ${traitNames(pet)}</span><span class="energy-track"><i data-live-energy="${pet.id}" style="width:${energyPercent(pet)}%"></i></span></span><span class="pet-state" data-live-state="${pet.id}">${petStateLabel(pet)}</span>
  </button>`;
}

function regionRequirementsHtml(regionId) {
  return regionRequirements(regionId).map(item => `${item.met ? '✅' : '⬜'} ${item.label} ${item.current}/${item.target}`).join('<br>');
}
function renderRegions() {
  return Object.entries(REGIONS).map(([id, region]) => {
    if (isRegionUnlocked(id)) return `<div class="info-box" data-region="${id}" style="margin-bottom:7px"><b>${region.icon} ${region.name}</b> · 개방됨<br><span style="color:#adbea9">${region.description}</span>${isRegionGiftPending(id) ? '<br>🎁 펫 자리가 나면 새 친구가 찾아와요.' : ''}</div>`;
    const ready = canUnlockRegion(id);
    const gift = region.giftSpecies && SPECIES[region.giftSpecies] ? '<br>🎁 개방하면 이 지역의 펫 1마리가 합류해요.' : '';
    return `<div class="info-box" data-region="${id}" style="margin-bottom:7px;border-style:dashed"><b>🌫️ ${region.name}</b> · 안개에 가려진 지역<br><span data-region-req="${id}">${regionRequirementsHtml(id)}</span>${gift}<button class="btn ${ready ? 'primary' : 'secondary'} full" style="margin-top:8px" data-unlock-region="${id}" ${ready ? '' : 'disabled'}>안개 걷어내기</button></div>`;
  }).join('');
}

// 마을 그림에서 누른 시설의 정보와 배치된 펫을 보여 준다.
function renderSelectedBuildingPanel() {
  const building = getBuildingById(ui.selectedBuildingId);
  if (!building) return `<div class="info-box" style="margin-bottom:4px">마을 그림에서 시설을 누르면 정보와 배치된 펫을 볼 수 있어요.</div>`;
  const meta = BUILDING_TYPES[building.type];
  const lines = [`<span style="color:#adbea9">${meta.description}</span>`];
  let workerList = '';
  if (meta.output) {
    lines.push(`생산: ${resourceLabel(meta.output)}${building.type === 'quarry' ? ` (부산물 ${resourceLabel('ore')})` : ''} · 생산량 ×${building.level}`);
    lines.push(`적성 속성: ${meta.affinityElements.map(id => ELEMENTS[id].label).join(', ')} (생산량 ×${CONFIG.affinityMultiplier})`);
    const workers = game.pets.filter(p => p.workBuildingId === building.id);
    lines.push(`작업 펫 ${workers.length}/${meta.capacity}마리`);
    workerList = workers.length ? `<div class="pet-list" style="margin-top:7px">${workers.map(renderPetCard).join('')}</div>` : '<div class="empty-state" style="margin-top:7px">배치된 펫이 없어요.</div>';
  } else if (building.type === 'nursery') {
    lines.push(`부화 대기 중인 알 ${game.eggs.length}/${CONFIG.maxEggs}개`);
  } else {
    lines.push(`마을 발전 ${currentVillageLevel()}단계`);
  }
  const levelText = meta.output ? `Lv.${building.level}/${CONFIG.maxBuildingLevel}` : `Lv.${building.level}`;
  return `<div class="subheading"><span>선택한 시설</span><span class="count-pill">${levelText}</span></div>
    <div class="info-box" data-selected-building="${building.id}"><b>${buildingIconHtml(building.type, true)} ${meta.name}</b><br>${lines.join('<br>')}</div>${workerList}`;
}

function renderVillageTab() {
  const buildings = game.buildings.map(building => {
    const meta = BUILDING_TYPES[building.type];
    const workers = assignedCount(building.id);
    if (!meta.output) return `<div class="build-card"><div class="build-icon">${buildingIconHtml(building.type)}</div><strong>${meta.name}</strong><small>${meta.description}<br>마을 주요 시설</small><div class="build-cost">Lv.${building.level}</div><button class="btn secondary" disabled>기본 시설</button></div>`;
    let upgradeLine = '최대 레벨';
    let upgradeButton = '<button class="btn secondary" style="margin-top:5px" disabled>최대 레벨</button>';
    if (canUpgrade(building)) {
      const cost = upgradeCost(building);
      const affordable = canAfford(cost);
      upgradeLine = `Lv.${building.level + 1} 비용: ${costLabel(cost)}`;
      upgradeButton = `<button class="btn ${affordable ? 'primary' : 'secondary'}" style="margin-top:5px" data-upgrade="${building.id}" ${affordable ? '' : 'disabled'}>업그레이드</button>`;
    }
    return `<div class="build-card"><div class="build-icon">${buildingIconHtml(building.type)}</div><strong>${meta.name}</strong><small>${meta.description}<br>작업 펫 ${workers}/${meta.capacity}마리</small><div class="build-cost">Lv.${building.level}/${CONFIG.maxBuildingLevel} · 생산량 ×${building.level}<br>${upgradeLine}</div><button class="btn secondary" data-focus-building="${building.id}">배치 관리</button>${upgradeButton}</div>`;
  }).join('');
  const available = Object.entries(BUILDING_TYPES).filter(([type, meta]) => meta.output && !getBuilding(type));
  const buildCards = available.map(([type, meta]) => `<div class="build-card"><div class="build-icon">${buildingIconHtml(type)}</div><strong>${meta.name}</strong><small>${meta.description}</small><div class="build-cost">${costLabel(meta.cost)}</div><button class="btn ${canAfford(meta.cost) ? 'primary' : 'secondary'}" data-build="${type}" ${canAfford(meta.cost) ? '' : 'disabled'}>건설하기</button></div>`).join('');
  return `<h2 class="section-title">마을 관리</h2><p class="section-description">작업장을 세우고 펫을 배치해 마을의 기반을 넓혀보세요.</p>
    ${renderSelectedBuildingPanel()}
    <div class="subheading"><span>건설된 시설</span><span class="count-pill">${game.buildings.length}개</span></div><div class="build-grid">${buildings}</div>
    <div class="subheading"><span>새 시설 건설</span><span class="count-pill">자원 사용</span></div><div class="build-grid">${buildCards || '<div class="empty-state">모든 기본 생산 시설을 건설했어요.</div>'}</div>
    <div class="subheading"><span>지역</span><span class="count-pill">${game.unlockedRegions.length}/${Object.keys(REGIONS).length} 개방</span></div>${renderRegions()}
    <div class="subheading"><span>현재 펫</span><span class="count-pill">${game.pets.length}마리</span></div><div class="pet-list">${game.pets.map(renderPetCard).join('')}</div>
    ${renderSelectedPetPanel()}`;
}

function renderSelectedPetPanel() {
  const pet = getSelectedPet();
  if (!pet) return `<div class="info-box" style="margin-top:12px">펫을 선택하면 작업 배치와 교감 기능을 사용할 수 있어요.</div>`;
  const species = SPECIES[pet.speciesId];
  const buildings = game.buildings.filter(b => BUILDING_TYPES[b.type].capacity);
  const chosen = ui.pendingWork && ui.pendingWork.petId === pet.id ? ui.pendingWork.value : (pet.workBuildingId || '');
  const traitChips = pet.traits.map(t => `<span class="trait-chip">${TRAITS[t].name} · ${TRAITS[t].effect}</span>`).join('') || '<span class="trait-chip">특성 없음</span>';
  const goodAt = Object.keys(BUILDING_TYPES).filter(type => hasAffinity(pet, type)).map(type => BUILDING_TYPES[type].name).join(', ') || '없음';
  const canRelease = game.pets.length > CONFIG.minPets;
  const nameValue = ui.pendingName && ui.pendingName.petId === pet.id ? ui.pendingName.value : pet.name;
  return `<div class="subheading"><span>선택한 펫 관리</span><span class="count-pill" data-live-energy-text="${pet.id}">${energyText(pet)}</span></div>
    <div class="pet-profile"><div class="pet-profile-head"><span class="pet-avatar">${speciesIconHtml(pet.speciesId)}</span><div><strong>${escapeHtml(pet.name)}</strong><small>${renamedSpeciesName(pet) ? `${renamedSpeciesName(pet)} · ` : ''}${elementLabel(species)} · ${RARITIES[species.rarity].label} · <span data-live-state="${pet.id}">${petStateLabel(pet)}</span></small></div></div>
      <div class="pet-profile-row">${traitChips}</div>
      <div class="pet-profile-row"><small>잘하는 일: ${goodAt}${pet.appearance ? ` · 희귀 외형: ${escapeHtml(pet.appearance)} ✦` : ''}</small></div></div>
    <label class="field-label" for="workSelect">작업장 배치</label><select class="select" id="workSelect"><option value="">자유 생활</option>${buildings.map(b => `<option value="${b.id}" ${chosen === b.id ? 'selected' : ''}>${BUILDING_TYPES[b.type].name} (${assignedCount(b.id)}/${BUILDING_TYPES[b.type].capacity})${hasAffinity(pet, b.type) ? ' · 적성 ★' : ''}</option>`).join('')}</select>
    <div class="button-row"><button class="btn primary" id="assignButton">배치 적용</button><button class="btn secondary" id="feedButton">먹이 주기 🌿${CONFIG.feedPlantCost}</button><button class="btn danger" id="releaseButton" ${canRelease ? '' : `disabled title="펫은 최소 ${CONFIG.minPets}마리가 필요해요."`}>놓아주기</button></div>
    <div class="button-row"><button class="btn secondary" id="strokeButton">쓰다듬기</button><button class="btn secondary" id="playButton">놀아주기 ⚡${CONFIG.playEnergyCost}</button></div>
    <label class="field-label" for="petNameInput">이름 (최대 ${CONFIG.maxPetNameLength}자)</label>
    <div class="button-row" style="margin-top:0"><input class="select" id="petNameInput" style="flex:1;min-width:0" maxlength="${CONFIG.maxPetNameLength}" value="${escapeHtml(nameValue)}"><button class="btn secondary" id="renameButton">이름 바꾸기</button></div>`;
}

function renderPetsTab() {
  return `<h2 class="section-title">내 펫</h2><p class="section-description">펫들은 작업하지 않을 때 초원을 자유롭게 돌아다녀요.</p>
    ${renderSelectedPetPanel()}
    <div class="subheading"><span>보유 펫</span><span class="count-pill">${game.pets.length}/${CONFIG.maxPets}</span></div>
    <div class="pet-list">${game.pets.map(renderPetCard).join('')}</div>`;
}

// 교배 탭의 부모 선택값이 유효하도록 보정한다(펫이 사라졌거나 같은 펫이 골라진 경우 대비).
function syncBreedParents() {
  const ids = game.pets.map(p => p.id);
  if (!ids.includes(ui.parentA)) ui.parentA = ids[0] || null;
  if (!ids.includes(ui.parentB)) ui.parentB = ids.find(id => id !== ui.parentA) || null;
}

function renderBreedTab() {
  syncBreedParents();
  const options = (chosenId) => game.pets.map(p => `<option value="${p.id}" data-parent-option="${p.id}" ${p.id === chosenId ? 'selected' : ''}>${escapeHtml(parentOptionLabel(p))}</option>`).join('');
  const eggTime = (egg) => egg.waitingForSpace ? '공간 부족' : formatTime(egg.remainingSeconds);
  const full = game.pets.length + game.eggs.length >= CONFIG.maxPets;
  const breedForm = game.pets.length < 2 ? '<div class="empty-state">교배하려면 펫이 두 마리 이상 필요해요.</div>'
    : `<label class="field-label" for="parentA">첫 번째 부모</label><select class="select" id="parentA">${options(ui.parentA)}</select><label class="field-label" for="parentB">두 번째 부모</label><select class="select" id="parentB">${options(ui.parentB)}</select><div class="info-box" style="margin-top:10px">${full ? `펫과 알의 합이 보관 한도(${CONFIG.maxPets})에 도달했어요. 펫 메뉴에서 펫을 놓아주면 다시 교배할 수 있어요.` : '부모의 속성을 바탕으로 자식 후보가 결정됩니다. 일부 종족은 특정한 부모 조합에서만 태어나고, 새 지역의 종족은 그 지역을 개방한 뒤에만 태어납니다.'}</div><button class="btn primary full" id="breedButton" style="margin-top:12px">교배 시작하기</button>`;
  return `<h2 class="section-title">교배장</h2><p class="section-description">두 펫의 속성과 특성이 다음 세대에 이어질 수 있어요. 성별 제한은 없습니다.</p>
    ${game.eggs.length ? `<div class="subheading"><span>부화 대기 중인 알</span><span class="count-pill">${game.eggs.length}/${CONFIG.maxEggs}개</span></div>${game.eggs.map(egg => `<div class="egg-card"><span class="egg-icon">${eggIconHtml()}</span><span class="egg-info"><strong>정체를 알 수 없는 알</strong><small>부화 결과는 아직 공개되지 않아요.</small></span><span class="egg-time" data-egg-time="${egg.id}">${eggTime(egg)}</span></div>`).join('')}` : '<div class="empty-state">아직 부화 대기 중인 알이 없어요.</div>'}
    <div class="subheading"><span>새로운 알 만들기</span><span class="count-pill">부모 각각 에너지 ${CONFIG.breedEnergyCost} 소모</span></div>
    ${breedForm}
    <div class="subheading"><span>교배 규칙</span></div><div class="info-box">• 알이 만들어지는 시점에 결과 데이터가 결정됩니다.<br>• 부화 전까지 종족·외형·특성은 공개되지 않습니다.<br>• 부모 특성 일부가 계승되거나 새로운 특성이 생길 수 있습니다.</div>`;
}

function renderDexTab() {
  // 지역별로 묶어서 보여 준다.
  const groups = Object.entries(REGIONS).map(([regionId, region]) => {
    const ids = Object.keys(SPECIES).filter(id => SPECIES[id].region === regionId);
    if (!ids.length) return '';
    const open = isRegionUnlocked(regionId);
    const foundCount = ids.filter(id => game.discoveredSpecies.includes(id)).length;
    const cards = ids.map(id => {
      const species = SPECIES[id];
      const found = game.discoveredSpecies.includes(id);
      const byElements = Object.values(BREEDING_RULES.elementPairs).some(list => list.some(entry => entry.speciesId === id));
      const hint = !open ? '지역 미개방' : !species.breedOnly ? '발견 조건 미확인' : byElements ? '특별한 속성 조합 필요' : '특별한 부모 조합 필요';
      return `<div class="dex-card ${found ? '' : 'locked'}"><div class="dex-icon">${found ? speciesIconHtml(id) : '❔'}</div><strong>${found ? species.name : '미발견 종족'}</strong><small>${found ? `${elementNames(species)} · ${RARITIES[species.rarity].label}${speciesLooks(id).length ? ` · ✦${speciesLooks(id).length}` : ''}` : hint}</small></div>`;
    }).join('');
    return `<div class="subheading" data-dex-region="${regionId}"><span>${open ? region.icon : '🌫️'} ${region.name}</span><span class="count-pill">${foundCount} / ${ids.length}</span></div><div class="dex-grid">${cards}</div>`;
  }).join('');
  return `<h2 class="section-title">종족 도감</h2><p class="section-description">처음 발견한 종족은 자동으로 기록됩니다.</p><div class="stat-grid"><div class="stat"><span>발견 종족</span><strong>${game.discoveredSpecies.length} / ${Object.keys(SPECIES).length}</strong></div><div class="stat"><span>발견한 희귀 외형</span><strong>${game.discoveredLooks.length}종</strong></div></div>${groups}<div class="subheading"><span>발견한 종족 정보</span></div>${game.discoveredSpecies.map(id => `<div class="info-box" style="margin-bottom:7px"><b>${speciesIconHtml(id, true)} ${SPECIES[id].name}</b> · ${elementNames(SPECIES[id])} 속성 · ${RARITIES[SPECIES[id].rarity].label}<br><span style="color:#adbea9">${SPECIES[id].description}</span>${speciesLooks(id).length ? `<br>✦ 희귀 외형 ${speciesLooks(id).length}/${CONFIG.rareLookVariants}: ${speciesLooks(id).slice().sort().map(escapeHtml).join(', ')}` : ''}</div>`).join('')}`;
}

// 화면 전체를 다시 그린다. 버튼을 누르거나 알이 부화하는 등 "구성"이 바뀔 때만 호출한다.
function renderAll() {
  renderResources();
  updateVillageLevel();
  $('#worldMessage').textContent = game.message || '펫들이 초원에서 평화롭게 지내고 있어요.';
  $('#panelContent').innerHTML = activeTab === 'village' ? renderVillageTab() : activeTab === 'pets' ? renderPetsTab() : activeTab === 'breed' ? renderBreedTab() : renderDexTab();
  document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === activeTab));
  bindPanelEvents();
  drawVillage();
}

// 매초 바뀌는 숫자만 제자리에서 고친다. 패널을 통째로 다시 그리지 않으므로
// 고르던 드롭다운이 초기화되거나 누르던 버튼이 사라지지 않는다.
function refreshLive() {
  const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  renderResources();
  updateVillageLevel();
  setText($('#worldMessage'), game.message || '펫들이 초원에서 평화롭게 지내고 있어요.');
  const panel = $('#panelContent');
  game.pets.forEach(pet => {
    panel.querySelectorAll(`[data-live-energy="${pet.id}"]`).forEach(node => { node.style.width = `${energyPercent(pet)}%`; });
    panel.querySelectorAll(`[data-live-state="${pet.id}"]`).forEach(node => setText(node, petStateLabel(pet)));
    panel.querySelectorAll(`[data-live-energy-text="${pet.id}"]`).forEach(node => setText(node, energyText(pet)));
    panel.querySelectorAll(`[data-parent-option="${pet.id}"]`).forEach(node => setText(node, parentOptionLabel(pet)));
  });
  game.eggs.forEach(egg => {
    panel.querySelectorAll(`[data-egg-time="${egg.id}"]`).forEach(node => setText(node, egg.waitingForSpace ? '공간 부족' : formatTime(egg.remainingSeconds)));
  });
  panel.querySelectorAll('[data-build]').forEach(button => {
    const affordable = canAfford(BUILDING_TYPES[button.dataset.build].cost);
    button.disabled = !affordable;
    button.classList.toggle('primary', affordable);
    button.classList.toggle('secondary', !affordable);
  });
  panel.querySelectorAll('[data-region-req]').forEach(node => {
    const html = regionRequirementsHtml(node.dataset.regionReq);
    if (node.dataset.shown !== html) { node.innerHTML = html; node.dataset.shown = html; }
  });
  panel.querySelectorAll('[data-unlock-region]').forEach(button => {
    const ready = canUnlockRegion(button.dataset.unlockRegion);
    button.disabled = !ready;
    button.classList.toggle('primary', ready);
    button.classList.toggle('secondary', !ready);
  });
  panel.querySelectorAll('[data-upgrade]').forEach(button => {
    const building = getBuildingById(button.dataset.upgrade);
    const affordable = Boolean(building) && canUpgrade(building) && canAfford(upgradeCost(building));
    button.disabled = !affordable;
    button.classList.toggle('primary', affordable);
    button.classList.toggle('secondary', !affordable);
  });
}

function selectPet(petId) {
  if (selectedPetId !== petId) { ui.pendingWork = null; ui.pendingName = null; }
  selectedPetId = petId;
}

function bindPanelEvents() {
  document.querySelectorAll('[data-pet-id]').forEach(button => button.addEventListener('click', () => {
    selectPet(button.dataset.petId);
    renderAll();
  }));
  document.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => build(button.dataset.build)));
  document.querySelectorAll('[data-upgrade]').forEach(button => button.addEventListener('click', () => upgradeBuilding(button.dataset.upgrade)));
  document.querySelectorAll('[data-unlock-region]').forEach(button => button.addEventListener('click', () => unlockRegion(button.dataset.unlockRegion)));
  document.querySelectorAll('[data-focus-building]').forEach(button => button.addEventListener('click', () => {
    const building = getBuildingById(button.dataset.focusBuilding);
    if (!building) return;
    // 지금 선택한 펫이 쉬고 있으면 그 펫을, 아니면 일이 없는 펫을 골라 해당 작업장을 미리 선택해 둔다.
    const current = getSelectedPet();
    const candidate = (current && !current.workBuildingId ? current : null) || game.pets.find(p => !p.workBuildingId) || current || game.pets[0];
    activeTab = 'pets';
    if (candidate) { selectPet(candidate.id); ui.pendingWork = { petId: candidate.id, value: building.id }; }
    renderAll();
    toast(`${withParticle(BUILDING_TYPES[building.type].name, '을', '를')} 골라 두었어요. '배치 적용'을 누르면 배치됩니다.`);
  }));
  const workSelect = $('#workSelect');
  if (workSelect) workSelect.addEventListener('change', () => { ui.pendingWork = { petId: selectedPetId, value: workSelect.value }; });
  const parentA = $('#parentA');
  if (parentA) parentA.addEventListener('change', () => { ui.parentA = parentA.value; });
  const parentB = $('#parentB');
  if (parentB) parentB.addEventListener('change', () => { ui.parentB = parentB.value; });
  const assignButton = $('#assignButton');
  if (assignButton) assignButton.addEventListener('click', assignSelectedPet);
  const feedButton = $('#feedButton');
  if (feedButton) feedButton.addEventListener('click', feedSelectedPet);
  const releaseButton = $('#releaseButton');
  if (releaseButton) releaseButton.addEventListener('click', releaseSelectedPet);
  const strokeButton = $('#strokeButton');
  if (strokeButton) strokeButton.addEventListener('click', strokeSelectedPet);
  const playButton = $('#playButton');
  if (playButton) playButton.addEventListener('click', playWithSelectedPet);
  const petNameInput = $('#petNameInput');
  if (petNameInput) {
    petNameInput.addEventListener('input', () => { ui.pendingName = { petId: selectedPetId, value: petNameInput.value }; });
    petNameInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') renameSelectedPet(); });
  }
  const renameButton = $('#renameButton');
  if (renameButton) renameButton.addEventListener('click', renameSelectedPet);
  const breedButton = $('#breedButton');
  if (breedButton) breedButton.addEventListener('click', startBreeding);
}

function build(type) {
  const meta = BUILDING_TYPES[type];
  if (!meta || getBuilding(type)) return;
  if (!canAfford(meta.cost)) return toast('자원이 부족해요.');
  pay(meta.cost);
  const positions = { farm: [.28, .68], lumber: [.75, .73], quarry: [.18, .37], smelter: [.83, .52] };
  const [x, y] = positions[type] || [.5, .5];
  game.buildings.push({ id: uid('building'), type, x, y, level: 1 });
  game.message = `${withParticle(meta.name, '을', '를')} 건설했어요.`;
  saveGame(); renderAll(); toast(`${meta.name} 건설 완료!`);
}

function upgradeBuilding(buildingId) {
  const building = getBuildingById(buildingId);
  if (!building || !canUpgrade(building)) return;
  const cost = upgradeCost(building);
  if (!canAfford(cost)) return toast('자원이 부족해요.');
  pay(cost);
  building.level += 1;
  const name = BUILDING_TYPES[building.type].name;
  game.message = `${withParticle(name, '을', '를')} Lv.${building.level}까지 업그레이드했어요.`;
  saveGame(); renderAll(); toast(`${name} Lv.${building.level} 업그레이드 완료!`);
}

function assignSelectedPet() {
  const pet = getSelectedPet();
  const targetId = $('#workSelect')?.value || null;
  if (!pet) return;
  if (targetId === (pet.workBuildingId || null)) {
    ui.pendingWork = null;
    return toast(targetId ? '이미 그 작업장에 배치되어 있어요.' : '이미 자유 생활 중이에요.');
  }
  if (targetId) {
    const building = getBuildingById(targetId);
    if (!building) return;
    if (assignedCount(targetId) >= BUILDING_TYPES[building.type].capacity) return toast('작업장에 빈 자리가 없어요.');
    if (pet.energy < CONFIG.minEnergyToAssign) return toast('에너지가 부족해 지금은 작업할 수 없어요.');
  }
  pet.workBuildingId = targetId;
  pet.productionProgress = 0;
  pet.resting = Boolean(targetId && pet.energy <= pet.maxEnergy * CONFIG.pauseEnergyRatio);
  ui.pendingWork = null;
  game.message = !targetId ? `${withParticle(pet.name, '이', '가')} 자유 생활을 시작했어요.`
    : pet.resting ? `${withParticle(pet.name, '이', '가')} 배치됐어요. 에너지를 회복한 뒤 작업을 시작해요.` : `${withParticle(pet.name, '이', '가')} 작업을 시작했어요.`;
  saveGame(); renderAll(); toast(game.message);
}

function feedSelectedPet() {
  const pet = getSelectedPet();
  if (!pet) return;
  if (game.resources.plant < CONFIG.feedPlantCost) return toast('먹이를 줄 식물이 부족해요.');
  if (pet.energy >= pet.maxEnergy) return toast('에너지가 이미 가득 찼어요.');
  game.resources.plant -= CONFIG.feedPlantCost;
  pet.energy = clamp(pet.energy + CONFIG.feedEnergyGain, 0, pet.maxEnergy);
  if (pet.resting && pet.energy >= pet.maxEnergy * CONFIG.resumeEnergyRatio) pet.resting = false;
  game.message = `${pet.name}에게 먹이를 줬어요.`;
  saveGame(); renderAll(); toast(`${pet.name}의 에너지가 회복됐어요.`);
}

// 교감 연출. 친밀도 같은 수치는 없고 화면 연출만 한다(놀아주기는 에너지만 소모).
function startPetEffect(petId, type, seconds) {
  const now = performance.now();
  petEffects.set(petId, { type, startedAt: now, until: now + seconds * 1000 });
}
function activePetEffect(petId) {
  const effect = petEffects.get(petId);
  if (!effect) return null;
  if (performance.now() >= effect.until) { petEffects.delete(petId); return null; }
  return effect;
}
function strokeSelectedPet() {
  const pet = getSelectedPet();
  if (!pet) return;
  startPetEffect(pet.id, 'stroke', CONFIG.strokeEffectSeconds);
  game.message = `${withParticle(pet.name, '이', '가')} 기분 좋아해요.`;
  refreshLive();
}
function playWithSelectedPet() {
  const pet = getSelectedPet();
  if (!pet) return;
  if (isWorking(pet) || isResting(pet)) return toast('자유 생활 중인 펫과만 놀 수 있어요.');
  if (pet.energy < CONFIG.playEnergyCost) return toast('에너지가 부족해요.');
  pet.energy = clamp(pet.energy - CONFIG.playEnergyCost, 0, pet.maxEnergy);
  startPetEffect(pet.id, 'play', CONFIG.playEffectSeconds);
  game.message = `${withParticle(pet.name, '이', '가')} 신나게 뛰어놀아요.`;
  saveGame(); refreshLive();
}

function renameSelectedPet() {
  const pet = getSelectedPet();
  if (!pet) return;
  const name = ($('#petNameInput')?.value || '').trim().slice(0, CONFIG.maxPetNameLength);
  if (!name) return toast('이름을 입력해 주세요.');
  if (name === pet.name) return toast('지금 이름과 같아요.');
  pet.name = name;
  ui.pendingName = null;
  game.message = `이름을 ${withParticle(name, '으로', '로')} 바꿨어요.`;
  saveGame(); renderAll(); toast(game.message);
}

// 펫 한도(maxPets)가 차면 알이 부화하지 못하므로, 자리를 비울 수단으로 놓아주기를 제공한다.
function releaseSelectedPet() {
  const pet = getSelectedPet();
  if (!pet) return;
  if (game.pets.length <= CONFIG.minPets) return toast(`펫은 최소 ${CONFIG.minPets}마리가 필요해요.`);
  if (!confirm(`${withParticle(pet.name, '을', '를')} 초원으로 돌려보낼까요? 되돌릴 수 없어요. (도감 기록은 유지됩니다)`)) return;
  game.pets = game.pets.filter(p => p.id !== pet.id);
  ui.pendingWork = null;
  selectedPetId = game.pets[0]?.id || null;
  grantPendingRegionGifts(); // 자리가 없어 미뤄 둔 지역 선물이 있으면 지금 지급한다.
  game.message = `${withParticle(pet.name, '이', '가')} 초원으로 돌아갔어요.`;
  saveGame(); renderAll(); toast(game.message);
}

function pickChildSpecies(parentA, parentB) {
  const a = SPECIES[parentA.speciesId];
  const b = SPECIES[parentB.speciesId];
  // 개방한 지역의 종족만 태어날 수 있다.
  const available = (id) => isRegionUnlocked(SPECIES[id].region);
  // 새 종족 발견 추첨: 아직 발견하지 못한 종족이 수집 목록에 들어올 기회를 준다(조합 전용 종족은 제외).
  const undiscovered = Object.keys(SPECIES).filter(id => available(id) && !SPECIES[id].breedOnly && !game.discoveredSpecies.includes(id));
  const curiousParents = [parentA, parentB].filter(parent => traitHas(parent, 'curious')).length;
  const discoveryChance = CONFIG.discoveryChance + curiousParents * CONFIG.curiousDiscoveryBonus;
  if (undiscovered.length && Math.random() < discoveryChance) {
    return weightedPick(undiscovered.map(id => ({ id, weight: RARITIES[SPECIES[id].rarity].discoveryWeight })));
  }
  // 종족 조합표에 전용 결과가 있으면 그것만 쓴다.
  const table = BREEDING_RULES.speciesPairs[pairKey(parentA.speciesId, parentB.speciesId)];
  const tableEntries = (table || []).filter(entry => SPECIES[entry.speciesId] && available(entry.speciesId)).map(entry => ({ id: entry.speciesId, weight: entry.weight || 1 }));
  if (tableEntries.length) return weightedPick(tableEntries);
  // 기본 규칙: 부모의 속성 중 하나라도 같은 종족(조합 전용 종족은 제외).
  const aElements = speciesElements(a), bElements = speciesElements(b);
  const parentElements = aElements.concat(bElements);
  const normal = Object.entries(SPECIES).filter(([id, species]) => available(id) && !species.breedOnly);
  const candidates = normal.filter(([, species]) => speciesElements(species).some(id => parentElements.includes(id)));
  const pool = (candidates.length ? candidates : normal).map(([id]) => ({ id, weight: 1 }));
  // 속성 조합표: 두 부모의 속성 조합에 등록된 종족을 후보에 더한다(복합 속성 종족이 여기서 태어난다).
  aElements.forEach(x => bElements.forEach(y => {
    (BREEDING_RULES.elementPairs[pairKey(x, y)] || []).forEach(entry => {
      if (SPECIES[entry.speciesId] && available(entry.speciesId) && !pool.some(item => item.id === entry.speciesId)) pool.push({ id: entry.speciesId, weight: entry.weight || 1 });
    });
  }));
  if (parentA.speciesId === parentB.speciesId) pool.push({ id: parentA.speciesId, weight: CONFIG.sameSpeciesExtraWeight });
  return weightedPick(pool);
}

function startBreeding() {
  const idA = $('#parentA')?.value;
  const idB = $('#parentB')?.value;
  const a = game.pets.find(p => p.id === idA);
  const b = game.pets.find(p => p.id === idB);
  if (!a || !b) return toast('부모 펫을 선택해 주세요.');
  if (a.id === b.id) return toast('서로 다른 두 펫을 선택해 주세요.');
  if (a.energy < CONFIG.breedEnergyCost || b.energy < CONFIG.breedEnergyCost) return toast(`부모 펫의 에너지가 각각 ${CONFIG.breedEnergyCost} 이상이어야 해요.`);
  if (game.eggs.length >= CONFIG.maxEggs) return toast(`부화 대기 알은 최대 ${CONFIG.maxEggs}개까지 보관할 수 있어요.`);
  if (game.pets.length + game.eggs.length >= CONFIG.maxPets) return toast('펫 보관 한도가 가득 찼어요. 펫을 놓아준 뒤 다시 시도해 주세요.');
  a.energy -= CONFIG.breedEnergyCost; b.energy -= CONFIG.breedEnergyCost;
  const speciesId = pickChildSpecies(a, b);
  const inherited = [...a.traits, ...b.traits].filter((v, i, arr) => arr.indexOf(v) === i);
  const traits = [];
  if (inherited.length && Math.random() < CONFIG.inheritTraitChance) traits.push(randomItem(inherited));
  if (Math.random() < CONFIG.newTraitChance) {
    const fresh = Object.keys(TRAITS).filter(t => !traits.includes(t));
    if (fresh.length) traits.push(randomItem(fresh));
  }
  if (!traits.length) traits.push(randomItem(Object.keys(TRAITS)));
  const look = Math.random() < CONFIG.rareLookChance ? `특별 무늬 ${Math.floor(Math.random() * CONFIG.rareLookVariants) + 1}` : null;
  game.eggs.push({ id: uid('egg'), createdAt: Date.now(), remainingSeconds: CONFIG.eggHatchSeconds, result: { speciesId, traits, look, name: SPECIES[speciesId].name } });
  game.message = '새로운 알이 만들어졌어요. 부화할 때까지 기다려 주세요.';
  saveGame(); renderAll(); toast('알이 생성됐어요. 결과는 부화 후 공개됩니다!');
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]); }
function toast(message, duration = 2800) {
  const region = $('#toastRegion');
  const node = document.createElement('div');
  node.className = 'toast'; node.textContent = message; region.appendChild(node);
  setTimeout(() => node.remove(), duration);
}

// 그림 파일(선택 사항). 표에 image가 적힌 항목만 불러오고, 불러오기에 성공한 것만 쓴다.
// 장식 그림(게임 규칙과 무관). 없거나 불러오지 못하면 나무는 임시 도형으로 그리고 꽃·바위는 그리지 않는다.
const DECOR_IMAGES = {
  tree: 'assets/decor/tree.png', pine: 'assets/decor/pine.png', bush: 'assets/decor/bush.png',
  flowers: 'assets/decor/flowers.png', rock: 'assets/decor/rock.png', egg: 'assets/decor/egg.png'
};
const sprites = {};
function loadSprites() {
  const load = (key, path) => {
    if (!path || sprites[key]) return;
    const image = new Image();
    const sprite = sprites[key] = { image, ready: false, failed: false };
    image.onload = () => { sprite.ready = true; };
    image.onerror = () => { sprite.ready = false; sprite.failed = true; console.warn(`그림을 불러오지 못해 임시 그림으로 표시합니다: ${path}`); };
    image.src = path;
  };
  rareLookCache.clear();
  Object.entries(SPECIES).forEach(([id, species]) => load(`pet:${id}`, species.image));
  Object.entries(BUILDING_TYPES).forEach(([type, meta]) => load(`building:${type}`, meta.image));
  Object.entries(RESOURCES).forEach(([key, meta]) => load(`resource:${key}`, meta.image));
  Object.entries(DECOR_IMAGES).forEach(([name, path]) => load(`decor:${name}`, path));
}
function readySprite(key) { const sprite = sprites[key]; return sprite && sprite.ready ? sprite.image : null; }

/* 희귀 외형(특별 무늬 1~3)은 펫 그림 위에 무늬를 입힌 그림으로 그린다(1 줄무늬, 2 물방울, 3 반짝임).
 * 무늬는 펫 그림의 몸 안쪽에만 칠한다. 한 번 만든 그림은 종족·무늬별로 기억해 다시 쓴다.
 */
const rareLookCache = new Map();
function rareLookVariant(look) {
  const n = parseInt(String(look).replace(/\D+/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? ((n - 1) % 3) + 1 : 1;
}
function petSpriteFor(pet) {
  const base = readySprite(`pet:${pet.speciesId}`);
  if (!base || !pet.appearance) return base;
  const variant = rareLookVariant(pet.appearance);
  const key = `${pet.speciesId}:${variant}`;
  if (rareLookCache.has(key)) return rareLookCache.get(key);
  const w = base.naturalWidth || base.width, h = base.naturalHeight || base.height;
  const layer = document.createElement('canvas'); layer.width = w; layer.height = h;
  const g = layer.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(base, 0, 0, w, h);
  g.globalCompositeOperation = 'source-atop';
  if (variant === 1) {
    g.fillStyle = 'rgba(255,246,214,.45)';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if ((x + y) % 6 < 1) g.fillRect(x, y, 1, 1);
  } else if (variant === 2) {
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let y = 2; y < h; y += 5) for (let x = (y % 10 === 2 ? 2 : 4); x < w; x += 5) g.fillRect(x, y, 1, 1);
  } else {
    g.fillStyle = 'rgba(255,214,102,.22)'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,250,215,.95)';
    [[.2, .3], [.62, .22], [.42, .56], [.78, .62], [.26, .76], [.56, .84]].forEach(([fx, fy]) => { const x = Math.round(fx * w), y = Math.round(fy * h); g.fillRect(x, y - 1, 1, 3); g.fillRect(x - 1, y, 3, 1); });
  }
  rareLookCache.set(key, layer);
  return layer;
}

/* 풀밭과 길: 마을 크기의 1/4 캔버스에 점 단위로 칠한 뒤 4배로 키워 픽셀아트처럼 보이게 한다.
 * 바뀌지 않는 그림이므로 처음 한 번만 만들어 두고 재사용한다(같은 씨앗값이라 매번 같은 모양).
 */
const BACKGROUND_SCALE = 4;
let backgroundLayer = null;
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function buildBackground() {
  const cols = Math.round(canvas.width / BACKGROUND_SCALE), rows = Math.round(canvas.height / BACKGROUND_SCALE);
  const layer = document.createElement('canvas'); layer.width = cols; layer.height = rows;
  const g = layer.getContext('2d');
  // 길 모양: 예전과 같은 곡선을 작은 캔버스에 그려 "길인 칸" 목록을 만든다.
  g.strokeStyle = '#000'; g.lineWidth = 58 / BACKGROUND_SCALE; g.lineCap = 'round'; g.beginPath();
  g.moveTo(cols * .47, rows * .52); g.bezierCurveTo(cols * .38, rows * .58, cols * .39, rows * .76, cols * .24, rows * .83);
  g.moveTo(cols * .49, rows * .52); g.bezierCurveTo(cols * .62, rows * .53, cols * .68, rows * .64, cols * .81, rows * .7); g.stroke();
  const mask = g.getImageData(0, 0, cols, rows).data;
  const path = new Uint8Array(cols * rows);
  for (let i = 0; i < path.length; i++) path[i] = mask[i * 4 + 3] >= 128 ? 1 : 0;
  const onPath = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows && path[y * cols + x] === 1;
  // 풀밭: 왼쪽 위는 밝고 오른쪽 아래는 어둡게, 큰 얼룩과 작은 풀포기를 섞는다.
  const random = seededRandom(20261113);
  const grass = ['#2a7136', '#2e7a3b', '#32823f', '#368a43', '#3a9147', '#3f984b'].map(hexToRgb);
  const tuftDark = hexToRgb('#246530'), tuftLight = hexToRgb('#4fa857');
  const dirt = ['#c9a96b', '#d1b376', '#d8bd82'].map(hexToRgb), dirtEdge = hexToRgb('#8f7244'), pebble = hexToRgb('#b4945b');
  const cell = 10, gw = Math.ceil(cols / cell) + 2, gh = Math.ceil(rows / cell) + 2;
  const coarse = Array.from({ length: gw * gh }, () => random());
  const noise = (x, y) => {
    const gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
    const v = (i, j) => coarse[(y0 + j) * gw + (x0 + i)];
    return (v(0, 0) * (1 - fx) + v(1, 0) * fx) * (1 - fy) + (v(0, 1) * (1 - fx) + v(1, 1) * fx) * fy;
  };
  const image = g.createImageData(cols, rows);
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    let color;
    if (onPath(x, y)) {
      const edge = !onPath(x - 1, y) || !onPath(x + 1, y) || !onPath(x, y - 1) || !onPath(x, y + 1);
      const r = random();
      color = edge ? dirtEdge : r < .04 ? pebble : dirt[Math.min(2, Math.floor((noise(cols - 1 - x, rows - 1 - y) * .7 + r * .3) * 3))];
    } else {
      const light = 1 - (x / cols + y / rows) / 2;
      const v = light * .35 + noise(x, y) * .65 + (random() - .5) * .05;
      color = grass[Math.max(0, Math.min(grass.length - 1, Math.floor(v * grass.length)))];
      const r = random();
      if (r < .008) color = tuftDark; else if (r < .013) color = tuftLight;
    }
    const i = (y * cols + x) * 4;
    image.data[i] = color[0]; image.data[i + 1] = color[1]; image.data[i + 2] = color[2]; image.data[i + 3] = 255;
  }
  g.putImageData(image, 0, 0);
  return { canvas: layer, path, cols, rows };
}
function isOnPathPixel(px, py) {
  if (!backgroundLayer) return false;
  const x = Math.floor(px / BACKGROUND_SCALE), y = Math.floor(py / BACKGROUND_SCALE);
  return x >= 0 && y >= 0 && x < backgroundLayer.cols && y < backgroundLayer.rows && backgroundLayer.path[y * backgroundLayer.cols + x] === 1;
}

/* 장식(나무·덤불·꽃·바위) 자리. 정해진 후보 자리 중에서 길, 광장 주변, 지어진 시설, 화면 왼쪽 아래 안내판과 겹치는 곳은 건너뛴다.
 * 시설을 새로 지으면 그 자리의 장식은 사라진다(나무를 베고 지은 것처럼).
 */
const DECOR_KINDS = ['tree', 'pine', 'bush', 'tree', 'flowers', 'pine', 'rock', 'tree', 'bush', 'flowers'];
const DECOR_SIZES = { tree: 64, pine: 64, bush: 44, flowers: 36, rock: 36 }; // 화면 크기(그림 크기의 2배)
function decorPlacements() {
  const w = canvas.width, h = canvas.height, list = [];
  for (let i = 0; i < 30; i++) {
    const x = ((i * 211) % (w - 80)) + 40, y = ((i * 127 + 30) % (h - 90)) + 52;
    const kind = DECOR_KINDS[i % DECOR_KINDS.length], size = DECOR_SIZES[kind];
    if (Math.abs(x - w * .5) < 110 && Math.abs(y - h * .5) < 90) continue;
    if (x < 200 && y > h - 80) continue;
    if ([[-size / 3, 0], [0, 0], [size / 3, 0], [0, -size / 3]].some(([dx, dy]) => isOnPathPixel(x + dx, y + dy))) continue;
    if (game.buildings.some(b => Math.abs(b.x * w - x) < 64 + size / 3 && y > b.y * h - 80 && y < b.y * h + 60)) continue;
    if (list.some(d => Math.abs(d.x - x) < (d.size + size) / 2.2 && Math.abs(d.y - y) < 26)) continue;
    list.push({ kind, x, y, size });
  }
  return list;
}
function drawDecor(item) {
  const image = readySprite(`decor:${item.kind}`);
  ctx.fillStyle = 'rgba(10,36,16,.3)'; ctx.beginPath(); ctx.ellipse(item.x, item.y - 2, item.size * .34, item.size * .12, 0, 0, Math.PI * 2); ctx.fill();
  if (image) {
    const w = image.naturalWidth * 2, h = image.naturalHeight * 2;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, Math.round(item.x - w / 2), Math.round(item.y - h), w, h);
    ctx.restore();
  } else if (item.kind === 'tree' || item.kind === 'pine' || item.kind === 'bush') {
    drawTree(item.x, item.y - 22, item.size / 70);
  }
}

// Canvas rendering: 게임 규칙과 분리된 그리기 코드. 화면 아래쪽(앞쪽)에 있는 것일수록 나중에 그려 앞에 보이게 한다.
function drawVillage() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  if (!backgroundLayer) backgroundLayer = buildBackground();
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(backgroundLayer.canvas, 0, 0, w, h); ctx.restore();
  const items = [];
  decorPlacements().forEach(item => items.push({ y: item.y, draw: () => drawDecor(item) }));
  game.buildings.forEach(building => items.push({ y: building.y * h + 28, draw: () => drawBuilding(building) }));
  // 알은 교배장 옆에 놓는다.
  const nursery = getBuilding('nursery');
  const eggX = nursery ? nursery.x * w + 66 : w * .52, eggY = nursery ? nursery.y * h - 6 : h * .78;
  game.eggs.forEach((egg, index) => { const ex = eggX + (index % 2) * 22, ey = eggY + Math.floor(index / 2) * 22; items.push({ y: ey + 9, draw: () => drawEgg(ex, ey) }); });
  game.pets.forEach(pet => items.push({ y: pet.y * h + 16, draw: () => drawPet(pet) }));
  items.sort((a, b) => a.y - b.y).forEach(item => item.draw());
  // 시설 이름표는 맨 마지막에 그려 펫이나 나무에 가리지 않게 한다.
  game.buildings.forEach(drawBuildingLabel);
}
function drawTree(x, y, scale) {
  ctx.fillStyle = 'rgba(34,74,43,.22)'; ctx.beginPath(); ctx.ellipse(x+5,y+12,22*scale,10*scale,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#765b3d'; ctx.fillRect(x-4*scale,y-1*scale,8*scale,22*scale);
  ctx.fillStyle = '#3f8050'; ctx.beginPath(); ctx.arc(x,y-9*scale,20*scale,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#70a96a'; ctx.beginPath(); ctx.arc(x-7*scale,y-16*scale,12*scale,0,Math.PI*2); ctx.fill();
}
// 오래된 브라우저에는 ctx.roundRect가 없어 화면 전체가 멈출 수 있으므로 사각형으로 대체한다.
function roundedRectPath(x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
}
function drawBuilding(building) {
  const x = building.x * canvas.width, y = building.y * canvas.height;
  const info = BUILDING_TYPES[building.type];
  ctx.fillStyle = 'rgba(34,60,38,.25)'; ctx.beginPath(); ctx.ellipse(x,y+24,55,16,0,0,Math.PI*2); ctx.fill();
  const buildingImage = readySprite(`building:${building.type}`);
  if (buildingImage) {
    // 픽셀아트가 흐려지지 않도록 정수 좌표에, 부드럽게 보정하지 않고 그린다.
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(buildingImage, Math.round(x)-60, Math.round(y)-72, 120, 100);ctx.restore();
  } else if (building.type === 'farm') {
    ctx.fillStyle = '#805e3e'; ctx.fillRect(x-42,y-18,84,43);
    for(let i=0;i<4;i++){ctx.strokeStyle='#b38c59';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x-34+i*22,y-14);ctx.lineTo(x-34+i*22,y+21);ctx.stroke();}
    ctx.fillStyle='#6eaa5b'; for(let i=0;i<12;i++){ctx.beginPath();ctx.arc(x-31+(i%4)*21,y-7+Math.floor(i/4)*13,4,0,Math.PI*2);ctx.fill();}
  } else {
    ctx.fillStyle = building.type === 'nursery' ? '#c99b69' : building.type === 'plaza' ? '#cbb98b' : '#9f805c';
    roundedRectPath(x-43,y-22,86,47,8); ctx.fill();
    ctx.fillStyle = building.type === 'nursery' ? '#9b6d50' : '#76543b'; ctx.beginPath(); ctx.moveTo(x-51,y-19);ctx.lineTo(x,y-53);ctx.lineTo(x+51,y-19);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f1dfb5';ctx.fillRect(x-8,y-5,16,30);
    if(building.type==='plaza'){ctx.fillStyle='#e8d4a7';ctx.beginPath();ctx.arc(x,y-30,8,0,Math.PI*2);ctx.fill();}
  }
  if(!buildingImage){ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(info.icon,x,y-58);}
  if(ui.selectedBuildingId===building.id){ctx.strokeStyle='#fff4a9';ctx.lineWidth=2;ctx.setLineDash([6,5]);ctx.beginPath();ctx.ellipse(x,y-6,64,58,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
}
// 시설 이름표: 어두운 바탕 위에 이름과 작업 펫 수를 쓴다.
function drawBuildingLabel(building) {
  const x = Math.round(building.x * canvas.width), y = Math.round(building.y * canvas.height) + 41;
  const info = BUILDING_TYPES[building.type];
  const count = info.capacity ? `${assignedCount(building.id)}/${info.capacity}` : '';
  ctx.save(); ctx.textBaseline = 'middle';
  ctx.font = 'bold 11px sans-serif'; const nameWidth = ctx.measureText(info.name).width;
  ctx.font = '10px sans-serif'; const countWidth = count ? ctx.measureText(count).width + 6 : 0;
  const width = nameWidth + countWidth + 14, left = x - width / 2;
  ctx.fillStyle = 'rgba(22,38,27,.78)'; roundedRectPath(left, y - 9, width, 18, 9); ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#f3f7e8'; ctx.fillText(info.name, left + 7, y + .5);
  if (count) { ctx.font = '10px sans-serif'; ctx.fillStyle = '#c9dfb4'; ctx.fillText(count, left + 7 + nameWidth + 6, y + .5); }
  ctx.restore();
}
/* 펫의 자세(화면 연출만). offsetY: 위아래 움직임(음수면 위), tilt: 기울기, squash: 납작해지는 정도.
 * 쓰다듬기·놀아주기: 폴짝폴짝 / 걷기: 통통 튀며 좌우로 살짝 기우뚱 / 휴식: 숨 쉬듯 / 그 밖: 제자리에서 살랑살랑
 */
function petPose(pet) {
  const effect = activePetEffect(pet.id);
  if (effect) {
    const t = (performance.now() - effect.startedAt) / 1000;
    return { offsetY: -Math.abs(Math.sin(t * (effect.type === 'play' ? 11 : 8))) * (effect.type === 'play' ? 7 : 5), tilt: 0, squash: 0 };
  }
  if (isResting(pet)) return { offsetY: 0, tilt: 0, squash: Math.sin(pet.bob * .6) * .035 };
  if (pet.moving) {
    const step = pet.bob * 2;
    return { offsetY: -Math.abs(Math.sin(step)) * 3, tilt: Math.sin(step) * .07, squash: (1 - Math.abs(Math.sin(step))) * .06 };
  }
  return { offsetY: Math.sin(pet.bob) * 2, tilt: 0, squash: 0 };
}
function drawPet(pet) {
  const x=pet.x*canvas.width, y=pet.y*canvas.height;
  const species=SPECIES[pet.speciesId];
  const resting=isResting(pet);
  const effect=activePetEffect(pet.id);
  const pose=petPose(pet);
  const bob=pose.offsetY;
  ctx.fillStyle='rgba(10,30,14,.35)';ctx.beginPath();ctx.ellipse(x,y+14,20-Math.min(3,-bob*.4),7,0,0,Math.PI*2);ctx.fill();
  const petImage=petSpriteFor(pet);
  if(petImage){
    // 그림 파일이 있으면 그것으로 그린다(왼쪽으로 갈 때는 좌우를 뒤집는다). 발밑을 기준으로 기울이고 납작하게 만든다.
    // 픽셀아트가 흐려지지 않도록 정수 좌표에, 부드럽게 보정하지 않고 그린다.
    // 그림 크기의 2배로 그린다(32칸 그림 → 화면 64칸).
    const w=(petImage.naturalWidth||petImage.width)*2,h=(petImage.naturalHeight||petImage.height)*2;
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(Math.round(x),Math.round(y+18+bob));ctx.rotate(pose.tilt);
    ctx.scale((pet.direction<0?-1:1)*(1+pose.squash),1-pose.squash);ctx.drawImage(petImage,-w/2,-h,w,h);ctx.restore();
  } else {
    ctx.fillStyle=species.color;ctx.beginPath();ctx.ellipse(x,y+bob,15,13,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#53664a';ctx.lineWidth=1.5;ctx.stroke();
    ctx.fillStyle=species.color;
    ctx.beginPath();ctx.arc(x-8,y-10+bob,6,0,Math.PI*2);ctx.arc(x+8,y-10+bob,6,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#263729';
    if(resting){ctx.fillRect(x-7,y-1,4,1.5);ctx.fillRect(x+3,y-1,4,1.5);} // 감은 눈
    else{ctx.beginPath();ctx.arc(x-5,y-1+bob,1.8,0,Math.PI*2);ctx.arc(x+5,y-1+bob,1.8,0,Math.PI*2);ctx.fill();}
    ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText(species.icon,x,y-23+bob);
  }
  ctx.textAlign='center';
  if(isWorking(pet)){ctx.fillStyle='#f0cf75';ctx.beginPath();ctx.arc(x+20,y-24,4,0,Math.PI*2);ctx.fill();}
  if(resting){ctx.font='12px sans-serif';ctx.fillText('💤',x+22,y-24+Math.sin(pet.bob*.5)*2);}
  if(pet.appearance){ctx.font='12px sans-serif';ctx.fillStyle='#fff1a5';ctx.fillText('✦',x-22,y-28+bob);}
  if(selectedPetId===pet.id){ctx.strokeStyle='#fff4a9';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y-6,28,28,0,0,Math.PI*2);ctx.stroke();}
  if(effect){
    // 머리 위로 떠오르며 사라지는 하트(쓰다듬기) 또는 음표(놀아주기)
    const progress=clamp((performance.now()-effect.startedAt)/(effect.until-effect.startedAt),0,1);
    const mark=effect.type==='play'?'🎵':'💗';
    ctx.save();ctx.font='14px sans-serif';ctx.textAlign='center';
    for(let i=0;i<3;i++){
      const p=(progress*(effect.type==='play'?3:1.5)+i/3)%1;
      ctx.globalAlpha=1-p;
      ctx.fillText(mark,x+(i-1)*13+Math.sin((p+i)*6)*3,y-46-p*24);
    }
    ctx.restore();
  }
}
function drawEgg(x,y){
  ctx.fillStyle='rgba(44,39,56,.24)';ctx.beginPath();ctx.ellipse(x,y+9,9,4,0,0,Math.PI*2);ctx.fill();
  const image=readySprite('decor:egg');
  if(image){ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(image,Math.round(x)-12,Math.round(y)-14,24,24);ctx.restore();return;}
  ctx.fillStyle='#f8e7c9';ctx.beginPath();ctx.ellipse(x,y,7,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c49b82';ctx.lineWidth=1.5;ctx.stroke();
}
function movePets(delta) {
  const seconds=Math.min(delta/1000,.08);
  game.pets.forEach((pet,index)=>{
    pet.bob += seconds*5;
    const effect=activePetEffect(pet.id);
    const workingBuilding=isWorking(pet) ? getWorkBuilding(pet) : null;
    if(workingBuilding){
      // 작업 중: 작업장 옆으로 이동해 머문다(첫 번째 펫은 오른쪽, 두 번째 펫은 왼쪽). 시설 이름표를 가리지 않도록 옆에 선다.
      const slot=game.pets.filter(p=>p.workBuildingId===workingBuilding.id).indexOf(pet);
      const side=slot%2===0?1:-1;
      pet.targetX=clamp(workingBuilding.x+side*(.075+Math.floor(slot/2)*.04),.06,.94);pet.targetY=clamp(workingBuilding.y+.045,.08,.9);
      pet.idleTimer=null;
    } else if(isResting(pet)){
      // 휴식 중: 제자리에서 쉰다.
      pet.targetX=pet.x;pet.targetY=pet.y;pet.idleTimer=null;
    } else if(effect&&effect.type==='stroke'){
      // 쓰다듬는 동안: 제자리에서 기뻐한다.
      pet.targetX=pet.x;pet.targetY=pet.y;pet.idleTimer=null;
    } else if(effect&&effect.type==='play'){
      // 놀아주는 동안: 쉬지 않고 이리저리 뛰어다닌다.
      pet.idleTimer=null;
      if(Math.hypot(pet.targetX-pet.x,pet.targetY-pet.y)<.025){pet.targetX=.12+Math.random()*.76;pet.targetY=.15+Math.random()*.7;}
    } else if(Math.hypot(pet.targetX-pet.x,pet.targetY-pet.y)<.025){
      // 자유 생활: 목적지에 도착하면 잠깐 머문 뒤 새 목적지를 정한다. 활발한 펫은 덜 머문다.
      if(pet.idleTimer==null){
        const idle=CONFIG.idleSecondsMin+Math.random()*(CONFIG.idleSecondsMax-CONFIG.idleSecondsMin);
        pet.idleTimer=idle*(traitHas(pet,'lively') ? CONFIG.livelyIdleMultiplier : 1);
      }
      pet.idleTimer-=seconds;
      if(pet.idleTimer<=0){pet.idleTimer=null;pet.targetX=.12+Math.random()*.76;pet.targetY=.15+Math.random()*.7;}
    }
    const dx=pet.targetX-pet.x,dy=pet.targetY-pet.y,dist=Math.hypot(dx,dy);
    pet.moving=dist>.005;
    const playing=Boolean(effect&&effect.type==='play'&&!workingBuilding);
    if(pet.moving){const speed=CONFIG.baseMoveSpeed*(traitHas(pet,'nimble') ? CONFIG.nimbleSpeedMultiplier : 1)*(playing ? CONFIG.playSpeedMultiplier : 1)*seconds;pet.x+=dx/dist*Math.min(dist,speed);pet.y+=dy/dist*Math.min(dist,speed);pet.direction=dx>=0?1:-1;}
  });
}
function animationLoop(timestamp) {
  if(!lastFrame) lastFrame=timestamp;
  const delta=timestamp-lastFrame;lastFrame=timestamp;
  movePets(delta);drawVillage();
  animationHandle=requestAnimationFrame(animationLoop);
}

function handleCanvasClick(event) {
  const rect=canvas.getBoundingClientRect();
  const scale=canvas.width/rect.width;
  const x=(event.clientX-rect.left)*scale;
  const y=(event.clientY-rect.top)/rect.height*canvas.height;
  // 화면이 작아 캔버스가 축소돼도 손가락으로 누를 수 있도록 판정 범위를 화면 기준 최소 24px로 유지한다.
  const hitRadius=Math.max(30,24*scale);
  let nearest=null,nearestDist=Infinity;
  game.pets.forEach(p=>{const d=Math.hypot(p.x*canvas.width-x,p.y*canvas.height-y);if(d<hitRadius&&d<nearestDist){nearest=p;nearestDist=d;}});
  if(nearest){selectPet(nearest.id);activeTab='pets';renderAll();return;}
  // 펫이 없는 곳을 눌렀으면 시설을 눌렀는지 본다(시설 그림의 대략적인 범위).
  const hit=game.buildings.find(b=>Math.abs(b.x*canvas.width-x)<58&&y>b.y*canvas.height-64&&y<b.y*canvas.height+48);
  if(hit){ui.selectedBuildingId=hit.id;activeTab='village';renderAll();}
}

// 1초마다, 그리고 탭으로 돌아올 때 호출된다.
function tick() {
  applyOfflineProgress();
  refreshLive();
  if(Date.now()-game.lastSavedAt>CONFIG.autosaveIntervalMs)saveGame();
}

function bindGlobalEvents() {
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{activeTab=tab.dataset.tab;renderAll();}));
  canvas.addEventListener('click',handleCanvasClick);
  $('#helpButton').addEventListener('click',()=>$('#helpDialog').showModal());
  $('#closeHelp').addEventListener('click',()=>$('#helpDialog').close());
  $('#resetButton').addEventListener('click',()=>{
    if(confirm('현재 마을 저장 데이터를 삭제하고 처음부터 시작할까요?')){
      localStorage.removeItem(CONFIG.saveKey);game=createInitialGame();
      ui.parentA=null;ui.parentB=null;ui.pendingWork=null;ui.pendingName=null;ui.selectedBuildingId=null;petEffects.clear();awaySnapshot=null;
      selectedPetId=game.pets[0].id;saveGame();renderAll();toast('새로운 마을을 시작합니다.');
    }
  });
  // 브라우저 종료·탭 전환·모바일 백그라운드 전환 어느 경우에도 저장되도록 여러 시점에 저장한다.
  window.addEventListener('beforeunload',()=>saveGame());
  window.addEventListener('pagehide',()=>saveGame());
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      applyOfflineProgress();
      awaySnapshot=takeAwaySnapshot(Date.now());
      saveGame();
    } else {
      tick();
      reportAway(awaySnapshot);awaySnapshot=null;
      saveGame();
    }
  });
}

function startGame() {
  loadSprites();
  game=loadGame();
  grantPendingRegionGifts(); // 이미 개방한 지역의 선물을 아직 못 받은 저장이면 지금 지급한다.
  if(!game.pets.some(p=>p.id===selectedPetId))selectedPetId=game.pets[0]?.id||null;
  renderAll();
  // 게임을 꺼 둔 동안 흐른 시간을 한 번만 반영하고, 반영 직후 저장해 다음 실행 때 다시 계산되지 않게 한다.
  const startSnapshot=takeAwaySnapshot(Math.min(game.lastTickAt,Date.now()));
  applyOfflineProgress();
  reportAway(startSnapshot);
  saveGame();
  renderAll();
  bindGlobalEvents();
  setInterval(tick,1000);
  animationHandle=requestAnimationFrame(animationLoop);
  $('#clockLabel').textContent=`접속 ${new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`;
}

startGame();
