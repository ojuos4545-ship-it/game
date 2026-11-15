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
## 데이터 검사에서 발견된 문제 목록 (비어 있으면 정상)
var errors: Array[String] = []


func _init() -> void:
	_load_all()


func _ready() -> void:
	if errors.is_empty():
		print("[DataDB] 데이터 로드 완료: 자원 %d, 작업장 %d" % [resource_ids.size(), workshop_ids.size()])
	else:
		for e in errors:
			push_error("[DataDB] " + e)


func get_resource(id: String) -> Dictionary:
	return resources.get(id, {})


func get_workshop(id: String) -> Dictionary:
	return workshops.get(id, {})


# ---------------- 내부 ----------------

func _load_all() -> void:
	errors.clear()
	_load_list("resources.json", "resources", resources, resource_ids, ["name", "color"])
	_load_list("workshops.json", "workshops", workshops, workshop_ids, ["name", "resource", "plot_color"])
	for id in resources:
		resources[id].color = Color.html(resources[id].color)
	for id in workshops:
		var w: Dictionary = workshops[id]
		w.plot_color = Color.html(w.plot_color)
		if not resources.has(w.resource):
			errors.append("작업장 '%s'의 자원 '%s'이(가) resources.json에 없음" % [id, w.resource])


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
