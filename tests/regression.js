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
  check('6 도감: 전체 12종 기준 표시 + 지역별 묶음(초원 n/6, 숲 0/6)', dexLocked.total === `${hatch.dex} / 12` && dexLocked.meadow.includes('초원') && dexLocked.meadow.includes(`${hatch.dex} / 6`) && dexLocked.forest.includes('숲') && dexLocked.forest.includes('0 / 6'), JSON.stringify(dexLocked));
  check('6 도감: 숲 미개방이면 숲 종족 6칸 모두 "지역 미개방"', dexLocked.hints.filter(h => h === '지역 미개방').length === 6);
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
    const everyBreedOnlyReachable = Object.keys(SPECIES).filter(id => SPECIES[id].breedOnly).every(id => Object.values(BREEDING_RULES.speciesPairs).some(list => list.some(e => e.speciesId === id)));
    return speciesOk && giftsOk && rulesOk && everyBreedOnlyReachable && Object.keys(SPECIES).length === 12;
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
  check('6-2 도감: 숲 개방 후 숲 1/6, 미발견 조합 전용은 "특별한 부모 조합 필요"', forestUi.forestHead.includes('🌲 숲') && forestUi.forestHead.includes('1 / 6') && forestUi.hints.filter(h => h === '특별한 부모 조합 필요').length === 1 && !forestUi.hints.includes('지역 미개방') && forestUi.panel.includes('나북이') && forestUi.panel.includes('에픽'), JSON.stringify(forestUi.hints));

  // ---------- 7. 놓아주기 ----------
  await page.click('[data-tab="pets"]');
  const relBefore = await page.evaluate(() => { selectedPetId = game.pets[game.pets.length - 1].id; renderAll(); return game.pets.length; });
  await page.click('#releaseButton');
  check('7 놓아주기(확인 후) 펫 -1, 도감 유지', await page.evaluate((n) => game.pets.length === n - 1 && game.discoveredSpecies.length >= 3, relBefore));
  check('7 최소 2마리일 때 놓아주기 비활성', await page.evaluate(() => { game.pets = game.pets.slice(0, 2); selectedPetId = game.pets[0].id; renderAll(); return document.querySelector('#releaseButton').disabled; }));

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
      const tgt = await page.evaluate(() => { const p = game.pets[1]; const r = canvas.getBoundingClientRect(); return { id: p.id, x: r.left + p.x * r.width + 12, y: r.top + p.y * r.height + 10 }; });
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
