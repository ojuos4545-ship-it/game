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
