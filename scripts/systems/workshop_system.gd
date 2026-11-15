class_name WorkshopSystem
## 작업장 규칙: 펫 배치·회수, 생산량 계산, 생산(한 번), 수집, 업그레이드.
## 자동 수집(balance.json auto_collect = true)이면 생산된 자원이 바로 내 자원으로 들어간다.
## 생산량(펫 한 마리, 한 번) = 작업력 × 적성(좋아하는 속성이면 like_multiplier, 아니면 1) × 레벨 보너스


# ---------------- 조회 ----------------

static func level(ws: String) -> int:
	return GameState.get_workshop(ws).get("level", 1)


static func level_info(ws: String) -> Dictionary:
	return DataDB.get_workshop_level(ws, level(ws))


static func slot_count(ws: String) -> int:
	return level_info(ws).get("slots", 0)


static func capacity(ws: String) -> int:
	return level_info(ws).get("capacity", 0)


static func stored(ws: String) -> float:
	return GameState.get_workshop(ws).get("stored", 0.0)


## 자리 번호 -> 펫 (비어 있으면 해당 번호 없음)
static func workers(ws: String) -> Dictionary:
	var out := {}
	for p in GameState.pets:
		if p.workshop == ws:
			out[p.slot] = p
	return out


static func free_slot(ws: String) -> int:
	var used := workers(ws)
	for i in slot_count(ws):
		if not used.has(i):
			return i
	return -1


## 이 펫 종류가 이 작업장을 좋아하는지 (속성이 하나라도 맞으면)
static func likes(species: String, ws: String) -> bool:
	var liked: Array = DataDB.get_workshop(ws).get("likes", [])
	for e in DataDB.get_pet(species).get("elements", []):
		if e in liked:
			return true
	return false


## 펫 한 마리가 한 번에 만드는 양
static func output(species: String, ws: String) -> float:
	var power: float = DataDB.get_pet(species).get("power", 1.0)
	var like: float = DataDB.balance.get("like_multiplier", 2.0) if likes(species, ws) else 1.0
	return snappedf(power * like * level_info(ws).get("bonus", 1.0), 0.01)


## 작업장 전체가 한 번에 만드는 양
static func total_output(ws: String) -> float:
	var total := 0.0
	for p in workers(ws).values():
		total += output(p.species, ws)
	return total


# ---------------- 배치 · 회수 ----------------

## 펫을 작업장 빈 자리에 넣는다. 다른 작업장에서 일하던 펫이면 옮긴다.
static func assign(uid: int, ws: String) -> Dictionary:
	var pet := GameState.get_pet(uid)
	if pet.is_empty() or DataDB.get_workshop(ws).is_empty():
		return {"ok": false, "message": "잘못된 펫 또는 작업장"}
	if pet.workshop == ws:
		return {"ok": false, "message": "이미 이 작업장에서 일하고 있어요"}
	var slot := free_slot(ws)
	if slot < 0:
		return {"ok": false, "message": "빈 자리가 없어요 (업그레이드하면 자리가 늘어나요)"}
	GameState.set_pet_work(uid, ws, slot)
	var name: String = DataDB.get_pet(pet.species).name
	return {"ok": true, "message": "%s %s에서 일을 시작했어요" % [Korean.subj(name), DataDB.get_workshop(ws).name]}


## 펫을 작업장에서 빼서 쉬게 한다.
static func unassign(uid: int) -> Dictionary:
	var pet := GameState.get_pet(uid)
	if pet.is_empty() or pet.workshop.is_empty():
		return {"ok": false, "message": "일하고 있지 않은 펫이에요"}
	GameState.set_pet_work(uid, "", -1)
	return {"ok": true, "message": "%s 쉬러 갔어요" % Korean.subj(DataDB.get_pet(pet.species).name)}


# ---------------- 생산 · 수집 ----------------

## 모든 작업장에서 한 번씩 생산 (생산 시계가 일정 시간마다 부른다)
static func tick_all() -> void:
	for ws in DataDB.workshop_ids:
		tick(ws)


## 작업장 한 곳에서 한 번 생산한다. 창고가 가득 차면 더 쌓이지 않는다. 돌려주는 값: 실제로 늘어난 양
static func tick(ws: String) -> float:
	var cap := float(capacity(ws))
	var amount := stored(ws)
	var made := 0.0
	var by_slot := workers(ws)
	var slots := by_slot.keys()
	slots.sort()
	for s in slots:
		var p: Dictionary = by_slot[s]
		var room := cap - amount
		if room <= 0.0:
			break
		var out := minf(output(p.species, ws), room)
		amount += out
		made += out
		GameState.produced.emit(ws, p.uid, out)
	if made > 0.0:
		GameState.set_workshop_stored(ws, amount)
		if auto_collect():
			collect(ws)
	return made


static func auto_collect() -> bool:
	return DataDB.balance.get("auto_collect", false)


static func is_full(ws: String) -> bool:
	return stored(ws) >= capacity(ws) - 0.001


## 창고의 자원을 가져온다 (정수만큼, 남는 소수는 창고에 남김). 돌려주는 값: 가져온 양
static func collect(ws: String) -> int:
	var amount := int(floor(stored(ws) + 0.001))
	if amount <= 0:
		return 0
	GameState.add_resource(DataDB.get_workshop(ws).resource, amount)
	GameState.set_workshop_stored(ws, maxf(0.0, stored(ws) - amount))
	return amount


# ---------------- 업그레이드 ----------------

## 다음 레벨 수치 (최고 레벨이면 빈 사전)
static func next_level_info(ws: String) -> Dictionary:
	return DataDB.get_workshop_level(ws, level(ws) + 1)


static func check_upgrade(ws: String) -> String:
	var nxt := next_level_info(ws)
	if nxt.is_empty():
		return "이미 최고 레벨이에요"
	if not GameState.can_afford(nxt.upgrade_cost):
		return "자원이 부족해요 (%s 필요)" % DataDB.cost_text(nxt.upgrade_cost)
	return ""


static func upgrade(ws: String) -> Dictionary:
	var reason := check_upgrade(ws)
	if not reason.is_empty():
		return {"ok": false, "message": reason}
	GameState.spend(next_level_info(ws).upgrade_cost)
	GameState.set_workshop_level(ws, level(ws) + 1)
	return {"ok": true, "message": "%s Lv%d 달성! 자리 %d개, 생산 ×%s" % [DataDB.get_workshop(ws).name, level(ws), slot_count(ws), str(level_info(ws).bonus)]}
