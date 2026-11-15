extends Node
## 게임 데이터 창고 (읽기 전용).
## data/*.json 파일을 게임 시작 시 한 번 읽어 다른 코드에 제공한다.
## 데이터를 바꾸고 싶으면 코드가 아니라 data 폴더의 json 파일을 고친다.

const DATA_DIR := "res://data/"

## 자원: id -> {id, name, color(Color)}
var resources: Dictionary = {}
var resource_ids: Array[String] = []
## 작업장: id -> {id, name, resource, plot_color(Color)}
var workshops: Dictionary = {}
var workshop_ids: Array[String] = []
## 속성: id -> {id, name, color(Color)}
var elements: Dictionary = {}
var element_ids: Array[String] = []
## 펫 종류: id -> {id, name, elements, power, obtain, adopt_cost, look, color, accent, description}
var pets: Dictionary = {}
var pet_ids: Array[String] = []
## 기본 수치 (시작 펫, 시작 자원 등)
var balance: Dictionary = {}
## 데이터 검사에서 발견된 문제 목록 (비어 있으면 정상)
var errors: Array[String] = []


func _init() -> void:
	_load_all()


func _ready() -> void:
	if errors.is_empty():
		print("[DataDB] 데이터 로드 완료: 자원 %d, 작업장 %d, 속성 %d, 펫 %d" % [resource_ids.size(), workshop_ids.size(), element_ids.size(), pet_ids.size()])
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
	_load_list("workshops.json", "workshops", workshops, workshop_ids, ["name", "resource", "plot_color"])
	_load_list("elements.json", "elements", elements, element_ids, ["name", "color"])
	_load_list("pets.json", "pets", pets, pet_ids, ["name", "elements", "power", "obtain", "look", "color", "accent", "description"])
	var parsed_balance: Variant = load_json("balance.json")
	balance = parsed_balance if parsed_balance is Dictionary else {}
	for id in resources:
		resources[id].color = Color.html(resources[id].color)
	for id in elements:
		elements[id].color = Color.html(elements[id].color)
	_check_pets()
	_check_balance()
	for id in workshops:
		var w: Dictionary = workshops[id]
		w.plot_color = Color.html(w.plot_color)
		if not resources.has(w.resource):
			errors.append("작업장 '%s'의 자원 '%s'이(가) resources.json에 없음" % [id, w.resource])


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


func _check_balance() -> void:
	for pet_id in balance.get("start_pets", []):
		if not pets.has(pet_id):
			errors.append("balance.json 시작 펫 '%s'이(가) pets.json에 없음" % pet_id)
	_check_cost(balance.get("start_resources", {}), "balance.json start_resources")
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
