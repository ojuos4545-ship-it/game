extends Node
## 현재 게임 진행 상태. 모든 "바뀌는 값"은 여기에만 저장한다.
## 화면(UI)은 아래 signal을 듣고 스스로 갱신한다.
## 2단계: 자원 / 3단계 이후: 보유 펫, 작업장, 도감 추가 예정.

## 자원 수량이 바뀌었을 때 (자원 id, 새 수량)
signal resource_changed(id: String, amount: int)

## 자원 id -> 수량
var resources: Dictionary = {}


func _ready() -> void:
	reset()
	print("[GameState] 준비 완료")


## 새 게임 상태로 초기화
func reset() -> void:
	resources.clear()
	for id in DataDB.resource_ids:
		resources[id] = 0
		resource_changed.emit(id, 0)


func get_resource(id: String) -> int:
	return resources.get(id, 0)


## 자원을 더하거나(양수) 뺀다(음수). 0 아래로는 내려가지 않는다.
func add_resource(id: String, amount: int) -> void:
	if not resources.has(id):
		push_error("[GameState] 없는 자원: " + id)
		return
	resources[id] = maxi(0, resources[id] + amount)
	resource_changed.emit(id, resources[id])
