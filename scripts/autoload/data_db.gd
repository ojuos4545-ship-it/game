extends Node
## 게임 데이터 창고 (읽기 전용).
## data/*.json 파일을 게임 시작 시 한 번 읽어 다른 코드에 제공한다.
## 데이터를 바꾸고 싶으면 코드가 아니라 data 폴더의 json 파일을 고친다.

const DATA_DIR := "res://data/"

## 자원: id -> {id, name, color(Color)}
var resources: Dictionary = {}
var resource_ids: Array[String] = []
## 작업장: id -> {id, name, resource, plot_color(Color), likes(좋아하는 속성), work(노동 동작), levels(레벨별 수치)}
var workshops: Dictionary = {}
var workshop_ids: Array[String] = []
## 속성: id -> {id, name, color(Color)}
var elements: Dictionary = {}
var element_ids: Array[String] = []
## 펫 종류: id -> {id, name, elements, power, obtain, adopt_cost, look, color, accent, description}
var pets: Dictionary = {}
var pet_ids: Array[String] = []
## 조합표: id -> {id, parents: [펫 id, 펫 id], result: 펫 id, cost: {자원: 수량}}
var recipes: Dictionary = {}
var recipe_ids: Array[String] = []
## 조합 찾기용: "펫A+펫B"(이름순 정렬) -> 조합표 id
var _recipe_by_pair: Dictionary = {}
## 기본 수치 (시작 펫, 시작 자원 등)
var balance: Dictionary = {}
## 데이터 검사에서 발견된 문제 목록 (비어 있으면 정상)
var errors: Array[String] = []


func _init() -> void:
	_load_all()


func _ready() -> void:
	if errors.is_empty():
		print("[DataDB] 데이터 로드 완료: 자원 %d, 작업장 %d, 속성 %d, 펫 %d, 조합 %d" % [resource_ids.size(), workshop_ids.size(), element_ids.size(), pet_ids.size(), recipe_ids.size()])
	else:
		for e in errors:
			push_error("[DataDB] " + e)


func get_resource(id: String) -> Dictionary:
	return resources.get(id, {})


func get_workshop(id: String) -> Dictionary:
	return workshops.get(id, {})


func get_element(id: String) -> Dictionary:
	return elements.get(id, {})


func get_pet(id: String) -> Dictionary:
	return pets.get(id, {})


## 두 펫 종류로 만들 수 있는 조합표를 찾는다 (순서 상관없음). 없으면 빈 사전.
func find_recipe(species_a: String, species_b: String) -> Dictionary:
	var id: String = _recipe_by_pair.get(_pair_key(species_a, species_b), "")
	return recipes.get(id, {})


## 이 펫 종류를 결과로 만드는 조합표 (없으면 빈 사전)
func recipe_for_result(species: String) -> Dictionary:
	for id in recipe_ids:
		if recipes[id].result == species:
			return recipes[id]
	return {}


func _pair_key(a: String, b: String) -> String:
	return a + "+" + b if a <= b else b + "+" + a


## 펫 속성 이름을 "숲·물" 형태로
func pet_elements_text(pet_id: String) -> String:
	var names: Array[String] = []
	for e in get_pet(pet_id).get("elements", []):
		names.append(get_element(e).get("name", e))
	return "·".join(names)


## 비용 사전을 "열매 15, 목재 10" 형태로
func cost_text(cost: Dictionary) -> String:
	var parts: Array[String] = []
	for id in resource_ids:
		if cost.has(id):
			parts.append("%s %d" % [get_resource(id).name, cost[id]])
	return ", ".join(parts)


# ---------------- 내부 ----------------

func _load_all() -> void:
	errors.clear()
	_load_list("resources.json", "resources", resources, resource_ids, ["name", "color"])
	_load_list("workshops.json", "workshops", workshops, workshop_ids, ["name", "resource", "plot_color", "likes", "work", "levels"])
	_load_list("elements.json", "elements", elements, element_ids, ["name", "color"])
	_load_list("pets.json", "pets", pets, pet_ids, ["name", "elements", "power", "obtain", "look", "color", "accent", "description"])
	_load_list("recipes.json", "recipes", recipes, recipe_ids, ["parents", "result", "cost"])
	var parsed_balance: Variant = load_json("balance.json")
	balance = parsed_balance if parsed_balance is Dictionary else {}
	for id in resources:
		resources[id].color = Color.html(resources[id].color)
	for id in elements:
		elements[id].color = Color.html(elements[id].color)
	_check_pets()
	_check_workshop_levels()
	_check_recipes()
	_check_balance()
	for id in workshops:
		var w: Dictionary = workshops[id]
		w.plot_color = Color.html(w.plot_color)
		if not resources.has(w.resource):
			errors.append("작업장 '%s'의 자원 '%s'이(가) resources.json에 없음" % [id, w.resource])
		if not (w.get("work") in ["chop", "mine", "harvest"]):
			errors.append("작업장 '%s'의 work는 chop/mine/harvest 중 하나" % id)


func _check_pets() -> void:
	for id in pets:
		var p: Dictionary = pets[id]
		p.color = Color.html(p.color)
		p.accent = Color.html(p.accent)
		for e in p.elements:
			if not elements.has(e):
				errors.append("펫 '%s'의 속성 '%s'이(가) elements.json에 없음" % [id, e])
		if not (p.obtain in ["base", "combine"]):
			errors.append("펫 '%s'의 obtain은 base 또는 combine 이어야 함" % id)
		if p.obtain == "base":
			_check_cost(p.get("adopt_cost", {}), "펫 '%s'의 adopt_cost" % id)
			if p.get("adopt_cost", {}).is_empty():
				errors.append("기본 펫 '%s'에 adopt_cost 없음" % id)
		# JSON 숫자는 소수로 읽히므로 비용은 정수로 맞춘다
		if p.has("adopt_cost"):
			p.adopt_cost = _int_cost(p.adopt_cost)


func _check_workshop_levels() -> void:
	for id in workshops:
		var w: Dictionary = workshops[id]
		for e in w.get("likes", []):
			if not elements.has(e):
				errors.append("작업장 '%s'의 좋아하는 속성 '%s'이(가) elements.json에 없음" % [id, e])
		var levels: Variant = w.get("levels")
		if not (levels is Array and levels.size() >= 1):
			errors.append("작업장 '%s': levels 목록이 비었음" % id)
			continue
		for i in levels.size():
			var lv: Dictionary = levels[i]
			for key in ["slots", "bonus", "capacity"]:
				if not lv.has(key):
					errors.append("작업장 '%s' Lv%d: '%s' 없음" % [id, i + 1, key])
			lv.slots = int(lv.get("slots", 1))
			lv.capacity = int(lv.get("capacity", 0))
			lv.bonus = float(lv.get("bonus", 1.0))
			if i > 0:
				if not lv.has("upgrade_cost"):
					errors.append("작업장 '%s' Lv%d: upgrade_cost 없음" % [id, i + 1])
				_check_cost(lv.get("upgrade_cost", {}), "작업장 '%s' Lv%d upgrade_cost" % [id, i + 1])
				lv.upgrade_cost = _int_cost(lv.get("upgrade_cost", {}))


## 작업장의 레벨(1부터) 수치. 범위 밖이면 빈 사전.
func get_workshop_level(id: String, level: int) -> Dictionary:
	var levels: Array = get_workshop(id).get("levels", [])
	if level < 1 or level > levels.size():
		return {}
	return levels[level - 1]


func max_workshop_level(id: String) -> int:
	return get_workshop(id).get("levels", []).size()


## 작업장에 둘 수 있는 최대 슬롯 수 (최고 레벨 기준)
func max_workshop_slots(id: String) -> int:
	return get_workshop_level(id, max_workshop_level(id)).get("slots", 0)


func _check_recipes() -> void:
	_recipe_by_pair.clear()
	for id in recipe_ids:
		var r: Dictionary = recipes[id]
		if not (r.parents is Array and r.parents.size() == 2):
			errors.append("조합 '%s': parents는 펫 2마리여야 함" % id)
			continue
		for p in r.parents:
			if not pets.has(p):
				errors.append("조합 '%s': 없는 재료 펫 '%s'" % [id, p])
		if not pets.has(r.result):
			errors.append("조합 '%s': 없는 결과 펫 '%s'" % [id, r.result])
		elif pets[r.result].obtain != "combine":
			errors.append("조합 '%s': 결과 펫 '%s'의 obtain이 combine이 아님" % [id, r.result])
		_check_cost(r.cost, "조합 '%s'의 cost" % id)
		r.cost = _int_cost(r.cost)
		var key := _pair_key(r.parents[0], r.parents[1])
		if _recipe_by_pair.has(key):
			errors.append("조합 '%s': 같은 재료 조합이 이미 있음 (%s)" % [id, key])
		_recipe_by_pair[key] = id
	# 조합 펫은 모두 조합표로 얻을 수 있어야 한다
	for pid in pet_ids:
		if pets[pid].obtain == "combine" and recipe_for_result(pid).is_empty():
			errors.append("조합 펫 '%s'을(를) 만드는 조합표가 없음" % pid)


func _check_balance() -> void:
	for pet_id in balance.get("start_pets", []):
		if not pets.has(pet_id):
			errors.append("balance.json 시작 펫 '%s'이(가) pets.json에 없음" % pet_id)
	_check_cost(balance.get("start_resources", {}), "balance.json start_resources")
	for key in ["production_interval", "like_multiplier", "auto_collect"]:
		if not balance.has(key):
			errors.append("balance.json: '%s' 없음" % key)
	balance.start_resources = _int_cost(balance.get("start_resources", {}))


func _check_cost(cost: Variant, where: String) -> void:
	if not cost is Dictionary:
		errors.append(where + ": 형식 오류")
		return
	for r in cost:
		if not resources.has(r):
			errors.append("%s: 없는 자원 '%s'" % [where, r])


func _int_cost(cost: Dictionary) -> Dictionary:
	var out := {}
	for r in cost:
		out[r] = int(cost[r])
	return out


## json 파일의 목록(list_key)을 읽어 id 기준 사전(out_dict)과 순서(out_ids)에 담는다.
func _load_list(file_name: String, list_key: String, out_dict: Dictionary, out_ids: Array[String], required: Array) -> void:
	var parsed: Variant = load_json(file_name)
	if not (parsed is Dictionary and parsed.get(list_key) is Array):
		errors.append("%s: '%s' 목록을 찾을 수 없음" % [file_name, list_key])
		return
	for entry in parsed[list_key]:
		var id: String = str(entry.get("id", ""))
		if id.is_empty() or out_dict.has(id):
			errors.append("%s: id가 비었거나 중복됨 (%s)" % [file_name, id])
			continue
		for key in required:
			if not entry.has(key):
				errors.append("%s: '%s'에 '%s' 항목 없음" % [file_name, id, key])
		out_dict[id] = entry
		out_ids.append(id)


## JSON 파일 하나를 읽어 Dictionary/Array로 돌려준다. 실패 시 null.
func load_json(file_name: String) -> Variant:
	var path := DATA_DIR + file_name
	if not FileAccess.file_exists(path):
		errors.append("파일 없음: " + path)
		return null
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	if parsed == null:
		errors.append("JSON 형식 오류: " + path)
	return parsed
