/* Little Haven 회귀 테스트 (완료 기준 전체 점검)
 *
 * 게임 코드를 고친 뒤 "기존 기능이 망가지지 않았는지" 한 번에 확인하는 자동 검사다.
 * 실제 Chromium 브라우저로 게임을 열어 버튼을 누르고, 시계를 앞으로 돌려 시간 경과를 흉내 낸다.
 *
 * 실행 방법 (프로젝트 폴더에서):
 *   node tests/regression.js
 * 마지막 줄에 "실패 0"이 나오면 통과다. 서버를 띄울 필요는 없다.
 *
 * 처음 한 번만 필요한 준비 (PC에서 실행할 때):
 *   1) Node.js 설치
 *   2) npm install playwright
 *   3) npx playwright install chromium
 * 게임 자체는 이 폴더 없이도 실행된다.
 */
const { chromium } = require('playwright');
// 기본값: 이 폴더 옆의 index.html을 파일로 직접 연다(서버 불필요). 다른 주소로 검사하려면 LH_URL 환경변수를 준다.
const URL = process.env.LH_URL || require('url').pathToFileURL(require('path').join(__dirname, '..', 'index.html')).href;
const SHOT_DIR = require('os').tmpdir();
const SPECIES_NAME_MOSSBEAR = '끼고미'; // 종족 이름은 임시다. 이름을 바꾸면 여기도 함께 바꾼다.
const results = [];
function check(name, ok, detail='') { results.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? '  → ' + detail : '')); }
const clockScript = (off) => `(() => { if (!window.__realNow) window.__realNow = Date.now.bind(Date); window.__off = ${off}; Date.now = () => window.__realNow() + window.__off; })();`;

(async () => {
  const browser = await chromium.launch();
  const errs = [];
  const watch = (page) => { page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); }); };

  // ---------- 1. 새 프로필 시작 ----------
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(clockScript(0));
  let page = await ctx.newPage(); watch(page);
  page.on('dialog', d => d.accept());
  await page.goto(URL); await page.waitForTimeout(400);
  check('1 새 프로필에서 오류 없이 시작', errs.length === 0 && await page.evaluate(() => game.pets.length === 2 && game.version === 1));
  check('1 시작 직후 저장 생성', await page.evaluate(() => !!localStorage.getItem(CONFIG.saveKey)));

  // ---------- 2. 펫 이동·선택 ----------
  const pos0 = await page.evaluate(() => game.pets.map(p => [p.x, p.y]));
  await page.waitForTimeout(6500);
  const pos1 = await page.evaluate(() => game.pets.map(p => [p.x, p.y]));
  check('2 펫이 마을에서 이동', pos0.some((p, i) => Math.hypot(p[0] - pos1[i][0], p[1] - pos1[i][1]) > 0.01), JSON.stringify(pos1));
  check('2 펫이 화면 안에 머묾', pos1.every(p => p[0] > .05 && p[0] < .95 && p[1] > .05 && p[1] < .95));
  const clickTarget = await page.evaluate(() => { const p = game.pets[1]; const r = canvas.getBoundingClientRect(); return { id: p.id, x: r.left + p.x * r.width, y: r.top + p.y * r.height }; });
  await page.mouse.click(clickTarget.x, clickTarget.y);
  check('2 캔버스 클릭으로 펫 선택 + 펫 탭 전환', await page.evaluate((id) => selectedPetId === id && activeTab === 'pets', clickTarget.id));
  await page.click('.pet-card >> nth=0');
  check('2 목록 클릭으로 펫 선택', await page.evaluate(() => selectedPetId === game.pets[0].id));
  check('2 선택 펫 정보에 특성 효과 표시', (await page.textContent('.pet-profile')).includes('교배 시 새 종족 발견 확률'));
  const track = await page.evaluate(() => { const r = document.querySelector('.pet-card .energy-track').getBoundingClientRect(); return [r.width, r.height]; });
  check('2 펫 카드 에너지 막대 표시', track[0] > 50 && track[1] >= 3, JSON.stringify(track));

  // ---------- 3. 작업 배치 → 자원 증가 ----------
  await page.click('[data-tab="village"]');
  await page.click('[data-focus-building]');
  check('3 배치 관리 → 펫 탭 + 작업장 미리 선택', await page.evaluate(() => activeTab === 'pets' && document.querySelector('#workSelect').value === game.buildings.find(b => b.type === 'farm').id));
  await page.click('#assignButton');
  check('3 배치 적용', await page.evaluate(() => game.pets[0].workBuildingId === game.buildings.find(b => b.type === 'farm').id));
  check('3 상태 문구 작업 중', (await page.textContent('.pet-card.selected .pet-state')) === '작업 중');
  const plant0 = await page.evaluate(() => game.resources.plant);
  await page.evaluate(() => { window.__off += 600000; });       // 10분 경과 (탭 이벤트 없이)
  await page.waitForTimeout(1300);
  const plant1 = await page.evaluate(() => game.resources.plant);
  check('3 10분 작업 → 식물 +13 (적성 1.35×10회)', plant1 - plant0 === 13, `증가 ${plant1 - plant0}`);
  check('3 상단 자원 표시 갱신', (await page.textContent('#resourceStrip')).includes(String(plant1)));
  check('3 작업 에너지 소모(풀:10회×2)', await page.evaluate(() => game.pets[0].energy === 80), await page.evaluate(() => String(game.pets[0].energy)));
  // 탭 숨김/복귀 시 중복 계산 없음
  await page.evaluate(() => { game.pets[0].productionProgress = 0; });
  const dup = await page.evaluate(async () => {
    const before = game.pets[0].productionProgress; const t0 = Date.now();
    window.__off += 30000; document.dispatchEvent(new Event('visibilitychange'));
    await new Promise(r => setTimeout(r, 1500));
    return { gained: game.pets[0].productionProgress - before, real: (Date.now() - t0) / 1000 };
  });
  check('3 탭 복귀 시 시간 중복 계산 없음', Math.abs(dup.gained - dup.real) <= 1.01, JSON.stringify(dup));

  // ---------- 4. 에너지 부족 → 휴식 → 재개 ----------
  const e = await page.evaluate(() => {
    const pet = game.pets[0]; pet.energy = 28; pet.resting = false; pet.productionProgress = 0; pet.restProgress = 0;
    const p0 = game.resources.plant; simulateSeconds(120);            // 2회 생산 → 24
    const afterWork = { energy: pet.energy, resting: pet.resting, gained: game.resources.plant - p0, state: petStateLabel(pet) };
    const p1 = game.resources.plant; simulateSeconds(600);            // 휴식 10분 → +20, 생산 없음
    const afterRest = { energy: pet.energy, resting: pet.resting, gained: game.resources.plant - p1 };
    simulateSeconds(60 * 23);                                         // 44 → 90 도달
    const resumed = { energy: pet.energy, resting: pet.resting, state: petStateLabel(pet) };
    const p2 = game.resources.plant; simulateSeconds(60);
    return { afterWork, afterRest, resumed, gainedAfterResume: game.resources.plant - p2 };
  });
  check('4 에너지 25% 이하 → 작업 중단·휴식', e.afterWork.resting && e.afterWork.energy === 24 && e.afterWork.state === '휴식 중', JSON.stringify(e.afterWork));
  check('4 휴식 중 생산 없음 + 에너지 회복', e.afterRest.gained === 0 && e.afterRest.energy === 44 && e.afterRest.resting, JSON.stringify(e.afterRest));
  check('4 90% 회복 후 작업 재개', !e.resumed.resting && e.resumed.energy === 90 && e.resumed.state === '작업 중' && e.gainedAfterResume >= 1, JSON.stringify(e));
  check('4 에너지가 0 미만/영구 기절 없음', await page.evaluate(() => { const pet = game.pets[1]; pet.energy = 0; simulateSeconds(3600); return pet.energy > 0; }));
  // 먹이 주기
  const feed = await page.evaluate(() => { const pet = game.pets[0]; pet.energy = 30; const p = game.resources.plant; document.querySelector('#feedButton'); return { p }; });
  await page.evaluate(() => renderAll());
  await page.click('#feedButton');
  check('4 먹이 주기: 식물 -3, 에너지 +25', await page.evaluate((p) => game.resources.plant === p - 3 && game.pets[0].energy === 55, feed.p));
  // 자유 생활 전환
  await page.selectOption('#workSelect', '');
  await page.click('#assignButton');
  check('4 자유 생활 전환', await page.evaluate(() => game.pets[0].workBuildingId === null && !game.pets[0].resting));

  // ---------- 5. 건설 ----------
  await page.evaluate(() => { game.resources = { wood: 30, stone: 24, plant: 30, ore: 8 }; activeTab = 'village'; renderAll(); });
  await page.click('[data-build="quarry"]'); await page.click('[data-build="smelter"]');
  check('5 채굴장·제련소 먼저 지어도 벌목장 건설 가능(막힘 해소)', await page.evaluate(() => canAfford(BUILDING_TYPES.lumber.cost)), await page.evaluate(() => JSON.stringify(game.resources)));
  await page.click('[data-build="lumber"]');
  check('5 네 시설 모두 건설', await page.evaluate(() => ['farm', 'lumber', 'quarry', 'smelter'].every(t => getBuilding(t))) && (await page.textContent('#panelContent')).includes('모든 기본 생산 시설을 건설했어요'));
  check('5 자원 음수 없음', await page.evaluate(() => Object.values(game.resources).every(v => v >= 0)));
  const yields = await page.evaluate(() => {
    const out = {};
    for (const type of ['lumber', 'quarry', 'smelter']) {
      const pet = makePet('pebblelamb', ['sturdy']); game.pets.push(pet); pet.workBuildingId = getBuilding(type).id;
      const before = { ...game.resources }; simulatePetSeconds(pet, 600);
      out[type] = Object.fromEntries(Object.keys(RESOURCES).map(k => [k, game.resources[k] - before[k]])); out[type].energy = pet.energy;
      game.pets.pop();
    }
    return out;
  });
  check('5 벌목장: 땅 속성 적성 보너스(목재 13)', yields.lumber.wood === 13, JSON.stringify(yields.lumber));
  check('5 채굴장: 돌 13 + 광석 2, 튼튼함 소모 -1', yields.quarry.stone === 13 && yields.quarry.ore === 2 && yields.quarry.energy === 90, JSON.stringify(yields.quarry));
  check('5 제련소: 비적성 광석 10', yields.smelter.ore === 10, JSON.stringify(yields.smelter));
  // 정원 초과
  const cap = await page.evaluate(() => { const farm = getBuilding('farm'); game.pets.push(makePet('dewotter', ['smart']), makePet('dewotter', ['lively'])); game.pets[1].workBuildingId = farm.id; game.pets[2].workBuildingId = farm.id; selectedPetId = game.pets[3].id; activeTab = 'pets'; renderAll(); return farm.id; });
  await page.selectOption('#workSelect', cap); await page.click('#assignButton');
  check('5 작업장 정원(2) 초과 배치 거부', await page.evaluate(() => game.pets[3].workBuildingId === null));

  // ---------- 5-2. 시설 업그레이드 (벌목장·채굴장으로 검사. 농장은 뒤 검사가 Lv.1 기준이라 건드리지 않는다) ----------
  const lumberId = await page.evaluate(() => { game.resources = { wood: 12, stone: 9, plant: 30, ore: 0 }; activeTab = 'village'; renderAll(); return getBuilding('lumber').id; });
  const upSel = `[data-upgrade="${lumberId}"]`;
  check('5-2 업그레이드 비용 표시(건설 비용의 2배)', (await page.textContent('#panelContent')).includes('Lv.2 비용: 🪵 12 · 🪨 10'));
  check('5-2 자원이 부족하면 업그레이드 버튼 비활성', await page.isDisabled(upSel));
  check('5-2 자원이 부족하면 직접 호출해도 거부', await page.evaluate((id) => { upgradeBuilding(id); return getBuildingById(id).level === 1 && game.resources.wood === 12 && game.resources.stone === 9; }, lumberId));
  check('5-2 기본 시설(광장·교배장)에는 업그레이드 버튼 없음', await page.evaluate(() => !canUpgrade(getBuilding('plaza')) && !canUpgrade(getBuilding('nursery')) && document.querySelectorAll('[data-upgrade]').length === 4));
  await page.evaluate(() => { game.resources = { wood: 100, stone: 100, plant: 30, ore: 0 }; renderAll(); });
  await page.click(upSel);
  check('5-2 업그레이드 → 레벨 2, 자원 차감(목재 -12, 돌 -10)', await page.evaluate((id) => getBuildingById(id).level === 2 && game.resources.wood === 88 && game.resources.stone === 90, lumberId), await page.evaluate(() => JSON.stringify(game.resources)));
  check('5-2 카드에 새 레벨과 생산량 표시', (await page.textContent('#panelContent')).includes('Lv.2/3 · 생산량 ×2'));
  const upYield = await page.evaluate(() => {
    upgradeBuilding(getBuilding('quarry').id);                          // 채굴장 Lv.2 (목재 20, 돌 16)
    const out = { quarryLevel: getBuilding('quarry').level };
    for (const type of ['lumber', 'quarry']) {
      const pet = makePet('sproutbun', ['sturdy']); game.pets.push(pet); pet.workBuildingId = getBuilding(type).id;   // 비적성 펫: 1회당 정확히 레벨만큼
      const before = { ...game.resources }; simulatePetSeconds(pet, 600);
      out[type] = Object.fromEntries(Object.keys(RESOURCES).map(k => [k, game.resources[k] - before[k]])); out[type].energy = pet.energy;
      game.pets.pop();
    }
    return out;
  });
  check('5-2 Lv.2 벌목장: 10분 목재 20(Lv.1의 2배), 에너지 소모는 그대로', upYield.lumber.wood === 20 && upYield.lumber.energy === 90, JSON.stringify(upYield.lumber));
  check('5-2 Lv.2 채굴장: 돌 20 + 광석 5(부산물도 2배)', upYield.quarryLevel === 2 && upYield.quarry.stone === 20 && upYield.quarry.ore === 5, JSON.stringify(upYield.quarry));
  await page.evaluate(() => { game.resources.wood = 100; game.resources.stone = 100; activeTab = 'village'; renderAll(); });
  check('5-2 Lv.3 비용 표시(건설 비용의 4배)', (await page.textContent('#panelContent')).includes('Lv.3 비용: 🪵 24 · 🪨 20'));
  await page.click(upSel);
  check('5-2 레벨 3 도달, 자원 차감(목재 -24, 돌 -20)', await page.evaluate((id) => getBuildingById(id).level === 3 && game.resources.wood === 76 && game.resources.stone === 80, lumberId));
  check('5-2 최대 레벨에서는 업그레이드 버튼이 없고 "최대 레벨" 표시', await page.evaluate((sel) => !document.querySelector(sel), upSel) && (await page.textContent('#panelContent')).includes('최대 레벨'));
  check('5-2 최대 레벨에서 직접 호출해도 변화 없음', await page.evaluate((id) => { upgradeBuilding(id); return getBuildingById(id).level === 3 && game.resources.wood === 76; }, lumberId));
  check('5-2 저장 데이터의 비정상 레벨(99)은 최대 레벨로 보정', await page.evaluate(() => { const copy = JSON.parse(JSON.stringify(game)); copy.buildings.find(b => b.type === 'farm').level = 99; return normalizeGame(copy).buildings.find(b => b.type === 'farm').level === CONFIG.maxBuildingLevel; }));

  // ---------- 5-3. 지역 개방 (숲: 마을 3단계 + 도감 5종 + 목재 100·돌 60 소모) ----------
  // 이 시점: 건물 6개 + 발견 2종 → 마을 2단계. 검사를 위해 발견 종족만 잠시 바꾸고 끝나면 되돌린다.
  const unlockSel = '[data-unlock-region="forest"]';
  const reg0 = await page.evaluate(() => { game.resources = { wood: 500, stone: 500, plant: 30, ore: 0 }; activeTab = 'village'; renderAll(); return { regions: game.unlockedRegions.slice(), level: currentVillageLevel(), text: document.querySelector('[data-region="forest"]').textContent, meadow: document.querySelector('[data-region="meadow"]').textContent }; });
  check('5-3 새 게임은 초원만 개방', JSON.stringify(reg0.regions) === '["meadow"]' && reg0.meadow.includes('개방됨'), JSON.stringify(reg0.regions));
  check('5-3 숲은 안개 상태로 조건·달성도 표시', reg0.text.includes('안개에 가려진 지역') && reg0.text.includes('⬜ 마을 단계 2/3') && reg0.text.includes('⬜ 발견 종족 2/5') && reg0.text.includes('✅ 🪵 목재 (개방 시 소모) 500/100') && reg0.text.includes('✅ 🪨 돌 (개방 시 소모) 500/60'), reg0.text);
  check('5-3 자원이 충분해도 마을 단계·도감 조건 미달이면 버튼 비활성', await page.isDisabled(unlockSel));
  check('5-3 조건 미달이면 직접 호출해도 거부', await page.evaluate(() => { unlockRegion('forest'); return !isRegionUnlocked('forest') && game.resources.wood === 500; }));
  const realDex = await page.evaluate(() => { const real = game.discoveredSpecies; game.discoveredSpecies = ['sproutbun', 'pebblelamb', 'dewotter', 'breezefox', 'embergecko']; game.resources.wood = 99; game.resources.stone = 60; renderAll(); return real; });
  check('5-3 마을 3단계·도감 5종이어도 목재가 1 모자라면 거부', await page.evaluate(() => currentVillageLevel() === 3) && await page.isDisabled(unlockSel) && await page.evaluate(() => { unlockRegion('forest'); return !isRegionUnlocked('forest') && game.resources.wood === 99; }));
  await page.evaluate(() => { game.resources.wood = 130; game.resources.stone = 70; });
  await page.waitForTimeout(1300);   // 다시 그리지 않아도 매초 갱신으로 버튼이 켜지는지
  check('5-3 조건을 채우면 달성도 갱신 + 버튼 활성(매초 갱신)', !(await page.isDisabled(unlockSel)) && (await page.textContent('[data-region-req="forest"]')).includes('✅ 마을 단계 3/3'), await page.textContent('[data-region-req="forest"]'));
  const giftBefore = await page.evaluate(() => ({ pets: game.pets.length, text: document.querySelector('[data-region="forest"]').textContent }));
  await page.click(unlockSel);
  const gift = await page.evaluate(() => ({ pets: game.pets.length, last: game.pets[game.pets.length - 1].speciesId, name: game.pets[game.pets.length - 1].name, dex: game.discoveredSpecies.includes('mossbear'), given: game.regionGiftsGiven.slice(), msg: game.message }));
  check('5-3 개방 전 카드에 선물 안내 표시', giftBefore.text.includes('개방하면 이 지역의 펫 1마리가 합류해요'));
  check('5-3 개방 선물: 끼고미 1마리 합류 + 도감 등록', gift.pets === giftBefore.pets + 1 && gift.last === 'mossbear' && gift.name === SPECIES_NAME_MOSSBEAR && gift.dex && JSON.stringify(gift.given) === '["forest"]' && gift.msg.includes(SPECIES_NAME_MOSSBEAR), JSON.stringify(gift));
  check('5-3 선물은 한 번만 지급', await page.evaluate(() => { const n = game.pets.length; const again = grantPendingRegionGifts(); return !again && game.pets.length === n; }));
  const reg1 = await page.evaluate(() => ({ regions: game.unlockedRegions.slice(), wood: game.resources.wood, stone: game.resources.stone, text: document.querySelector('[data-region="forest"]').textContent, button: !!document.querySelector('[data-unlock-region]'), saved: JSON.parse(localStorage.getItem(CONFIG.saveKey)).unlockedRegions }));
  check('5-3 개방 → 목재 -100, 돌 -60, 즉시 저장', JSON.stringify(reg1.regions) === '["meadow","forest"]' && reg1.wood === 30 && reg1.stone === 10 && reg1.saved.includes('forest'), JSON.stringify(reg1));
  check('5-3 개방 후 "개방됨" 표시, 버튼 사라짐', reg1.text.includes('🌲 숲') && reg1.text.includes('개방됨') && !reg1.button, reg1.text);
  check('5-3 이미 개방한 지역은 다시 호출해도 자원이 줄지 않음', await page.evaluate(() => { game.resources.wood = 200; game.resources.stone = 200; unlockRegion('forest'); return game.resources.wood === 200 && game.unlockedRegions.length === 2; }));
  check('5-3 저장 데이터의 잘못된 지역 목록 보정(없는 지역 제거·중복 제거·초원 유지)', await page.evaluate(() => { const copy = JSON.parse(JSON.stringify(game)); copy.unlockedRegions = ['ghost', 'forest', 'forest']; const a = normalizeGame(copy).unlockedRegions; const copy2 = JSON.parse(JSON.stringify(game)); copy2.unlockedRegions = 'x'; const b = normalizeGame(copy2).unlockedRegions; return JSON.stringify(a) === '["meadow","forest"]' && JSON.stringify(b) === '["meadow"]'; }));
  // 펫 자리가 가득 차 있으면 선물을 미뤘다가 자리가 나면 지급
  const giftFull = await page.evaluate(() => {
    const keep = game.pets.slice(); game.regionGiftsGiven = [];
    while (game.pets.length < CONFIG.maxPets) game.pets.push(makePet('sproutbun', ['sturdy']));
    const whenFull = grantPendingRegionGifts(); const fullCount = game.pets.length; const pending = isRegionGiftPending('forest');
    renderAll(); const text = document.querySelector('[data-region="forest"]').textContent;
    game.pets.pop(); const afterSpace = grantPendingRegionGifts(); const last = game.pets[game.pets.length - 1].speciesId;
    game.pets = keep; game.regionGiftsGiven = ['forest'];
    return { whenFull, fullCount, pending, text, afterSpace, last };
  });
  check('5-3 펫 자리가 가득 차면 선물을 미루고 안내, 자리가 나면 지급', !giftFull.whenFull && giftFull.fullCount === 30 && giftFull.pending && giftFull.text.includes('펫 자리가 나면 새 친구가 찾아와요') && giftFull.afterSpace && giftFull.last === 'mossbear', JSON.stringify(giftFull));
  // 뒤의 기존 검사(6~8)는 "초원만 개방" 상태 기준이므로 숲을 다시 잠그고 선물 펫을 빼 둔다. 숲 종족 검사는 6-2에서 한다.
  await page.evaluate((real) => { game.pets.pop(); game.unlockedRegions = ['meadow']; game.regionGiftsGiven = []; game.discoveredSpecies = real; game.resources = { wood: 30, stone: 10, plant: 30, ore: 0 }; renderAll(); }, realDex);

  // ---------- 6. 교배·부화·도감 ----------
  await page.click('[data-tab="breed"]');
  await page.selectOption('#parentB', { index: 3 });
  await page.waitForTimeout(2300);
  check('6 교배 탭에서 고른 부모가 유지됨(매초 초기화 버그)', await page.evaluate(() => document.querySelector('#parentB').selectedIndex === 3));
  await page.selectOption('#parentB', { index: 0 });   // A와 같은 펫
  const eggs0 = await page.evaluate(() => game.eggs.length);
  await page.click('#breedButton');
  check('6 같은 펫끼리 교배 거부', await page.evaluate((n) => game.eggs.length === n, eggs0));
  await page.evaluate(() => { game.pets.forEach(p => { p.energy = p.maxEnergy; }); });
  await page.selectOption('#parentA', { index: 0 }); await page.selectOption('#parentB', { index: 1 });
  const dexBefore = await page.evaluate(() => game.discoveredSpecies.length);
  await page.evaluate(() => { window.__realRandom = Math.random; Math.random = () => 0.01; });  // 발견 판정 성공 고정
  await page.click('#breedButton');
  await page.evaluate(() => { Math.random = window.__realRandom; });
  const egg = await page.evaluate(() => ({ n: game.eggs.length, species: game.eggs[0]?.result.speciesId, eA: game.pets[0].energy, eB: game.pets[1].energy }));
  check('6 서로 다른 부모로 교배 → 알 생성, 에너지 각 -20', egg.n === 1 && egg.eA === 80 && egg.eB === 80, JSON.stringify(egg));
  const breedText = await page.textContent('#panelContent');
  check('6 부화 전 결과 비공개', breedText.includes('정체를 알 수 없는 알') && breedText.includes('부화 결과는 아직 공개되지 않아요'));
  check('6 알 화면에 종족명 노출 없음', !(await page.textContent('.egg-card')).includes(await page.evaluate(() => SPECIES[game.eggs[0].result.speciesId].name)));
  const t1 = await page.textContent('[data-egg-time]'); await page.waitForTimeout(2100); const t2 = await page.textContent('[data-egg-time]');
  check('6 부화 타이머가 줄어듦', t1 !== t2, `${t1} → ${t2}`);
  const petsBefore = await page.evaluate(() => game.pets.length);
  await page.evaluate(() => { window.__off += 180000; }); await page.waitForTimeout(1400);
  const hatch = await page.evaluate(() => ({ pets: game.pets.length, eggs: game.eggs.length, dex: game.discoveredSpecies.length, last: game.pets[game.pets.length - 1].speciesId, msg: game.message }));
  check('6 부화 → 새 펫 추가, 알 제거', hatch.pets === petsBefore + 1 && hatch.eggs === 0, JSON.stringify(hatch));
  check('6 신규 종족 도감 등록', hatch.dex === dexBefore + 1 && hatch.last === egg.species && hatch.msg.includes('발견'));
  await page.click('[data-tab="dex"]');
  check('6 도감 탭 표시', (await page.textContent('#panelContent')).includes(`${hatch.dex} / 6`));
  const dexLocked = await page.evaluate(() => ({ total: document.querySelector('.stat strong').textContent, meadow: document.querySelector('[data-dex-region="meadow"]').textContent, forest: document.querySelector('[data-dex-region="forest"]').textContent, hints: [...document.querySelectorAll('.dex-card.locked small')].map(n => n.textContent) }));
  check('6 도감: 전체 15종 기준 표시 + 지역별 묶음(초원 n/6, 숲 0/9)', dexLocked.total === `${hatch.dex} / 15` && dexLocked.meadow.includes('초원') && dexLocked.meadow.includes(`${hatch.dex} / 6`) && dexLocked.forest.includes('숲') && dexLocked.forest.includes('0 / 9'), JSON.stringify(dexLocked));
  check('6 도감: 숲 미개방이면 숲 종족 9칸 모두 "지역 미개방"', dexLocked.hints.filter(h => h === '지역 미개방').length === 9);
  // 교배 통계: 발견 확률·희귀도 가중
  const stats = await page.evaluate(() => {
    const saved = game.discoveredSpecies; game.discoveredSpecies = ['sproutbun', 'pebblelamb'];
    const a = makePet('sproutbun', ['sturdy']), b = makePet('pebblelamb', ['sturdy']), c = makePet('sproutbun', ['curious']);
    const run = (x, y) => { const cnt = {}; for (let i = 0; i < 20000; i++) { const s = pickChildSpecies(x, y); cnt[s] = (cnt[s] || 0) + 1; } return cnt; };
    const plain = run(a, b), curious = run(c, b), same = run(a, makePet('sproutbun', ['sturdy']));
    game.discoveredSpecies = saved;
    const newRate = (cnt) => 1 - ((cnt.sproutbun || 0) + (cnt.pebblelamb || 0)) / 20000;
    return { plainNew: newRate(plain), curiousNew: newRate(curious), plain, sameOnlyParent: Object.keys(same).filter(k => same[k] > 0) };
  });
  check('6 새 종족 발견 확률 ≈18%, 호기심 부모 ≈24%', Math.abs(stats.plainNew - .18) < .02 && Math.abs(stats.curiousNew - .24) < .02, `${stats.plainNew.toFixed(3)} / ${stats.curiousNew.toFixed(3)}`);
  check('6 일반 종족이 희귀 종족보다 먼저 발견되기 쉬움', stats.plain.dewotter > stats.plain.breezefox && stats.plain.dewotter > stats.plain.embergecko, JSON.stringify(stats.plain));
  // 한도
  const limits = await page.evaluate(() => {
    const keep = game.pets.slice(); while (game.pets.length < CONFIG.maxPets) game.pets.push(makePet('sproutbun', ['sturdy']));
    activeTab = 'breed'; renderAll(); const n = game.eggs.length; startBreeding(); const blocked = game.eggs.length === n;
    game.eggs.push({ id: 'egg_old', remainingSeconds: 1, result: { speciesId: 'dewotter', traits: ['smart'], look: null, name: '이슬수달' } });
    simulateSeconds(5); const stuck = game.eggs.length === 1 && game.pets.length === CONFIG.maxPets;
    game.pets = keep; simulateSeconds(31); const hatchedAfterSpace = game.eggs.length === 0;
    return { blocked, stuck, hatchedAfterSpace };
  });
  check('6 펫 한도 도달 시 교배 차단, 묶인 알은 자리 나면 부화', limits.blocked && limits.stuck && limits.hatchedAfterSpace, JSON.stringify(limits));

  // ---------- 6-2. 숲 종족·조합 전용 종족 ----------
  check('6-2 종족·조합표 데이터 점검(지역·속성·희귀도·조합 키)', await page.evaluate(() => {
    const speciesOk = Object.values(SPECIES).every(s => REGIONS[s.region] && ELEMENTS[s.element] && RARITIES[s.rarity] && s.name && s.icon);
    const giftsOk = Object.values(REGIONS).every(r => !r.giftSpecies || (SPECIES[r.giftSpecies] && !SPECIES[r.giftSpecies].breedOnly));
    const rulesOk = Object.entries(BREEDING_RULES.speciesPairs).every(([key, list]) => { const ids = key.split('+'); return ids.length === 2 && ids.every(id => SPECIES[id]) && pairKey(ids[0], ids[1]) === key && list.every(e => SPECIES[e.speciesId] && e.weight > 0); });
    const elementRulesOk = Object.entries(BREEDING_RULES.elementPairs).every(([key, list]) => { const ids = key.split('+'); return ids.length === 2 && ids.every(id => ELEMENTS[id]) && pairKey(ids[0], ids[1]) === key && list.every(e => SPECIES[e.speciesId] && e.weight > 0); });
    const allLists = Object.values(BREEDING_RULES.speciesPairs).concat(Object.values(BREEDING_RULES.elementPairs));
    const everyBreedOnlyReachable = Object.keys(SPECIES).filter(id => SPECIES[id].breedOnly).every(id => allLists.some(list => list.some(e => e.speciesId === id)));
    const dualOk = Object.values(SPECIES).every(s => s.element2 === undefined || (ELEMENTS[s.element2] && s.element2 !== s.element));
    return speciesOk && giftsOk && rulesOk && elementRulesOk && everyBreedOnlyReachable && dualOk && Object.keys(SPECIES).length === 15;
  }));
  const forest = await page.evaluate(() => {
    const realDex = game.discoveredSpecies, realRegions = game.unlockedRegions;
    const meadowIds = Object.keys(SPECIES).filter(id => SPECIES[id].region === 'meadow');
    const forestIds = Object.keys(SPECIES).filter(id => SPECIES[id].region === 'forest');
    const N = 20000;
    const run = (x, y) => { const cnt = {}; for (let i = 0; i < N; i++) { const s = pickChildSpecies(makeParent(x), makeParent(y)); cnt[s] = (cnt[s] || 0) + 1; } return cnt; };
    const makeParent = (id) => makePet(id, ['sturdy']);
    const sum = (cnt, ids) => ids.reduce((n, id) => n + (cnt[id] || 0), 0);
    const out = {};
    // 숲 미개방
    game.unlockedRegions = ['meadow']; game.discoveredSpecies = ['sproutbun', 'pebblelamb'];
    out.lockedForest = sum(run('sproutbun', 'pebblelamb'), forestIds) + sum(run('dewotter', 'breezefox'), forestIds) + sum(run('mossbear', 'pebblelamb'), forestIds);
    // 숲 개방, 숲 종족은 아직 미발견
    game.unlockedRegions = ['meadow', 'forest']; game.discoveredSpecies = meadowIds.slice();
    const fresh = run('embergecko', 'embergecko');     // 불 속성끼리: 기본 규칙으로는 숲 종족이 나올 수 없으므로 숲 종족은 발견 추첨으로만 나온다
    out.discoverRate = sum(fresh, forestIds) / N;
    out.discoverBreedOnly = (fresh.mistdeer || 0) + (fresh.elderturtle || 0);
    out.commonVsRare = [fresh.mossbear || 0, fresh.acornsquirrel || 0, fresh.pineowl || 0, fresh.glowhog || 0];
    // 모두 발견한 뒤: 조합 전용
    game.discoveredSpecies = Object.keys(SPECIES);
    const mist = run('dewotter', 'breezefox'), mistReverse = run('breezefox', 'dewotter'), turtle = run('pebblelamb', 'mossbear');
    out.mist = mist; out.mistRate = (mist.mistdeer || 0) / N; out.mistReverseRate = (mistReverse.mistdeer || 0) / N;
    out.turtle = turtle; out.turtleRate = (turtle.elderturtle || 0) / N;
    const others = [['dewotter', 'dewotter'], ['pebblelamb', 'acornsquirrel'], ['dewotter', 'pebblelamb'], ['mistdeer', 'mistdeer'], ['breezefox', 'pineowl']].map(([x, y]) => run(x, y));
    out.breedOnlyElsewhere = others.slice(0, 3).reduce((n, cnt) => n + (cnt.mistdeer || 0) + (cnt.elderturtle || 0), 0) + (others[4].mistdeer || 0) + (others[4].elderturtle || 0);
    out.sameBreedOnlyParents = others[3];
    out.defaultForest = others[1];
    game.discoveredSpecies = realDex; game.unlockedRegions = realRegions;
    return out;
  });
  check('6-2 숲 개방 전에는 숲 종족이 태어나지 않음(6만 회)', forest.lockedForest === 0, String(forest.lockedForest));
  check('6-2 숲 개방 후 숲 종족이 새 종족으로 발견됨(≈18%)', Math.abs(forest.discoverRate - .18) < .02, forest.discoverRate.toFixed(3));
  check('6-2 발견 추첨에서 조합 전용 종족은 나오지 않음, 일반이 희귀보다 자주', forest.discoverBreedOnly === 0 && Math.min(forest.commonVsRare[0], forest.commonVsRare[1]) > Math.max(forest.commonVsRare[2], forest.commonVsRare[3]), JSON.stringify(forest.commonVsRare));
  check('6-2 슬달이+산들우 → 아슴이 ≈20%, 나머지는 부모 종족(부모 순서 무관)', Math.abs(forest.mistRate - .2) < .02 && Math.abs(forest.mistReverseRate - .2) < .02 && Object.keys(forest.mist).sort().join() === 'breezefox,dewotter,mistdeer', JSON.stringify(forest.mist));
  check('6-2 몽양이+끼고미 → 나북이 ≈20%, 나머지는 부모 종족', Math.abs(forest.turtleRate - .2) < .02 && Object.keys(forest.turtle).sort().join() === 'elderturtle,mossbear,pebblelamb', JSON.stringify(forest.turtle));
  check('6-2 다른 조합에서는 조합 전용 종족이 나오지 않음(8만 회)', forest.breedOnlyElsewhere === 0, String(forest.breedOnlyElsewhere));
  check('6-2 조합 전용 종족끼리 교배하면 같은 종족이 나올 수 있음', (forest.sameBreedOnlyParents.mistdeer || 0) > 0 && !forest.sameBreedOnlyParents.elderturtle, JSON.stringify(forest.sameBreedOnlyParents));
  check('6-2 숲 개방 후 기본 규칙에 숲 종족 포함(몽양이+도토람 → 땅 속성 2종)', Object.keys(forest.defaultForest).sort().join() === 'acornsquirrel,pebblelamb', JSON.stringify(forest.defaultForest));
  // 화면: 숲 개방 상태의 도감 + 숲 종족 부화
  const forestUi = await page.evaluate(() => {
    game.unlockedRegions = ['meadow', 'forest']; game.regionGiftsGiven = ['forest'];   // 이후 검사(9 새로고침 유지)를 위해 개방 상태로 둔다
    const n = game.pets.length, dex = game.discoveredSpecies.length;
    game.eggs.push({ id: 'egg_forest', remainingSeconds: 1, result: { speciesId: 'elderturtle', traits: ['smart'], look: null, name: SPECIES.elderturtle.name } });
    simulateSeconds(2);
    activeTab = 'dex'; renderAll();
    return { hatched: game.pets.length === n + 1 && game.pets[game.pets.length - 1].speciesId === 'elderturtle', dexUp: game.discoveredSpecies.length === dex + 1, msg: game.message,
      forestHead: document.querySelector('[data-dex-region="forest"]').textContent, hints: [...document.querySelectorAll('.dex-card.locked small')].map(n => n.textContent), panel: document.querySelector('#panelContent').textContent, canvasOk: (() => { drawVillage(); return true; })() };
  });
  check('6-2 숲 종족 알 부화 → 펫 추가·도감 등록·발견 알림', forestUi.hatched && forestUi.dexUp && forestUi.msg.includes('나북이'), forestUi.msg);
  check('6-2 도감: 숲 개방 후 숲 1/9, 미발견 조합 전용은 "특별한 부모 조합 필요", 복합 속성은 "특별한 속성 조합 필요"', forestUi.forestHead.includes('🌲 숲') && forestUi.forestHead.includes('1 / 9') && forestUi.hints.filter(h => h === '특별한 부모 조합 필요').length === 1 && forestUi.hints.filter(h => h === '특별한 속성 조합 필요').length === 3 && !forestUi.hints.includes('지역 미개방') && forestUi.panel.includes('나북이') && forestUi.panel.includes('에픽'), JSON.stringify(forestUi.hints));

  // ---------- 6-3. 복합 속성(속성 2개) ----------
  const dual = await page.evaluate(() => {
    const realDex = game.discoveredSpecies, realRegions = game.unlockedRegions;
    const N = 20000;
    const run = (x, y) => { const cnt = {}; for (let i = 0; i < N; i++) { const s = pickChildSpecies(makePet(x, ['sturdy']), makePet(y, ['sturdy'])); cnt[s] = (cnt[s] || 0) + 1; } return cnt; };
    const duals = ['lotusfrog', 'flarefly', 'sandhamster'];
    const sumDual = (cnt) => duals.reduce((n, id) => n + (cnt[id] || 0), 0);
    const out = {};
    game.discoveredSpecies = Object.keys(SPECIES);
    game.unlockedRegions = ['meadow'];
    out.locked = sumDual(run('sproutbun', 'dewotter')) + sumDual(run('embergecko', 'sparkchick')) + sumDual(run('pebblelamb', 'breezefox'));
    game.unlockedRegions = ['meadow', 'forest'];
    const frog = run('sproutbun', 'dewotter'), frogReverse = run('dewotter', 'sproutbun'), fly = run('embergecko', 'sparkchick'), ham = run('pebblelamb', 'breezefox');
    out.frog = frog; out.rates = [frog.lotusfrog / N, frogReverse.lotusfrog / N, fly.flarefly / N, ham.sandhamster / N];
    out.wrongPair = sumDual(run('sproutbun', 'pebblelamb')) + sumDual(run('dewotter', 'embergecko')) + sumDual(run('sproutbun', 'sproutbun'));
    // 복합 속성 부모: 두 속성 모두 자식 후보에 반영된다(연구리=물·풀 + 불또마=불 → 물·풀·불 종족)
    out.dualParent = Object.keys(run('lotusfrog', 'embergecko')).sort();
    out.dualSame = run('lotusfrog', 'lotusfrog').lotusfrog > 0;
    // 작업 적성: 두 속성 중 하나라도 맞으면 보너스
    const frogPet = makePet('lotusfrog', ['sturdy']), hamPet = makePet('sandhamster', ['sturdy']), flyPet = makePet('flarefly', ['sturdy']);
    out.affinity = { frog: ['farm', 'lumber', 'quarry', 'smelter'].filter(t => hasAffinity(frogPet, t)), ham: ['farm', 'lumber', 'quarry', 'smelter'].filter(t => hasAffinity(hamPet, t)), fly: ['farm', 'lumber', 'quarry', 'smelter'].filter(t => hasAffinity(flyPet, t)) };
    game.pets.push(hamPet); hamPet.workBuildingId = getBuilding('smelter').id; const ore0 = game.resources.ore; simulatePetSeconds(hamPet, 600); out.noBonus = game.resources.ore - ore0;
    hamPet.energy = 100; hamPet.resting = false; hamPet.productionProgress = 0; hamPet.yieldProgress = 0; hamPet.workBuildingId = getBuilding('smelter').id;
    game.pets.pop(); game.pets.push(flyPet); flyPet.workBuildingId = getBuilding('smelter').id; const ore1 = game.resources.ore; simulatePetSeconds(flyPet, 600); out.bonus = game.resources.ore - ore1; game.pets.pop();
    // 화면
    game.pets.push(frogPet); selectedPetId = frogPet.id; activeTab = 'pets'; renderAll();
    out.profile = document.querySelector('.pet-profile').textContent; out.card = document.querySelector('.pet-card.selected .pet-detail').textContent;
    out.option = [...document.querySelectorAll('#workSelect option')].find(o => o.textContent.includes('농장')).textContent;
    activeTab = 'dex'; renderAll(); out.dex = document.querySelector('#panelContent').textContent; drawVillage();
    game.pets.pop(); selectedPetId = game.pets[0].id; game.discoveredSpecies = realDex; game.unlockedRegions = realRegions; activeTab = 'pets'; renderAll();
    out.single = { label: elementLabel(SPECIES.sproutbun), names: elementNames(SPECIES.sproutbun), list: speciesElements(SPECIES.sproutbun) };
    return out;
  });
  check('6-3 숲 개방 전에는 복합 속성 종족이 태어나지 않음(6만 회)', dual.locked === 0, String(dual.locked));
  check('6-3 속성 조합에서 복합 속성 종족이 ≈17%(풀+물, 불+전기, 땅+바람, 부모 순서 무관)', dual.rates.every(r => Math.abs(r - 1 / 6) < .02) && Object.keys(dual.frog).sort().join() === 'dewotter,lotusfrog,mossbear,sproutbun', dual.rates.map(r => r.toFixed(3)).join(' / '));
  check('6-3 다른 속성 조합에서는 복합 속성 종족이 나오지 않음(6만 회)', dual.wrongPair === 0, String(dual.wrongPair));
  check('6-3 복합 속성 부모는 두 속성 모두 자식 후보에 반영', dual.dualParent.join() === 'dewotter,embergecko,mossbear,sproutbun' && dual.dualSame, dual.dualParent.join());
  check('6-3 작업 적성: 두 속성 중 하나라도 맞으면 적성', dual.affinity.frog.join() === 'farm' && dual.affinity.ham.join() === 'lumber,quarry' && dual.affinity.fly.join() === 'smelter', JSON.stringify(dual.affinity));
  check('6-3 적성 보너스 실제 생산량: 제련소 10분 비적성 10, 적성(불·전기) 13', dual.noBonus === 10 && dual.bonus === 13, `${dual.noBonus} / ${dual.bonus}`);
  check('6-3 펫 정보·목록·작업장 선택에 두 속성과 적성 표시', dual.profile.includes('💧 물 · 🌿 풀') && dual.profile.includes('잘하는 일: 농장') && dual.card.includes('물·풀') && dual.option.includes('적성 ★'), dual.profile);
  check('6-3 도감에 두 속성 표시', dual.dex.includes('물·풀 속성') && dual.dex.includes('불·전기') && dual.dex.includes('땅·바람'));
  check('6-3 속성 1개 종족은 그대로(표시·목록)', dual.single.label === '🌿 풀' && dual.single.names === '풀' && dual.single.list.join() === 'grass', JSON.stringify(dual.single));

  // ---------- 6-4. 마을 단계 기준·그림 교체 준비 ----------
  const balance = await page.evaluate(() => {
    const maxScore = Object.keys(BUILDING_TYPES).length + Object.keys(SPECIES).length * 2;
    const t = CONFIG.villageLevelThresholds;
    const levelFor = (score) => t.reduce((level, threshold, i) => (score >= threshold ? i + 1 : level), 1);
    // 숲을 열기 전에 얻을 수 있는 최대치(시설 전부 + 초원의 일반 발견 종족)로 숲 개방 조건을 채울 수 있어야 한다.
    const meadowIds = Object.keys(SPECIES).filter(id => SPECIES[id].region === 'meadow' && !SPECIES[id].breedOnly);
    const meadowScore = Object.keys(BUILDING_TYPES).length + meadowIds.length * 2;
    const need = REGIONS.forest.unlock;
    return { top: t[t.length - 1], maxScore, almost: levelFor(maxScore - 1), full: levelFor(maxScore), ascending: t.every((v, i) => i === 0 || v > t[i - 1]),
      forestReachable: levelFor(meadowScore) >= need.villageLevel && meadowIds.length >= need.discoveredSpecies, meadowLevel: levelFor(meadowScore) };
  });
  check('6-4 마을 4단계 = 모든 시설 + 전체 종족 발견(하나라도 모자라면 3단계)', balance.top === balance.maxScore && balance.full === 4 && balance.almost === 3 && balance.ascending, JSON.stringify(balance));
  check('6-4 숲 개방 조건은 초원만으로 채울 수 있음(막힘 없음)', balance.forestReachable, JSON.stringify(balance));
  // 그림 파일: 펫 15종은 assets/pets, 시설 6종은 assets/buildings의 그림으로 그린다.
  const sprite = await page.evaluate(async () => {
    const out = {};
    const ids = Object.keys(SPECIES); const types = Object.keys(BUILDING_TYPES);
    out.allPetsHaveImage = ids.every(id => SPECIES[id].image === `assets/pets/${id}.png`);
    out.notLoaded = ids.filter(id => !readySprite(`pet:${id}`));
    out.wrongSize = ids.filter(id => { const img = readySprite(`pet:${id}`); return !img || img.naturalWidth !== 28 || img.naturalHeight !== 28; });
    out.allBuildingsHaveImage = types.every(type => BUILDING_TYPES[type].image === `assets/buildings/${type}.png`);
    out.buildingNotLoaded = types.filter(type => !readySprite(`building:${type}`));
    out.buildingWrongSize = types.filter(type => { const img = readySprite(`building:${type}`); return !img || img.naturalWidth !== 60 || img.naturalHeight !== 50; });
    out.resourceWrong = Object.keys(RESOURCES).filter(k => { const img = readySprite(`resource:${k}`); return RESOURCES[k].image !== `assets/resources/${k}.png` || !img || img.naturalWidth !== 24 || img.naturalHeight !== 24; });
    out.decorWrong = Object.keys(DECOR_IMAGES).filter(k => { const img = readySprite(`decor:${k}`); const size = { tree: 32, pine: 32, bush: 22, flowers: 18, rock: 18, egg: 12 }[k]; return DECOR_IMAGES[k] !== `assets/decor/${k}.png` || !img || img.naturalWidth !== size || img.naturalHeight !== size; });
    // 그림 교체 규칙: image를 적은 항목만 그림으로 그리고, 없거나 불러오지 못하면 임시 그림으로 그린다.
    const real = { bun: SPECIES.sproutbun.image, lamb: SPECIES.pebblelamb.image, otter: SPECIES.dewotter.image, farm: BUILDING_TYPES.farm.image, quarry: BUILDING_TYPES.quarry.image, plaza: BUILDING_TYPES.plaza.image };
    const c = document.createElement('canvas'); c.width = 8; c.height = 8; c.getContext('2d').fillRect(0, 0, 8, 8);
    Object.keys(sprites).forEach(k => delete sprites[k]);
    SPECIES.sproutbun.image = c.toDataURL(); BUILDING_TYPES.farm.image = c.toDataURL(); SPECIES.pebblelamb.image = 'data:image/png;base64,broken'; delete SPECIES.dewotter.image;
    BUILDING_TYPES.plaza.image = 'data:image/png;base64,broken'; delete BUILDING_TYPES.quarry.image;
    loadSprites(); await new Promise(r => setTimeout(r, 400));
    out.petReady = !!readySprite('pet:sproutbun'); out.buildingReady = !!readySprite('building:farm'); out.brokenFallsBack = readySprite('pet:pebblelamb') === null; out.missingFallsBack = readySprite('pet:dewotter') === null;
    out.buildingBrokenFallsBack = readySprite('building:plaza') === null; out.buildingMissingFallsBack = readySprite('building:quarry') === null;
    try { drawVillage(); out.drawOk = true; } catch (e) { out.drawOk = false; out.error = e.message; }
    // 원래 상태로 되돌리고 그림을 다시 불러온다.
    SPECIES.sproutbun.image = real.bun; SPECIES.pebblelamb.image = real.lamb; SPECIES.dewotter.image = real.otter;
    BUILDING_TYPES.farm.image = real.farm; BUILDING_TYPES.quarry.image = real.quarry; BUILDING_TYPES.plaza.image = real.plaza;
    Object.keys(sprites).forEach(k => delete sprites[k]);
    loadSprites(); await new Promise(r => setTimeout(r, 400));
    out.restored = ids.every(id => readySprite(`pet:${id}`)) && types.every(type => readySprite(`building:${type}`))
      && Object.keys(RESOURCES).every(k => readySprite(`resource:${k}`)) && Object.keys(DECOR_IMAGES).every(k => readySprite(`decor:${k}`));
    drawVillage();
    return out;
  });
  check('6-4 펫 그림: 15종 모두 그림 파일(28×28)을 불러옴', sprite.allPetsHaveImage && sprite.notLoaded.length === 0 && sprite.wrongSize.length === 0, JSON.stringify({ notLoaded: sprite.notLoaded, wrongSize: sprite.wrongSize }));
  check('6-4 시설 그림: 6종 모두 그림 파일(60×50)을 불러옴', sprite.allBuildingsHaveImage && sprite.buildingNotLoaded.length === 0 && sprite.buildingWrongSize.length === 0, JSON.stringify({ notLoaded: sprite.buildingNotLoaded, wrongSize: sprite.buildingWrongSize }));
  check('6-6 자원 그림 4종(24×24)·장식 그림 6종(나무 32, 덤불 22, 꽃·바위 18, 알 12)을 불러옴', sprite.resourceWrong.length === 0 && sprite.decorWrong.length === 0, JSON.stringify({ resource: sprite.resourceWrong, decor: sprite.decorWrong }));
  check('6-4 그림 교체 규칙: image를 적은 항목만 그림으로 그리고, 없거나 실패하면 임시 그림(펫·시설 모두)', sprite.petReady && sprite.buildingReady && sprite.brokenFallsBack && sprite.missingFallsBack && sprite.buildingBrokenFallsBack && sprite.buildingMissingFallsBack && sprite.drawOk && sprite.restored, JSON.stringify(sprite));
  // 그림이 실제로 화면에 그려지는지: 마을을 한 번 그릴 때 펫·시설·장식·알·배경이 각자 자기 그림으로 그려져야 한다.
  // (파일로 직접 열면 브라우저가 캔버스 픽셀 읽기를 막으므로, 그리기 호출을 기록하는 방식으로 확인한다.)
  const drawn = await page.evaluate(() => {
    const realEggs = game.eggs;
    game.eggs = [{ id: 'egg_test', remainingSeconds: 50, result: { speciesId: 'sproutbun', traits: [], look: null, name: '싹총이' } }];
    const originalDraw = ctx.drawImage, originalText = ctx.fillText; const log = [];
    ctx.drawImage = function (image, ...rest) { log.push({ kind: 'image', image, rest }); return originalDraw.call(this, image, ...rest); };
    ctx.fillText = function (text, ...rest) { log.push({ kind: 'text', text: String(text) }); return originalText.call(this, text, ...rest); };
    try { drawVillage(); } finally { ctx.drawImage = originalDraw; ctx.fillText = originalText; }
    game.eggs = realEggs;
    const images = log.filter(e => e.kind === 'image').map(e => e.image);
    const countOf = (img) => images.filter(i => i === img).length;
    const petSources = game.pets.map(p => petSpriteFor(p));
    const decor = decorPlacements();
    const decorCounts = {}; decor.forEach(d => { decorCounts[d.kind] = (decorCounts[d.kind] || 0) + 1; });
    const lastPet = Math.max(...petSources.map(src => log.map((e, i) => e.kind === 'image' && e.image === src ? i : -1).reduce((a, b) => Math.max(a, b), -1)));
    const labelIdx = game.buildings.map(b => log.findIndex(e => e.kind === 'text' && e.text === BUILDING_TYPES[b.type].name));
    return {
      pets: game.pets.length, petsOk: [...new Set(petSources)].every(src => src && countOf(src) === petSources.filter(s => s === src).length),
      buildings: game.buildings.length, buildingsOk: game.buildings.every(b => countOf(readySprite(`building:${b.type}`)) === game.buildings.filter(o => o.type === b.type).length),
      background: images[0] === backgroundLayer.canvas && countOf(backgroundLayer.canvas) === 1,
      decor: decor.length, decorOk: decor.length >= 8 && Object.entries(decorCounts).every(([kind, n]) => countOf(readySprite(`decor:${kind}`)) === n),
      eggOk: countOf(readySprite('decor:egg')) === 1,
      labelsAfterPets: labelIdx.every(i => i > lastPet), total: images.length,
      // 펫·시설·장식·알은 모두 그림 크기의 정확히 2배로 그린다(한 점 = 화면 2칸)
      doubled: log.filter(e => e.kind === 'image' && e.image !== backgroundLayer.canvas).every(e => {
        const w = e.image.naturalWidth || e.image.width, h = e.image.naturalHeight || e.image.height;
        return Math.abs(e.rest[2] - w * 2) < .01 && Math.abs(e.rest[3] - h * 2) < .01;
      })
    };
  });
  check('6-4 펫 그림이 마을 화면에 그려짐(펫마다 한 번)', drawn.petsOk, JSON.stringify(drawn));
  check('6-4 시설 그림이 마을 화면에 그려짐(시설마다 한 번)', drawn.buildingsOk, JSON.stringify(drawn));
  check('6-6 장식(나무·덤불·꽃·바위)과 알이 그림으로 그려짐', drawn.decorOk && drawn.eggOk, JSON.stringify(drawn));
  check('6-6 풀밭·길 배경은 한 번 만든 그림을 맨 먼저 한 번만 그림', drawn.background, JSON.stringify(drawn));
  check('6-6 시설 이름표는 펫보다 나중에 그려 가리지 않음', drawn.labelsAfterPets, JSON.stringify(drawn));
  check('6-7 펫·시설·장식·알을 모두 그림 크기의 2배로 그림(점 크기 통일)', drawn.doubled, JSON.stringify(drawn));
  const scene = await page.evaluate(() => {
    const out = {};
    // 배경: 1/4 크기 그림을 4배로 키워 그린다. 같은 그림을 재사용하고, 다시 만들어도 같은 모양이다.
    const first = backgroundLayer; drawVillage(); out.reused = backgroundLayer === first;
    out.size = [first.cols, first.rows, first.canvas.width, first.canvas.height];
    const again = buildBackground(); out.sameShape = again.path.length === first.path.length && again.path.every((v, i) => v === first.path[i]);
    out.pathShare = first.path.reduce((a, b) => a + b, 0) / first.path.length;
    // 장식은 길·지어진 시설과 겹치지 않는다.
    const w = canvas.width, h = canvas.height; const decor = decorPlacements();
    out.decorOnPath = decor.filter(d => isOnPathPixel(d.x, d.y)).length;
    out.decorOnBuilding = decor.filter(d => game.buildings.some(b => Math.abs(b.x * w - d.x) < 64 && d.y > b.y * h - 80 && d.y < b.y * h + 60)).length;
    // 시설을 새로 지으면 그 자리의 장식이 사라진다(규칙은 건드리지 않고 그리기만 확인).
    const spot = decor.find(d => d.kind === 'tree' || d.kind === 'pine');
    const fake = { id: 'b_test', type: 'lumber', x: spot.x / w, y: (spot.y - 20) / h, level: 1 };
    game.buildings.push(fake); out.clearedForBuilding = !decorPlacements().some(d => d.x === spot.x && d.y === spot.y); game.buildings.pop();
    return out;
  });
  check('6-6 배경: 1/4 크기(240×150) 픽셀 그림을 재사용, 다시 만들어도 같은 모양', scene.reused && scene.size.join() === '240,150,240,150' && scene.sameShape && scene.pathShare > .05 && scene.pathShare < .2, JSON.stringify(scene));
  check('6-6 장식은 길·시설과 겹치지 않고, 시설을 지으면 그 자리 장식이 사라짐', scene.decorOnPath === 0 && scene.decorOnBuilding === 0 && scene.clearedForBuilding, JSON.stringify(scene));
  const motion = await page.evaluate(() => {
    const pet = game.pets[0]; const saved = { moving: pet.moving, bob: pet.bob, energy: pet.energy, work: pet.workBuildingId, resting: pet.resting };
    petEffects.clear(); pet.workBuildingId = null; pet.resting = false; pet.energy = pet.maxEnergy;
    const sample = () => { const poses = []; for (let i = 0; i < 40; i++) { pet.bob = i * .13; poses.push(petPose(pet)); } return poses; };
    pet.moving = true; const walk = sample();
    pet.moving = false; const idle = sample();
    pet.energy = 1; const rest = sample();
    Object.assign(pet, { moving: saved.moving, bob: saved.bob, energy: saved.energy, workBuildingId: saved.work, resting: saved.resting });
    const range = (list, key) => Math.max(...list.map(p => p[key])) - Math.min(...list.map(p => p[key]));
    return { walkHop: range(walk, 'offsetY'), walkTilt: range(walk, 'tilt'), walkUp: walk.every(p => p.offsetY <= 0), idleTilt: range(idle, 'tilt'), restHop: range(rest, 'offsetY'), restTilt: range(rest, 'tilt'), restBreath: range(rest, 'squash') };
  });
  check('6-6 걷는 펫은 통통 튀고 기우뚱, 서 있거나 쉬는 펫은 기울지 않음(쉬는 펫은 숨쉬기만)', motion.walkHop > 2 && motion.walkTilt > .1 && motion.walkUp && motion.idleTilt === 0 && motion.restHop === 0 && motion.restTilt === 0 && motion.restBreath > .03, JSON.stringify(motion));
  const rare = await page.evaluate(() => {
    const pet = game.pets[0]; const saved = pet.appearance; const base = readySprite(`pet:${pet.speciesId}`);
    pet.appearance = null; const plain = petSpriteFor(pet);
    pet.appearance = '특별 무늬 1'; const v1 = petSpriteFor(pet), v1again = petSpriteFor(pet);
    pet.appearance = '특별 무늬 2'; const v2 = petSpriteFor(pet);
    pet.appearance = '특별 무늬 3'; const v3 = petSpriteFor(pet);
    pet.appearance = '이상한 값'; const odd = petSpriteFor(pet);
    pet.appearance = saved;
    return { plain: plain === base, variantsDiffer: new Set([v1, v2, v3]).size === 3 && ![v1, v2, v3].includes(base), cached: v1 === v1again, sized: [v1, v2, v3].every(c => c.width === base.naturalWidth && c.height === base.naturalHeight), oddFallsBack: odd === v1, variants: [1, 2, 3, 4, 'x'].map(n => rareLookVariant(`특별 무늬 ${n}`)).join() };
  });
  check('6-6 희귀 외형: 무늬 1~3이 서로 다른 그림, 보통 펫은 원래 그림', rare.plain && rare.variantsDiffer && rare.cached && rare.sized && rare.oddFallsBack && rare.variants === '1,2,3,1,1', JSON.stringify(rare));

  // 오른쪽 메뉴와 도감의 종족 아이콘: 그림이 있으면 그림, 없거나 불러오지 못하면 이모지
  const icons = await page.evaluate(async () => {
    const out = {};
    const pet = game.pets[0]; const species = SPECIES[pet.speciesId]; const real = species.image;
    selectedPetId = pet.id; activeTab = 'pets'; renderAll();
    const cardImg = document.querySelector('.pet-card.selected .pet-avatar img.pet-sprite');
    const profileImg = document.querySelector('.pet-profile .pet-avatar img.pet-sprite');
    out.card = !!cardImg && cardImg.getAttribute('src') === real && cardImg.alt === species.icon;
    out.profile = !!profileImg && profileImg.getAttribute('src') === real;
    await new Promise(r => setTimeout(r, 200));
    out.loaded = !!cardImg && cardImg.complete && cardImg.naturalWidth === 28 && cardImg.getBoundingClientRect().width === 48;
    out.everyCard = [...document.querySelectorAll('.pet-list .pet-card')].every(card => card.querySelector('.pet-avatar img.pet-sprite'));
    activeTab = 'dex'; renderAll();
    out.found = game.discoveredSpecies.length; out.locked = document.querySelectorAll('.dex-card.locked').length;
    out.dexFound = document.querySelectorAll('.dex-card:not(.locked) .dex-icon img.pet-sprite').length === out.found;
    out.dexLocked = document.querySelectorAll('.dex-card.locked img').length === 0 && [...document.querySelectorAll('.dex-card.locked .dex-icon')].every(n => n.textContent === '❔');
    out.dexInfo = document.querySelectorAll('#panelContent .info-box img.pet-sprite.small').length === out.found;
    // 그림이 없는 종족, 불러오기에 실패한 종족은 이모지
    delete species.image; out.noImage = speciesIconHtml(pet.speciesId) === species.icon; species.image = real;
    const sprite = sprites[`pet:${pet.speciesId}`]; sprite.failed = true; out.failedSprite = speciesIconHtml(pet.speciesId) === species.icon; sprite.failed = false;
    // 화면에 넣은 그림이 깨져 있으면 그 자리에서 이모지로 바뀐다
    species.image = 'data:image/png;base64,broken'; activeTab = 'pets'; renderAll(); await new Promise(r => setTimeout(r, 400));
    const avatar = document.querySelector('.pet-card.selected .pet-avatar');
    out.brokenBecomesEmoji = avatar.textContent === species.icon && !avatar.querySelector('img');
    species.image = real; renderAll();
    out.restored = !!document.querySelector('.pet-card.selected .pet-avatar img.pet-sprite');
    return out;
  });
  check('6-5 펫 목록·펫 정보에 종족 그림 표시(28칸 그림을 48px로)', icons.card && icons.profile && icons.loaded && icons.everyCard, JSON.stringify(icons));
  check('6-5 도감: 발견한 종족은 그림, 미발견 종족은 ❔', icons.dexFound && icons.dexLocked && icons.dexInfo && icons.found > 0, JSON.stringify({ found: icons.found, locked: icons.locked }));
  check('6-5 그림이 없거나 불러오지 못한 종족은 이모지로 표시', icons.noImage && icons.failedSprite && icons.brokenBecomesEmoji && icons.restored, JSON.stringify(icons));

  // 메뉴의 시설·자원·알 그림: 그림이 있으면 그림, 없거나 불러오지 못하면 이모지
  const menuIcons = await page.evaluate(async () => {
    const out = {};
    activeTab = 'village'; ui.selectedBuildingId = getBuilding('farm').id; renderAll();
    await new Promise(r => setTimeout(r, 300));
    const loaded = (img) => !!img && img.complete && img.naturalWidth > 0;
    const cards = [...document.querySelectorAll('.build-card .build-icon')];
    out.cards = cards.length; out.cardImgs = cards.filter(n => loaded(n.querySelector('img.building-sprite'))).length;
    out.selected = loaded(document.querySelector('[data-selected-building] img.building-sprite.small'));
    const chips = [...document.querySelectorAll('.resource-chip .ico')];
    out.chips = chips.length; out.chipImgs = chips.filter(n => loaded(n.querySelector('img.resource-sprite'))).length;
    const realEggs = game.eggs;
    game.eggs = [{ id: 'egg_menu', remainingSeconds: 50, result: { speciesId: 'sproutbun', traits: [], look: null, name: '싹총이' } }];
    activeTab = 'breed'; renderAll(); await new Promise(r => setTimeout(r, 200));
    out.egg = loaded(document.querySelector('.egg-card .egg-icon img.egg-sprite'));
    game.eggs = realEggs;
    // 그림이 없거나 불러오지 못하면 이모지
    const realWood = RESOURCES.wood.image; delete RESOURCES.wood.image; out.noImage = resourceIconHtml('wood') === RESOURCES.wood.icon; RESOURCES.wood.image = realWood;
    const farmSprite = sprites['building:farm']; farmSprite.failed = true; out.failed = buildingIconHtml('farm') === BUILDING_TYPES.farm.icon; farmSprite.failed = false;
    activeTab = 'village'; ui.selectedBuildingId = null; renderAll();
    return out;
  });
  check('6-6 마을 메뉴의 시설 카드·선택한 시설에 시설 그림 표시', menuIcons.cards >= 3 && menuIcons.cardImgs === menuIcons.cards && menuIcons.selected, JSON.stringify(menuIcons));
  check('6-6 상단 자원 4종과 알 카드에 그림 표시, 그림이 없거나 실패하면 이모지', menuIcons.chips === 4 && menuIcons.chipImgs === 4 && menuIcons.egg && menuIcons.noImage && menuIcons.failed, JSON.stringify(menuIcons));

  // ---------- 7. 놓아주기 ----------
  await page.click('[data-tab="pets"]');
  const relBefore = await page.evaluate(() => { selectedPetId = game.pets[game.pets.length - 1].id; renderAll(); return game.pets.length; });
  await page.click('#releaseButton');
  check('7 놓아주기(확인 후) 펫 -1, 도감 유지', await page.evaluate((n) => game.pets.length === n - 1 && game.discoveredSpecies.length >= 3, relBefore));
  check('7 최소 2마리일 때 놓아주기 비활성', await page.evaluate(() => { game.pets = game.pets.slice(0, 2); selectedPetId = game.pets[0].id; renderAll(); return document.querySelector('#releaseButton').disabled; }));

  // ---------- 7-2. 교감(쓰다듬기·놀아주기)·이름 바꾸기·시설 누르기·종족별 희귀 외형 ----------
  await page.evaluate(() => { const pet = game.pets[0]; pet.workBuildingId = null; pet.resting = false; pet.energy = 80; selectedPetId = pet.id; activeTab = 'pets'; renderAll(); });
  const before72 = await page.evaluate(() => ({ energy: game.pets[0].energy, keys: Object.keys(game.pets[0]).sort().join(), saved: localStorage.getItem(CONFIG.saveKey).includes('petEffects') }));
  await page.click('#strokeButton');
  const stroke = await page.evaluate(() => { const pet = game.pets[0]; const fx = activePetEffect(pet.id); drawVillage(); return { type: fx && fx.type, energy: pet.energy, keys: Object.keys(pet).sort().join(), msg: game.message, x: pet.x, y: pet.y }; });
  await page.waitForTimeout(700);
  const strokeStill = await page.evaluate(() => ({ x: game.pets[0].x, y: game.pets[0].y }));
  check('7-2 쓰다듬기: 연출 시작, 에너지·저장 항목 변화 없음(수치 없음)', stroke.type === 'stroke' && stroke.energy === before72.energy && stroke.keys === before72.keys && stroke.msg.includes('기분 좋아해요'), JSON.stringify(stroke));
  check('7-2 쓰다듬는 동안 제자리에 머묾', Math.hypot(stroke.x - strokeStill.x, stroke.y - strokeStill.y) < 0.02, JSON.stringify([stroke, strokeStill]));
  await page.waitForTimeout(1200);
  check('7-2 쓰다듬기 연출은 잠시 뒤 끝남', await page.evaluate(() => activePetEffect(game.pets[0].id) === null));
  await page.click('#playButton');
  const play0 = await page.evaluate(() => { const pet = game.pets[0]; const fx = activePetEffect(pet.id); return { type: fx && fx.type, energy: pet.energy, x: pet.x, y: pet.y, savedEnergy: JSON.parse(localStorage.getItem(CONFIG.saveKey)).pets[0].energy }; });
  await page.waitForTimeout(1500);
  const play1 = await page.evaluate(() => ({ x: game.pets[0].x, y: game.pets[0].y }));
  check('7-2 놀아주기: 에너지 -5(저장됨) + 연출 시작', play0.type === 'play' && play0.energy === before72.energy - 5 && play0.savedEnergy === before72.energy - 5, JSON.stringify(play0));
  check('7-2 놀아주는 동안 평소보다 빠르게 뛰어다님', Math.hypot(play0.x - play1.x, play0.y - play1.y) > 0.11 * 1.5 * 1.2 || await page.evaluate(() => CONFIG.playSpeedMultiplier > 1 && game.pets[0].moving), JSON.stringify([play0, play1]));
  const playBlocked = await page.evaluate(() => {
    const pet = game.pets[0]; petEffects.clear();
    pet.workBuildingId = getBuilding('farm').id; pet.energy = 80; playWithSelectedPet(); const working = { energy: pet.energy, fx: activePetEffect(pet.id) };
    pet.workBuildingId = null; pet.energy = 10; playWithSelectedPet(); const tired = { energy: pet.energy, fx: activePetEffect(pet.id) };
    pet.energy = 80; return { working, tired, noStat: !('affection' in pet) && !('friendship' in pet) && !('intimacy' in pet) };
  });
  check('7-2 작업 중이거나 지친 펫과는 놀 수 없음(에너지 변화 없음)', playBlocked.working.energy === 80 && !playBlocked.working.fx && playBlocked.tired.energy === 10 && !playBlocked.tired.fx && playBlocked.noStat, JSON.stringify(playBlocked));
  // 이름 바꾸기
  await page.evaluate(() => renderAll());
  await page.fill('#petNameInput', '  뭉치<b>  ');
  await page.waitForTimeout(1200);   // 매초 갱신에도 입력 중인 글자가 유지되는지
  check('7-2 입력 중인 이름이 매초 갱신에도 유지됨', (await page.inputValue('#petNameInput')) === '  뭉치<b>  ');
  await page.click('#renameButton');
  const renamedPet = await page.evaluate(() => ({ name: game.pets[0].name, saved: JSON.parse(localStorage.getItem(CONFIG.saveKey)).pets[0].name, html: document.querySelector('.pet-profile strong').innerHTML, card: document.querySelector('.pet-card.selected .pet-name').textContent, injected: !!document.querySelector('.pet-profile b, .pet-card b') }));
  check('7-2 이름 바꾸기: 앞뒤 공백 제거, 저장, 화면 반영, 특수문자 안전 처리', renamedPet.name === '뭉치<b>' && renamedPet.saved === '뭉치<b>' && renamedPet.card.includes('뭉치<b>') && !renamedPet.injected, JSON.stringify(renamedPet));
  const nameRules = await page.evaluate(() => {
    const input = document.querySelector('#petNameInput'); const pet = game.pets[0];
    input.value = '   '; renameSelectedPet(); const empty = pet.name;
    document.querySelector('#petNameInput').value = '가나다라마바사아자차카타파하'; renameSelectedPet(); const long = pet.name;
    return { empty, long, max: CONFIG.maxPetNameLength, attr: document.querySelector('#petNameInput').maxLength };
  });
  check('7-2 빈 이름 거부, 최대 10자로 자름', nameRules.empty === '뭉치<b>' && nameRules.long === '가나다라마바사아자차' && nameRules.long.length === nameRules.max && nameRules.attr === nameRules.max, JSON.stringify(nameRules));
  await page.click('[data-tab="breed"]');
  check('7-2 바꾼 이름이 교배 탭 부모 목록에도 표시', (await page.textContent('#parentA')).includes('가나다라마바사아자차'));
  // 이름을 바꾼 펫은 종족 이름을 함께 표시 (이름만으로는 종족을 알 수 없으므로)
  const speciesShown = await page.evaluate(() => {
    const pet = game.pets[0], other = game.pets[1]; const species = SPECIES[pet.speciesId];
    const option = document.querySelector(`[data-parent-option="${pet.id}"]`).textContent;
    const otherOption = document.querySelector(`[data-parent-option="${other.id}"]`).textContent;
    selectedPetId = pet.id; activeTab = 'pets'; renderAll();
    const out = { speciesName: species.name, element: elementNames(species), option, otherOption, otherName: other.name, otherElement: elementNames(SPECIES[other.speciesId]),
      profile: document.querySelector('.pet-profile-head small').textContent, card: document.querySelector('.pet-card.selected .pet-detail').textContent,
      otherCard: document.querySelector(`.pet-card[data-pet-id="${other.id}"] .pet-detail`).textContent };
    selectedPetId = other.id; renderAll(); out.otherProfile = document.querySelector('.pet-profile-head small').textContent;
    selectedPetId = pet.id; activeTab = 'breed'; renderAll();
    return out;
  });
  check('7-2 이름을 바꾼 펫: 펫 정보·목록·교배 부모 목록에 종족 이름 표시', speciesShown.profile.startsWith(speciesShown.speciesName + ' · ') && speciesShown.card.startsWith(speciesShown.speciesName + ' · ') && speciesShown.option.startsWith(`가나다라마바사아자차(${speciesShown.speciesName}) · ${speciesShown.element} · `), JSON.stringify(speciesShown));
  check('7-2 이름을 바꾸지 않은 펫: 종족 이름을 두 번 적지 않음', speciesShown.otherCard.startsWith(speciesShown.otherElement + ' · ') && !speciesShown.otherProfile.includes(speciesShown.otherName) && speciesShown.otherOption.startsWith(`${speciesShown.otherName} · ${speciesShown.otherElement} · `), JSON.stringify(speciesShown));
  // 안내 문구의 조사(이/가, 을/를, 으로/로)
  const particles = await page.evaluate(() => {
    const out = { cases: [withParticle('몽양이', '이', '가'), withParticle('도토람', '이', '가'), withParticle('연구리', '을', '를'), withParticle('벌목장', '을', '를'), withParticle('숲', '으로', '로'), withParticle('콩알', '으로', '로'), withParticle('콩이', '으로', '로'), withParticle('Max', '이', '가'), withParticle('뭉치<b>', '으로', '로')] };
    const pet = game.pets[0]; const realName = pet.name; const realMessage = game.message;
    pet.name = '콩이'; selectedPetId = pet.id; strokeSelectedPet(); out.vowel = game.message;
    pet.name = '도토람'; strokeSelectedPet(); out.consonant = game.message;
    pet.name = realName; petEffects.clear(); game.message = realMessage; refreshLive();
    return out;
  });
  check('7-3 조사: 받침에 따라 이/가·을/를·으로/로를 고름(한글이 아니면 둘 다 표시)', particles.cases.join() === '몽양이가,도토람이,연구리를,벌목장을,숲으로,콩알로,콩이로,Max이(가),뭉치<b>(으)로', particles.cases.join());
  check('7-3 안내 문구에 조사가 자연스럽게 붙음', particles.vowel === '콩이가 기분 좋아해요.' && particles.consonant === '도토람이 기분 좋아해요.', JSON.stringify([particles.vowel, particles.consonant]));
  // 시설 누르기
  const farmPoint = await page.evaluate(() => { const b = getBuilding('farm'); game.pets.forEach(p => { p.workBuildingId = null; p.x = .5; p.y = .12; p.targetX = .5; p.targetY = .12; }); game.pets[1].workBuildingId = b.id; game.pets[1].energy = 100; game.pets[1].resting = false; const r = canvas.getBoundingClientRect(); return { id: b.id, x: r.left + b.x * r.width, y: r.top + (b.y - .03) * r.height, worker: game.pets[1].name }; });
  await page.mouse.click(farmPoint.x, farmPoint.y);
  const bsel = await page.evaluate(() => ({ tab: activeTab, id: ui.selectedBuildingId, text: document.querySelector('[data-selected-building]')?.textContent || '', workers: [...document.querySelectorAll('[data-selected-building] ~ .pet-list .pet-name')].map(n => n.textContent), firstList: document.querySelector('[data-selected-building] + .pet-list .pet-name')?.textContent || '' }));
  check('7-2 마을 그림에서 시설을 누르면 마을 탭에 시설 정보 표시', bsel.tab === 'village' && bsel.id === farmPoint.id && bsel.text.includes('농장') && bsel.text.includes('생산: 🌿 식물') && bsel.text.includes('적성 속성: 풀, 물') && bsel.text.includes('작업 펫 1/2마리'), bsel.text);
  check('7-2 선택한 시설에 배치된 펫 표시', bsel.firstList.includes(farmPoint.worker), JSON.stringify(bsel.firstList));
  const nurseryPoint = await page.evaluate(() => { const b = getBuilding('nursery'); const r = canvas.getBoundingClientRect(); return { x: r.left + b.x * r.width, y: r.top + (b.y - .03) * r.height }; });
  await page.mouse.click(nurseryPoint.x, nurseryPoint.y);
  check('7-2 교배장을 누르면 알 개수 표시', (await page.textContent('[data-selected-building]')).includes('부화 대기 중인 알'));
  const petOver = await page.evaluate(() => { const b = getBuilding('farm'); const p = game.pets[0]; p.x = b.x; p.y = b.y; p.targetX = b.x; p.targetY = b.y; const r = canvas.getBoundingClientRect(); return { id: p.id, x: r.left + b.x * r.width, y: r.top + b.y * r.height }; });
  await page.mouse.click(petOver.x, petOver.y);
  check('7-2 시설 위에 펫이 있으면 펫 선택이 우선', await page.evaluate((id) => selectedPetId === id && activeTab === 'pets', petOver.id));
  // 종족별 희귀 외형
  const looks = await page.evaluate(() => {
    const before = game.discoveredLooks.length;
    game.eggs.push({ id: 'egg_look1', remainingSeconds: 1, result: { speciesId: 'dewotter', traits: ['smart'], look: '특별 무늬 2', name: SPECIES.dewotter.name } },
                   { id: 'egg_look2', remainingSeconds: 1, result: { speciesId: 'dewotter', traits: ['smart'], look: '특별 무늬 1', name: SPECIES.dewotter.name } },
                   { id: 'egg_look3', remainingSeconds: 1, result: { speciesId: 'dewotter', traits: ['smart'], look: '특별 무늬 2', name: SPECIES.dewotter.name } });
    simulateSeconds(2); activeTab = 'dex'; renderAll();
    const copy = JSON.parse(JSON.stringify(game)); delete copy.discoveredLooksBySpecies;
    const rebuilt = normalizeGame(copy).discoveredLooksBySpecies;
    const copy2 = JSON.parse(JSON.stringify(game)); copy2.discoveredLooksBySpecies = { ghost: ['x'], dewotter: ['특별 무늬 3', 5, '특별 무늬 3'], sproutbun: 'bad' };
    return { by: game.discoveredLooksBySpecies.dewotter, global: game.discoveredLooks.length >= before, panel: document.querySelector('#panelContent').textContent, rebuilt: rebuilt.dewotter, fixed: normalizeGame(copy2).discoveredLooksBySpecies };
  });
  check('7-2 희귀 외형을 종족별로 기록(중복 제외) + 도감 표시', looks.by.length === 2 && looks.by.slice().sort().join() === '특별 무늬 1,특별 무늬 2' && looks.global && looks.panel.includes('✦ 희귀 외형 2/3: 특별 무늬 1, 특별 무늬 2') && looks.panel.includes('· ✦2'), JSON.stringify(looks.by));
  check('7-2 예전 저장(종족별 기록 없음)은 데리고 있는 펫의 외형으로 채움, 잘못된 값 보정', looks.rebuilt.slice().sort().join() === '특별 무늬 1,특별 무늬 2' && !looks.fixed.ghost && looks.fixed.dewotter.slice().sort().join() === '특별 무늬 1,특별 무늬 2,특별 무늬 3', JSON.stringify(looks.fixed));
  await page.evaluate(() => { game.pets[0].name = SPECIES[game.pets[0].speciesId].name; ui.selectedBuildingId = null; activeTab = 'pets'; renderAll(); });

  // ---------- 8. 버튼 연결 ----------
  await page.click('#helpButton'); const open = await page.evaluate(() => document.querySelector('#helpDialog').open);
  await page.click('#closeHelp'); const closed = await page.evaluate(() => !document.querySelector('#helpDialog').open);
  check('8 도움말 열기/닫기', open && closed);
  for (const tab of ['village', 'pets', 'breed', 'dex']) { await page.click(`[data-tab="${tab}"]`); check(`8 탭 전환: ${tab}`, await page.evaluate((t) => activeTab === t && document.querySelector('.tab.active').dataset.tab === t, tab)); }

  // ---------- 9. 새로고침 유지 ----------
  await page.evaluate(() => { game.pets.forEach(p => { p.energy = p.maxEnergy; }); game.pets[0].workBuildingId = getBuilding('farm').id; activeTab = 'breed'; renderAll(); });
  await page.click('#breedButton');
  await page.waitForTimeout(300);
  const snap = () => page.evaluate(() => ({ pets: game.pets.map(p => [p.id, p.speciesId, p.traits.join(), p.workBuildingId]), res: Object.values(game.resources).map(Math.floor), buildings: game.buildings.map(b => b.type), eggs: game.eggs.map(e => e.id), dex: game.discoveredSpecies, looks: game.discoveredLooks, v: game.version }));
  const s1 = await snap();
  await page.reload(); await page.waitForTimeout(400);
  const s2 = await snap();
  check('9 새로고침 후 펫·자원·건물·알·도감 유지', JSON.stringify(s1) === JSON.stringify(s2), JSON.stringify(s2).slice(0, 160));
  check('9 새로고침 후 시설 레벨 유지(벌목장 3, 채굴장 2, 농장 1)', await page.evaluate(() => getBuilding('lumber').level === 3 && getBuilding('quarry').level === 2 && getBuilding('farm').level === 1));
  check('9 새로고침 후 개방한 지역 유지', await page.evaluate(() => JSON.stringify(game.unlockedRegions) === '["meadow","forest"]'));
  check('9 저장 데이터 버전 필드 유지', s2.v === 1 && await page.evaluate(() => JSON.parse(localStorage.getItem(CONFIG.saveKey)).version === 1));

  // ---------- 10. 오프라인 진행 (게임을 끄고 1시간 뒤 다시 열기) ----------
  const offBefore = await page.evaluate(() => { game.pets[0].energy = 100; game.pets[0].resting = false; game.pets[0].productionProgress = 0; game.pets[0].yieldProgress = 0; game.pets[1].workBuildingId = null; game.eggs = []; saveGame(); return { plant: game.resources.plant, tick: game.lastTickAt }; });
  await page.close();
  await ctx.addInitScript(clockScript(3600000));  // 새로고침으로 시계 오프셋이 0으로 돌아간 상태에서 +1시간
  page = await ctx.newPage(); watch(page); page.on('dialog', d => d.accept());
  await page.goto(URL); await page.waitForTimeout(500);
  const off1 = await page.evaluate(() => ({ plant: game.resources.plant, energy: game.pets[0].energy, toast: document.querySelector('#toastRegion').textContent }));
  // 100→25까지 38회 생산(=38분) 후 휴식 22분(+44 → 68)
  check('10 오프라인 1시간: 생산이 에너지 한도까지만 반영', off1.plant - offBefore.plant === Math.floor(38 * 1.35) && off1.energy === 68, JSON.stringify({ gain: off1.plant - offBefore.plant, energy: off1.energy }));
  check('10 오프라인 요약 알림', off1.toast.includes('자리를 비운') && off1.toast.includes('🌿+'), off1.toast);
  await page.reload(); await page.waitForTimeout(500);
  const off2 = await page.evaluate(() => game.resources.plant);
  check('10 다시 새로고침해도 오프라인 시간이 중복 적용되지 않음', off2 === off1.plant, `${off1.plant} → ${off2}`);
  // 48시간 → 24시간 상한
  await page.evaluate(() => { game.pets.forEach(p => { p.workBuildingId = null; p.energy = 0; }); game.lastTickAt = Date.now() - 48 * 3600 * 1000; game.eggs = [{ id: 'e1', remainingSeconds: 25 * 3600, result: { speciesId: 'sproutbun', traits: ['sturdy'], look: null, name: '새싹토끼' } }]; localStorage.setItem(CONFIG.saveKey, JSON.stringify(game)); window.removeEventListener; });
  await page.evaluate(() => { window.__skipSave = true; });
  // beforeunload가 덮어쓰지 않도록 저장본을 따로 보관했다가 복원
  const raw = await page.evaluate(() => localStorage.getItem(CONFIG.saveKey));
  await page.close();
  page = await ctx.newPage(); watch(page);
  await page.addInitScript((raw) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('little-haven-save-v1', raw.replace(/"lastSavedAt":\d+/, '"lastSavedAt":1')); sessionStorage.setItem('seeded', '1'); } }, raw.replace(/"lastTickAt":\d+/, `"lastTickAt":${Date.now() + 3600000 - 48 * 3600 * 1000}`));
  await page.goto(URL); await page.waitForTimeout(500);
  const capRes = await page.evaluate(() => ({ eggLeft: game.eggs[0]?.remainingSeconds, toast: document.querySelector('#toastRegion').textContent, tickGap: Date.now() - game.lastTickAt }));
  check('10 48시간 부재 → 24시간까지만 반영', Math.abs(capRes.eggLeft - 3600) <= 2 && capRes.toast.includes('최대 24시간'), JSON.stringify(capRes));
  check('10 반영 후 기준 시각이 현재로 맞춰짐', capRes.tickGap < 2000);

  // ---------- 11. 초기화 ----------
  await page.evaluate(() => { window.confirm = () => true; });
  await page.click('#resetButton');
  check('11 초기화 버튼 → 새 마을', await page.evaluate(() => game.pets.length === 2 && game.eggs.length === 0 && game.buildings.length === 3 && game.resources.wood === 30));
  await ctx.close();

  // ---------- 12. v0.1 저장 데이터 호환 + 손상 데이터 ----------
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const oldSave = { version: 1, createdAt: 1, lastSavedAt: Date.now(), lastTickAt: Date.now(), resources: { wood: 5, stone: 7, plant: 9, ore: 1 },
    buildings: [{ id: 'b1', type: 'plaza', x: .5, y: .48, level: 1 }, { id: 'b2', type: 'nursery', x: .73, y: .35, level: 1 }, { id: 'b3', type: 'farm', x: .28, y: .68, level: 1 }],
    pets: [{ id: 'p1', speciesId: 'sproutbun', name: '새싹토끼', traits: ['curious'], energy: 60, maxEnergy: 100, workBuildingId: 'b3', productionProgress: 30, restProgress: 0, yieldProgress: .35, appearance: null, x: .3, y: .3, targetX: .4, targetY: .4, direction: 1, moving: true, bob: 1 },
           { id: 'p2', speciesId: 'pebblelamb', name: '몽돌양', traits: ['sturdy'], energy: 100, maxEnergy: 100, workBuildingId: null, productionProgress: 0, restProgress: 0, yieldProgress: 0, appearance: '특별 무늬 2', x: .6, y: .6, targetX: .5, targetY: .5, direction: -1, moving: true, bob: 2 }],
    eggs: [{ id: 'e1', createdAt: 1, remainingSeconds: 100, result: { speciesId: 'dewotter', traits: ['smart'], look: null, name: '이슬수달' } }],
    discoveredSpecies: ['sproutbun', 'pebblelamb'], discoveredLooks: ['특별 무늬 2'], villageLevel: 1, totalDiscoveries: 2, message: '테스트' };
  page = await ctx.newPage(); watch(page);
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('little-haven-save-v1', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(oldSave));
  await page.goto(URL); await page.waitForTimeout(400);
  const old = await page.evaluate(() => ({ res: game.resources, pets: game.pets.map(p => [p.id, p.workBuildingId, p.energy, p.appearance]), eggs: game.eggs.length, looks: game.discoveredLooks, state: petStateLabel(game.pets[0]) }));
  check('12 v0.1 저장 데이터 그대로 불러오기', old.res.wood === 5 && old.pets[0][1] === 'b3' && old.pets[1][3] === '특별 무늬 2' && old.eggs === 1 && old.looks.length === 1 && old.state === '작업 중', JSON.stringify(old));
  const renamed = await page.evaluate(() => ({ pets: game.pets.map(p => p.name), egg: game.eggs[0].result.name, now: [SPECIES.sproutbun.name, SPECIES.pebblelamb.name, SPECIES.dewotter.name],
    legacyOk: Object.entries(LEGACY_SPECIES_NAMES).every(([id, names]) => SPECIES[id] && names.length > 0 && !names.includes(SPECIES[id].name)),
    kept: currentPetName('sproutbun', '내가 지은 이름') }));
  check('12 예전 저장의 옛 종족 이름(새싹토끼·몽돌양·이슬수달)이 지금 이름으로 바뀜(펫·알)', renamed.pets[0] === renamed.now[0] && renamed.pets[1] === renamed.now[1] && renamed.egg === renamed.now[2] && !renamed.pets.concat(renamed.egg).some(n => ['새싹토끼', '몽돌양', '이슬수달'].includes(n)) && renamed.legacyOk, JSON.stringify(renamed));
  check('12 옛 종족 이름이 아닌 이름은 그대로 유지', renamed.kept === '내가 지은 이름');
  check('12 지역 정보가 없는 예전 저장은 초원만 개방된 상태로 불러옴', await page.evaluate(() => JSON.stringify(game.unlockedRegions) === '["meadow"]' && game.resources.wood === 5));
  await ctx.close();
  // 숲은 이미 열었지만 선물을 받은 기록이 없는 저장(숲 종족 추가 이전 저장) → 열 때 선물 지급, 한 번만
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await ctx.newPage(); watch(page);
  await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('little-haven-save-v1', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify({ ...oldSave, unlockedRegions: ['meadow', 'forest'] }));
  await page.goto(URL); await page.waitForTimeout(400);
  const retro = await page.evaluate(() => ({ pets: game.pets.map(p => p.speciesId), given: game.regionGiftsGiven, dex: game.discoveredSpecies.includes('mossbear') }));
  await page.reload(); await page.waitForTimeout(400);
  const retro2 = await page.evaluate(() => game.pets.length);
  check('12 숲을 이미 연 예전 저장: 열 때 끼고미 소급 지급, 다시 열어도 중복 지급 없음', retro.pets.length === 3 && retro.pets[2] === 'mossbear' && retro.given.includes('forest') && retro.dex && retro2 === 3, JSON.stringify({ retro, retro2 }));
  await ctx.close();
  for (const [label, bad] of [['깨진 JSON', '{oops'], ['빈 객체', '{}'], ['값 손상', JSON.stringify({ ...oldSave, resources: { wood: null, stone: 'x', plant: -5 }, buildings: [{ type: 'farm' }, { type: 'ghost' }], pets: [{ speciesId: 'sproutbun', workBuildingId: 'nope', energy: 'a', traits: ['zzz', 'smart', 'smart'], productionProgress: 9999 }, { speciesId: 'unknown' }], eggs: [{ result: { speciesId: 'nope' } }, null], discoveredSpecies: null })]]) {
    ctx = await browser.newContext(); page = await ctx.newPage(); const e2 = []; page.on('pageerror', x => e2.push(x.message));
    await page.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('little-haven-save-v1', s); sessionStorage.setItem('seeded', '1'); } }, bad);
    await page.goto(URL); await page.waitForTimeout(1300);
    const st = await page.evaluate(() => ({ pets: game.pets.length, res: game.resources, ok: Object.values(game.resources).every(v => Number.isFinite(v) && v >= 0), dex: game.discoveredSpecies.length, work: game.pets[0].workBuildingId, traits: game.pets[0].traits }));
    check(`12 손상된 저장(${label})에서도 오류 없이 시작`, e2.length === 0 && st.pets >= 1 && st.ok && st.dex >= 1, JSON.stringify(st).slice(0, 150) + ' ' + e2.join('|'));
    await ctx.close();
  }

  // ---------- 13. 화면 크기 ----------
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['laptop', { width: 1100, height: 700 }], ['wide-short', { width: 1600, height: 620 }], ['tablet', { width: 768, height: 1024 }], ['mobile', { width: 390, height: 780 }], ['small', { width: 360, height: 640 }]]) {
    ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 800 }); page = await ctx.newPage(); watch(page);
    await page.goto(URL); await page.waitForTimeout(700);
    const m = await page.evaluate(() => { const c = canvas.getBoundingClientRect(); const chips = [...document.querySelectorAll('.resource-chip strong')].map(n => { const r = n.getBoundingClientRect(); return r.width > 0 && r.right <= innerWidth && n.scrollWidth <= n.clientWidth + 1; }); const st = document.querySelector('.world-stage').getBoundingClientRect(); return { ratio: c.width / c.height, overflowX: document.documentElement.scrollWidth - innerWidth, chips, canvasInStage: c.bottom <= st.bottom + 1 && c.top >= st.top - 1, cw: Math.round(c.width) }; });
    check(`13 ${name} ${vp.width}×${vp.height}: 캔버스 비율 유지·가로 넘침 없음·자원 숫자 보임`, Math.abs(m.ratio - 1.6) < .02 && m.overflowX <= 0 && m.chips.every(Boolean) && m.canvasInStage, JSON.stringify(m));
    if (vp.width < 800) {
      // 누르는 지점 가까이에 다른 펫이 우연히 있으면 그 펫이 선택돼(가장 가까운 펫 선택 규칙) 결과가 실행마다 달라지므로, 다른 펫은 반대편 구석으로 옮겨 둔다.
      const tgt = await page.evaluate(() => { const p = game.pets[1]; game.pets.forEach(o => { if (o !== p) { o.x = p.x < .5 ? .85 : .15; o.y = p.y < .5 ? .85 : .15; o.targetX = o.x; o.targetY = o.y; } }); const r = canvas.getBoundingClientRect(); return { id: p.id, x: r.left + p.x * r.width + 12, y: r.top + p.y * r.height + 10 }; });
      await page.mouse.click(tgt.x, tgt.y);
      check(`13 ${name}: 축소된 캔버스에서도 펫 누르기 가능`, await page.evaluate((id) => selectedPetId === id, tgt.id));
      await page.click('[data-tab="breed"]'); await page.click('#breedButton');
      check(`13 ${name}: 교배 버튼 조작 가능`, await page.evaluate(() => game.eggs.length === 1));
    }
    await page.evaluate(() => { activeTab = 'pets'; renderAll(); });
    await page.screenshot({ path: require('path').join(SHOT_DIR, `little_haven_${name}.png`), fullPage: true });
    await ctx.close();
  }

  check('전체 과정 콘솔/런타임 오류 0건', errs.length === 0, errs.join(' | '));
  const failed = results.filter(r => !r.ok);
  console.log(`\n총 ${results.length}개 중 통과 ${results.length - failed.length}, 실패 ${failed.length}`);
  await browser.close();
  if (failed.length) process.exit(1);
})().catch(e => { console.error('TEST CRASH', e); process.exit(1); });
