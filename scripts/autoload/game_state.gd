extends Node
## 현재 게임 진행 상태. 모든 "바뀌는 값"은 여기에만 저장한다.
## 화면(UI)은 아래 signal을 듣고 스스로 갱신한다.

## 자원 수량이 바뀌었을 때 (자원 id, 새 수량)
signal resource_changed(id: String, amount: int)
## 보유 펫 목록이 바뀌었을 때 (추가·배치 변경 등)
signal pets_changed
## 새 펫 종류를 처음 발견했을 때 (도감 등록)
signal pet_discovered(species_id: String)

## 자원 id -> 수량
var resources: Dictionary = {}
## 보유 펫 목록. 한 마리 = {uid: 고유번호, species: 종류 id, workshop: 배치된 작업장 id("" = 쉬는 중)}
var pets: Array[Dictionary] = []
## 도감: 발견한 펫 종류 id -> true
var discovered: Dictionary = {}

var _next_uid := 1


func _ready() -> void:
	new_game()
	print("[GameState] 준비 완료")


## 새 게임 시작 상태로 초기화 (시작 자원 + 시작 펫)
func new_game() -> void:
	resources.clear()
	pets.clear()
	discovered.clear()
	_next_uid = 1
	var start_res: Dictionary = DataDB.balance.get("start_resources", {})
	for id in DataDB.resource_ids:
		resources[id] = int(start_res.get(id, 0))
		resource_changed.emit(id, resources[id])
	for species in DataDB.balance.get("start_pets", []):
		add_pet(species, true)
	pets_changed.emit()


# ---------------- 자원 ----------------

func get_resource(id: String) -> int:
	return resources.get(id, 0)


## 자원을 더하거나(양수) 뺀다(음수). 0 아래로는 내려가지 않는다.
func add_resource(id: String, amount: int) -> void:
	if not resources.has(id):
		push_error("[GameState] 없는 자원: " + id)
		return
	resources[id] = maxi(0, resources[id] + amount)
	resource_changed.emit(id, resources[id])


## 비용(자원 id -> 수량)을 낼 수 있는지
func can_afford(cost: Dictionary) -> bool:
	for id in cost:
		if get_resource(id) < int(cost[id]):
			return false
	return true


## 비용을 지불한다. 부족하면 아무것도 빼지 않고 false.
func spend(cost: Dictionary) -> bool:
	if not can_afford(cost):
		return false
	for id in cost:
		add_resource(id, -int(cost[id]))
	return true


# ---------------- 펫 ----------------

## 펫 한 마리를 추가하고 고유번호(uid)를 돌려준다. 처음 보는 종류면 도감에 등록된다.
## quiet = true 면 "새 펫 발견" 알림 신호를 보내지 않는다 (게임 시작·불러오기용).
func add_pet(species: String, quiet := false) -> int:
	if DataDB.get_pet(species).is_empty():
		push_error("[GameState] 없는 펫 종류: " + species)
		return -1
	var uid := _next_uid
	_next_uid += 1
	pets.append({"uid": uid, "species": species, "workshop": ""})
	if not discovered.has(species):
		discovered[species] = true
		if not quiet:
			pet_discovered.emit(species)
	pets_changed.emit()
	return uid


func get_pet(uid: int) -> Dictionary:
	for p in pets:
		if p.uid == uid:
			return p
	return {}


func count_species(species: String) -> int:
	var n := 0
	for p in pets:
		if p.species == species:
			n += 1
	return n


func is_discovered(species: String) -> bool:
	return discovered.has(species)
