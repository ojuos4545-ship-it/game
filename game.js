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
  villageLevelThresholds: [0, 8, 13, 18],

  // 화면 연출
  baseMoveSpeed: 0.11,
  idleSecondsMin: 1.5,
  idleSecondsMax: 5,

  // 격자 배치는 아직 구현 전이다(기획상 예정). 현재 코드에서는 사용하지 않는다.
  gridCols: 12,
  gridRows: 8
};

const RESOURCES = {
  wood: { label: '목재', icon: '🪵' },
  stone: { label: '돌', icon: '🪨' },
  plant: { label: '식물', icon: '🌿' },
  ore: { label: '광석', icon: '⛏️' }
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

const SPECIES = {
  sproutbun: { name: '새싹토끼', icon: '🐰', element: 'grass', color: '#c9d99a', rarity: 'common', description: '새싹을 좋아하는 온순한 초원 펫.' },
  pebblelamb: { name: '몽돌양', icon: '🐑', element: 'earth', color: '#d9c7a5', rarity: 'common', description: '튼튼한 발굽으로 땅을 다지는 펫.' },
  dewotter: { name: '이슬수달', icon: '🦦', element: 'water', color: '#8cc6d8', rarity: 'common', description: '맑은 물가를 찾아다니는 호기심 많은 펫.' },
  breezefox: { name: '산들여우', icon: '🦊', element: 'wind', color: '#e8b58a', rarity: 'rare', description: '바람처럼 빠르게 숲을 누비는 펫.' },
  embergecko: { name: '불씨도마뱀', icon: '🦎', element: 'fire', color: '#df916e', rarity: 'rare', description: '따뜻한 바위에서 쉬기를 좋아한다.' },
  sparkchick: { name: '번개병아리', icon: '🐥', element: 'electric', color: '#e7d779', rarity: 'rare', description: '작은 몸에 반짝이는 에너지를 품고 있다.' }
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
  plaza: { name: '중앙 광장', icon: '🏡', cost: {}, output: null, capacity: 0, affinityElements: [], description: '마을의 중심 공간' },
  nursery: { name: '교배장', icon: '🥚', cost: {}, output: null, capacity: 0, affinityElements: [], description: '두 펫의 만남과 알 부화' },
  farm: { name: '농장', icon: '🌱', cost: { wood: 8, stone: 3 }, output: 'plant', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['grass', 'water'], description: '식물 자원을 생산' },
  // 벌목장 목재 비용은 6이다. 목재는 벌목장에서만 생산되므로, 시작 자원(목재 30)으로
  // 어떤 순서로 지어도 네 시설을 모두 지을 수 있게 맞춘 값이다(12였을 때는 영영 못 짓는 경우가 있었다).
  lumber: { name: '벌목장', icon: '🪵', cost: { wood: 6, stone: 5 }, output: 'wood', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['earth', 'wind'], description: '목재 자원을 생산' },
  quarry: { name: '채굴장', icon: '⛏️', cost: { wood: 10, stone: 8 }, output: 'stone', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['earth'], description: '돌과 광석을 생산' },
  smelter: { name: '제련소', icon: '🔥', cost: { wood: 14, stone: 10, ore: 4 }, output: 'ore', capacity: CONFIG.maxWorkersPerBuilding, affinityElements: ['fire', 'electric'], description: '광석을 모으고 정제' }
};

/* 교배 조합표.
 * 키는 두 ID를 가나다(알파벳) 순으로 정렬해 '+'로 이은 문자열이다. 예: 'fire+water'
 * 값은 [{ speciesId, weight }] 후보 목록이다.
 * - speciesPairs: 특정 부모 "종족" 조합 전용 결과 (가장 먼저 확인)
 * - elementPairs: 부모 "속성" 조합 결과
 * 표에 없는 조합은 기본 규칙(부모와 같은 속성을 가진 종족 중 하나)으로 처리한다.
 * 새 종족을 SPECIES에 추가한 뒤 여기에 한 줄만 넣으면 전용 조합이 된다.
 */
const BREEDING_RULES = {
  speciesPairs: {
    // 예시: 'embergecko+sparkchick': [{ speciesId: 'plasmadrake', weight: 1 }]
  },
  elementPairs: {
    // 예시: 'fire+water': [{ speciesId: 'steamtoad', weight: 3 }, { speciesId: 'embergecko', weight: 1 }]
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
const ui = { parentA: null, parentB: null, pendingWork: null };

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
    discoveredSpecies: ['sproutbun', 'pebblelamb'], discoveredLooks: [],
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
    ...b, id: b.id || uid('building'), level: Math.max(1, Math.floor(Number(b.level)) || 1),
    x: finite(b.x, .5), y: finite(b.y, .5)
  }));
  const workplaceIds = new Set(saved.buildings.filter(b => BUILDING_TYPES[b.type].output).map(b => b.id));

  saved.pets = saved.pets.filter(p => p && SPECIES[p.speciesId]).map(p => {
    const traits = Array.isArray(p.traits) ? p.traits.filter((t, i, arr) => TRAITS[t] && arr.indexOf(t) === i) : [];
    const maxEnergy = Number(p.maxEnergy) > 0 ? Number(p.maxEnergy) : baseMaxEnergy(traits);
    const workBuildingId = workplaceIds.has(p.workBuildingId) ? p.workBuildingId : null;
    return {
      ...p, id: p.id || uid('pet'), traits, maxEnergy,
      name: typeof p.name === 'string' && p.name ? p.name : SPECIES[p.speciesId].name,
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
    result: { ...egg.result, traits: Array.isArray(egg.result.traits) ? egg.result.traits.filter(t => TRAITS[t]) : [] }
  }));

  // 펫도 알도 없으면 더 이상 진행할 방법이 없으므로 새 마을로 시작한다.
  if (saved.pets.length === 0 && saved.eggs.length === 0) return createInitialGame();

  const discovered = Array.isArray(saved.discoveredSpecies) ? saved.discoveredSpecies : [];
  saved.pets.forEach(p => discovered.push(p.speciesId)); // 보유 중인 종족은 항상 도감에 있어야 한다.
  saved.discoveredSpecies = discovered.filter((id, i, arr) => SPECIES[id] && arr.indexOf(id) === i);
  saved.discoveredLooks = Array.isArray(saved.discoveredLooks) ? saved.discoveredLooks.filter(look => typeof look === 'string') : [];
  saved.totalDiscoveries = saved.discoveredSpecies.length;
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
function getWorkBuilding(pet) {
  const building = pet.workBuildingId ? getBuildingById(pet.workBuildingId) : null;
  return building && BUILDING_TYPES[building.type].output ? building : null;
}
function hasAffinity(pet, buildingType) { return BUILDING_TYPES[buildingType].affinityElements.includes(SPECIES[pet.speciesId].element); }
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
          pet.oreProgress = (pet.oreProgress || 0) + CONFIG.quarryOrePerProduction;
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
    game.message = `새로운 종족 ${speciesName}을(를) 발견했어요!`;
    toast(`새 종족 발견: ${speciesName}!`);
  } else {
    game.message = `${pet.name}이(가) 마을에 합류했어요.`;
    toast(`${speciesName}이(가) 부화했어요.`);
  }
  if (baby.look && !game.discoveredLooks.includes(baby.look)) game.discoveredLooks.push(baby.look);
  return true;
}

function updateVillageLevel() {
  const thresholds = CONFIG.villageLevelThresholds;
  const score = game.buildings.length + game.discoveredSpecies.length * 2;
  let level = 1;
  thresholds.forEach((threshold, index) => { if (score >= threshold) level = index + 1; });
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
    <div class="resource-chip"><span class="ico">${value.icon}</span><div><small>${value.label}</small><strong>${Math.floor(game.resources[key])}</strong></div></div>
  `).join('');
}

function petStateLabel(pet) {
  if (isWorking(pet)) return '작업 중';
  if (isResting(pet)) return '휴식 중';
  return '자유 생활';
}
function energyPercent(pet) { return Math.round((pet.energy / pet.maxEnergy) * 100); }
function energyText(pet) { return `${Math.round(pet.energy)}/${pet.maxEnergy} 에너지`; }
function elementLabel(species) { const element = ELEMENTS[species.element]; return `${element.icon} ${element.label}`; }
function traitNames(pet) { return pet.traits.map(t => TRAITS[t].name).join(' / ') || '특성 없음'; }
function parentOptionLabel(pet) { return `${pet.name} · ${traitNames(pet)} · 에너지 ${Math.round(pet.energy)}`; }

function renderPetCard(pet) {
  const species = SPECIES[pet.speciesId];
  const selected = selectedPetId === pet.id ? 'selected' : '';
  return `<button class="pet-card ${selected}" data-pet-id="${pet.id}">
    <span class="pet-avatar">${species.icon}</span><span class="pet-main"><span class="pet-name">${escapeHtml(pet.name)}${pet.appearance ? ' ✦' : ''}</span><span class="pet-detail">${ELEMENTS[species.element].label} · ${traitNames(pet)}</span><span class="energy-track"><i data-live-energy="${pet.id}" style="width:${energyPercent(pet)}%"></i></span></span><span class="pet-state" data-live-state="${pet.id}">${petStateLabel(pet)}</span>
  </button>`;
}

function renderVillageTab() {
  const buildings = game.buildings.map(building => {
    const meta = BUILDING_TYPES[building.type];
    const workers = assignedCount(building.id);
    return `<div class="build-card"><div class="build-icon">${meta.icon}</div><strong>${meta.name}</strong><small>${meta.description}<br>${meta.capacity ? `작업 펫 ${workers}/${meta.capacity}마리` : '마을 주요 시설'}</small><div class="build-cost">Lv.${building.level}</div>${meta.capacity ? `<button class="btn secondary" data-focus-building="${building.id}">배치 관리</button>` : '<button class="btn secondary" disabled>기본 시설</button>'}</div>`;
  }).join('');
  const available = Object.entries(BUILDING_TYPES).filter(([type, meta]) => meta.output && !getBuilding(type));
  const buildCards = available.map(([type, meta]) => `<div class="build-card"><div class="build-icon">${meta.icon}</div><strong>${meta.name}</strong><small>${meta.description}</small><div class="build-cost">${Object.entries(meta.cost).map(([k,v]) => `${RESOURCES[k].icon} ${v}`).join(' · ')}</div><button class="btn ${canAfford(meta.cost) ? 'primary' : 'secondary'}" data-build="${type}" ${canAfford(meta.cost) ? '' : 'disabled'}>건설하기</button></div>`).join('');
  return `<h2 class="section-title">마을 관리</h2><p class="section-description">작업장을 세우고 펫을 배치해 마을의 기반을 넓혀보세요.</p>
    <div class="subheading"><span>건설된 시설</span><span class="count-pill">${game.buildings.length}개</span></div><div class="build-grid">${buildings}</div>
    <div class="subheading"><span>새 시설 건설</span><span class="count-pill">자원 사용</span></div><div class="build-grid">${buildCards || '<div class="empty-state">모든 기본 생산 시설을 건설했어요.</div>'}</div>
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
  const goodAt = Object.values(BUILDING_TYPES).filter(meta => meta.affinityElements.includes(species.element)).map(meta => meta.name).join(', ') || '없음';
  const canRelease = game.pets.length > CONFIG.minPets;
  return `<div class="subheading"><span>선택한 펫 관리</span><span class="count-pill" data-live-energy-text="${pet.id}">${energyText(pet)}</span></div>
    <div class="pet-profile"><div class="pet-profile-head"><span class="pet-avatar">${species.icon}</span><div><strong>${escapeHtml(pet.name)}</strong><small>${elementLabel(species)} · ${RARITIES[species.rarity].label} · <span data-live-state="${pet.id}">${petStateLabel(pet)}</span></small></div></div>
      <div class="pet-profile-row">${traitChips}</div>
      <div class="pet-profile-row"><small>잘하는 일: ${goodAt}${pet.appearance ? ` · 희귀 외형: ${escapeHtml(pet.appearance)} ✦` : ''}</small></div></div>
    <label class="field-label" for="workSelect">작업장 배치</label><select class="select" id="workSelect"><option value="">자유 생활</option>${buildings.map(b => `<option value="${b.id}" ${chosen === b.id ? 'selected' : ''}>${BUILDING_TYPES[b.type].name} (${assignedCount(b.id)}/${BUILDING_TYPES[b.type].capacity})${hasAffinity(pet, b.type) ? ' · 적성 ★' : ''}</option>`).join('')}</select>
    <div class="button-row"><button class="btn primary" id="assignButton">배치 적용</button><button class="btn secondary" id="feedButton">먹이 주기 🌿${CONFIG.feedPlantCost}</button><button class="btn danger" id="releaseButton" ${canRelease ? '' : `disabled title="펫은 최소 ${CONFIG.minPets}마리가 필요해요."`}>놓아주기</button></div>`;
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
    : `<label class="field-label" for="parentA">첫 번째 부모</label><select class="select" id="parentA">${options(ui.parentA)}</select><label class="field-label" for="parentB">두 번째 부모</label><select class="select" id="parentB">${options(ui.parentB)}</select><div class="info-box" style="margin-top:10px">${full ? `펫과 알의 합이 보관 한도(${CONFIG.maxPets})에 도달했어요. 펫 메뉴에서 펫을 놓아주면 다시 교배할 수 있어요.` : '부모 속성 조합을 바탕으로 자식 후보가 결정됩니다. 희귀 종족과 복합 속성은 추후 확장할 수 있도록 구조를 분리했습니다.'}</div><button class="btn primary full" id="breedButton" style="margin-top:12px">교배 시작하기</button>`;
  return `<h2 class="section-title">교배장</h2><p class="section-description">두 펫의 속성과 특성이 다음 세대에 이어질 수 있어요. 성별 제한은 없습니다.</p>
    ${game.eggs.length ? `<div class="subheading"><span>부화 대기 중인 알</span><span class="count-pill">${game.eggs.length}/${CONFIG.maxEggs}개</span></div>${game.eggs.map(egg => `<div class="egg-card"><span class="egg-icon">🥚</span><span class="egg-info"><strong>정체를 알 수 없는 알</strong><small>부화 결과는 아직 공개되지 않아요.</small></span><span class="egg-time" data-egg-time="${egg.id}">${eggTime(egg)}</span></div>`).join('')}` : '<div class="empty-state">아직 부화 대기 중인 알이 없어요.</div>'}
    <div class="subheading"><span>새로운 알 만들기</span><span class="count-pill">부모 각각 에너지 ${CONFIG.breedEnergyCost} 소모</span></div>
    ${breedForm}
    <div class="subheading"><span>교배 규칙</span></div><div class="info-box">• 알이 만들어지는 시점에 결과 데이터가 결정됩니다.<br>• 부화 전까지 종족·외형·특성은 공개되지 않습니다.<br>• 부모 특성 일부가 계승되거나 새로운 특성이 생길 수 있습니다.</div>`;
}

function renderDexTab() {
  const cards = Object.entries(SPECIES).map(([id, species]) => {
    const found = game.discoveredSpecies.includes(id);
    return `<div class="dex-card ${found ? '' : 'locked'}"><div class="dex-icon">${found ? species.icon : '❔'}</div><strong>${found ? species.name : '미발견 종족'}</strong><small>${found ? `${ELEMENTS[species.element].label} · ${RARITIES[species.rarity].label}` : '발견 조건 미확인'}</small></div>`;
  }).join('');
  return `<h2 class="section-title">종족 도감</h2><p class="section-description">처음 발견한 종족은 자동으로 기록됩니다.</p><div class="stat-grid"><div class="stat"><span>발견 종족</span><strong>${game.discoveredSpecies.length} / ${Object.keys(SPECIES).length}</strong></div><div class="stat"><span>발견한 희귀 외형</span><strong>${game.discoveredLooks.length}종</strong></div></div><div class="dex-grid">${cards}</div><div class="subheading"><span>발견한 종족 정보</span></div>${game.discoveredSpecies.map(id => `<div class="info-box" style="margin-bottom:7px"><b>${SPECIES[id].icon} ${SPECIES[id].name}</b> · ${ELEMENTS[SPECIES[id].element].label} 속성 · ${RARITIES[SPECIES[id].rarity].label}<br><span style="color:#adbea9">${SPECIES[id].description}</span></div>`).join('')}`;
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
}

function selectPet(petId) {
  if (selectedPetId !== petId) ui.pendingWork = null;
  selectedPetId = petId;
}

function bindPanelEvents() {
  document.querySelectorAll('[data-pet-id]').forEach(button => button.addEventListener('click', () => {
    selectPet(button.dataset.petId);
    renderAll();
  }));
  document.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => build(button.dataset.build)));
  document.querySelectorAll('[data-focus-building]').forEach(button => button.addEventListener('click', () => {
    const building = getBuildingById(button.dataset.focusBuilding);
    if (!building) return;
    // 지금 선택한 펫이 쉬고 있으면 그 펫을, 아니면 일이 없는 펫을 골라 해당 작업장을 미리 선택해 둔다.
    const current = getSelectedPet();
    const candidate = (current && !current.workBuildingId ? current : null) || game.pets.find(p => !p.workBuildingId) || current || game.pets[0];
    activeTab = 'pets';
    if (candidate) { selectPet(candidate.id); ui.pendingWork = { petId: candidate.id, value: building.id }; }
    renderAll();
    toast(`${BUILDING_TYPES[building.type].name}을(를) 골라 두었어요. '배치 적용'을 누르면 배치됩니다.`);
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
  game.message = `${meta.name}을(를) 건설했어요.`;
  saveGame(); renderAll(); toast(`${meta.name} 건설 완료!`);
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
  game.message = !targetId ? `${pet.name}이(가) 자유 생활을 시작했어요.`
    : pet.resting ? `${pet.name}이(가) 배치됐어요. 에너지를 회복한 뒤 작업을 시작해요.` : `${pet.name}이(가) 작업을 시작했어요.`;
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

// 펫 한도(maxPets)가 차면 알이 부화하지 못하므로, 자리를 비울 수단으로 놓아주기를 제공한다.
function releaseSelectedPet() {
  const pet = getSelectedPet();
  if (!pet) return;
  if (game.pets.length <= CONFIG.minPets) return toast(`펫은 최소 ${CONFIG.minPets}마리가 필요해요.`);
  if (!confirm(`${pet.name}을(를) 초원으로 돌려보낼까요? 되돌릴 수 없어요. (도감 기록은 유지됩니다)`)) return;
  game.pets = game.pets.filter(p => p.id !== pet.id);
  ui.pendingWork = null;
  selectedPetId = game.pets[0]?.id || null;
  game.message = `${pet.name}이(가) 초원으로 돌아갔어요.`;
  saveGame(); renderAll(); toast(game.message);
}

function pickChildSpecies(parentA, parentB) {
  const a = SPECIES[parentA.speciesId];
  const b = SPECIES[parentB.speciesId];
  // A discovery roll allows unowned Meadow species to enter the collection loop in this MVP.
  const undiscovered = Object.keys(SPECIES).filter(id => !game.discoveredSpecies.includes(id));
  const curiousParents = [parentA, parentB].filter(parent => traitHas(parent, 'curious')).length;
  const discoveryChance = CONFIG.discoveryChance + curiousParents * CONFIG.curiousDiscoveryBonus;
  if (undiscovered.length && Math.random() < discoveryChance) {
    return weightedPick(undiscovered.map(id => ({ id, weight: RARITIES[SPECIES[id].rarity].discoveryWeight })));
  }
  // 조합표에 전용 결과가 있으면 그것을 쓴다(종족 조합 → 속성 조합 순).
  const table = BREEDING_RULES.speciesPairs[pairKey(parentA.speciesId, parentB.speciesId)] || BREEDING_RULES.elementPairs[pairKey(a.element, b.element)];
  const tableEntries = (table || []).filter(entry => SPECIES[entry.speciesId]).map(entry => ({ id: entry.speciesId, weight: entry.weight || 1 }));
  if (tableEntries.length) return weightedPick(tableEntries);
  // 기본 규칙: 부모 중 하나와 같은 속성의 종족.
  const candidates = Object.entries(SPECIES).filter(([, species]) => species.element === a.element || species.element === b.element);
  const pool = (candidates.length ? candidates : Object.entries(SPECIES)).map(([id]) => ({ id, weight: 1 }));
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

// Canvas rendering: simple top-down illustrative placeholder art, independent from game rules.
function drawVillage() {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, '#91bd75'); base.addColorStop(1, '#6d9d61');
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  // Meadow patches and soft paths
  for (let i = 0; i < 80; i++) {
    const x = (i * 137.5) % w, y = (i * 83.7) % h;
    ctx.fillStyle = i % 2 ? 'rgba(219,239,164,.12)' : 'rgba(39,92,54,.08)';
    ctx.beginPath(); ctx.ellipse(x, y, 35 + (i % 4) * 7, 15 + (i % 3) * 5, .2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#d5c994'; ctx.lineWidth = 58; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(w*.47,h*.52); ctx.bezierCurveTo(w*.38,h*.58,w*.39,h*.76,w*.24,h*.83); ctx.moveTo(w*.49,h*.52); ctx.bezierCurveTo(w*.62,h*.53,w*.68,h*.64,w*.81,h*.7); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,246,200,.35)'; ctx.lineWidth = 3; ctx.setLineDash([8,12]); ctx.beginPath(); ctx.moveTo(w*.47,h*.52); ctx.bezierCurveTo(w*.38,h*.58,w*.39,h*.76,w*.24,h*.83); ctx.stroke(); ctx.setLineDash([]);
  // Decorative trees and flowers
  for (let i = 0; i < 17; i++) {
    const x = ((i * 211) % (w - 80)) + 40, y = ((i * 127 + 30) % (h - 90)) + 40;
    if (Math.abs(x-w*.5) < 100 && Math.abs(y-h*.5) < 80) continue;
    drawTree(x, y, .72 + (i%3)*.12);
  }
  game.buildings.forEach(drawBuilding);
  // 알은 교배장 옆에 놓는다.
  const nursery = getBuilding('nursery');
  const eggX = nursery ? nursery.x * w + 66 : w * .52, eggY = nursery ? nursery.y * h - 6 : h * .78;
  game.eggs.forEach((egg, index) => drawEgg(eggX + (index % 2) * 20, eggY + Math.floor(index / 2) * 20));
  game.pets.forEach(drawPet);
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
  if (building.type === 'farm') {
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
  ctx.font='22px sans-serif';ctx.textAlign='center';ctx.fillText(info.icon,x,y-58);
  ctx.font='bold 12px sans-serif';ctx.fillStyle='#18341e';ctx.fillText(info.name,x,y+43);
  if(info.capacity){ctx.font='10px sans-serif';ctx.fillStyle='#f3f7e8';ctx.fillText(`${assignedCount(building.id)}/${info.capacity}`,x+34,y+37);}
}
function drawPet(pet) {
  const x=pet.x*canvas.width, y=pet.y*canvas.height;
  const species=SPECIES[pet.speciesId];
  const resting=isResting(pet);
  const bob=resting ? 0 : Math.sin(pet.bob)*2;
  ctx.fillStyle='rgba(30,57,31,.25)';ctx.beginPath();ctx.ellipse(x,y+14,17,7,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=species.color;ctx.beginPath();ctx.ellipse(x,y+bob,15,13,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#53664a';ctx.lineWidth=1.5;ctx.stroke();
  ctx.fillStyle=species.color;
  ctx.beginPath();ctx.arc(x-8,y-10+bob,6,0,Math.PI*2);ctx.arc(x+8,y-10+bob,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#263729';
  if(resting){ctx.fillRect(x-7,y-1,4,1.5);ctx.fillRect(x+3,y-1,4,1.5);} // 감은 눈
  else{ctx.beginPath();ctx.arc(x-5,y-1+bob,1.8,0,Math.PI*2);ctx.arc(x+5,y-1+bob,1.8,0,Math.PI*2);ctx.fill();}
  ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText(species.icon,x,y-23+bob);
  if(isWorking(pet)){ctx.fillStyle='#f0cf75';ctx.beginPath();ctx.arc(x+15,y-15,4,0,Math.PI*2);ctx.fill();}
  if(resting){ctx.font='12px sans-serif';ctx.fillText('💤',x+17,y-14+Math.sin(pet.bob*.5)*2);}
  if(pet.appearance){ctx.font='12px sans-serif';ctx.fillStyle='#fff1a5';ctx.fillText('✦',x-15,y-18+bob);}
  if(selectedPetId===pet.id){ctx.strokeStyle='#fff4a9';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+1,22,21,0,0,Math.PI*2);ctx.stroke();}
}
function drawEgg(x,y){ctx.fillStyle='rgba(44,39,56,.24)';ctx.beginPath();ctx.ellipse(x,y+9,9,4,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f8e7c9';ctx.beginPath();ctx.ellipse(x,y,7,9,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c49b82';ctx.lineWidth=1.5;ctx.stroke();}
function movePets(delta) {
  const seconds=Math.min(delta/1000,.08);
  game.pets.forEach((pet,index)=>{
    pet.bob += seconds*5;
    const workingBuilding=isWorking(pet) ? getWorkBuilding(pet) : null;
    if(workingBuilding){
      // 작업 중: 작업장 앞으로 이동해 머문다.
      const offset=(index%3-1)*.035;
      pet.targetX=clamp(workingBuilding.x+offset,.06,.94);pet.targetY=clamp(workingBuilding.y+.08,.08,.9);
      pet.idleTimer=null;
    } else if(isResting(pet)){
      // 휴식 중: 제자리에서 쉰다.
      pet.targetX=pet.x;pet.targetY=pet.y;pet.idleTimer=null;
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
    if(pet.moving){const speed=CONFIG.baseMoveSpeed*(traitHas(pet,'nimble') ? CONFIG.nimbleSpeedMultiplier : 1)*seconds;pet.x+=dx/dist*Math.min(dist,speed);pet.y+=dy/dist*Math.min(dist,speed);pet.direction=dx>=0?1:-1;}
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
  if(nearest){selectPet(nearest.id);activeTab='pets';renderAll();}
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
      ui.parentA=null;ui.parentB=null;ui.pendingWork=null;awaySnapshot=null;
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
  game=loadGame();
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
