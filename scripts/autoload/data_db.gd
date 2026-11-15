extends Node
## 게임 데이터 창고 (읽기 전용).
## data/*.json 파일(펫, 조합표, 작업장)을 읽어 다른 코드에 제공한다.
## → 3단계(펫 시스템)에서 실제 데이터 로딩을 구현한다.

const DATA_DIR := "res://data/"


func _ready() -> void:
	print("[DataDB] 준비 완료 (데이터 로딩은 3단계에서 구현)")


## JSON 파일 하나를 읽어 Dictionary/Array로 돌려준다. 실패 시 null.
func load_json(file_name: String) -> Variant:
	var path := DATA_DIR + file_name
	if not FileAccess.file_exists(path):
		push_error("[DataDB] 파일 없음: " + path)
		return null
	var text := FileAccess.get_file_as_string(path)
	var parsed: Variant = JSON.parse_string(text)
	if parsed == null:
		push_error("[DataDB] JSON 형식 오류: " + path)
	return parsed
