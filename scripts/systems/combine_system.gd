class_name CombineSystem
## 조합 규칙: 보유한 펫 두 종류 + 자원 → 조합표의 새 펫 한 마리.
## - 성공률 100%, 재료 펫은 사라지지 않음, 순서 상관없음
## - 조합표에 없는 조합은 자원을 쓰지 않고 "아무 일도 일어나지 않음"


## 조합 가능 여부. 결과: {ok: bool, reason: String, recipe: Dictionary}
## recipe 는 조합표에 있으면 (자원이 부족해도) 채워진다 → 화면 미리보기에 사용
static func check(species_a: String, species_b: String) -> Dictionary:
	if species_a.is_empty() or species_b.is_empty():
		return {"ok": false, "reason": "펫 두 마리를 골라 주세요", "recipe": {}}
	if not _owns(species_a, species_b):
		return {"ok": false, "reason": "보유하지 않은 펫이 있어요", "recipe": {}}
	var recipe := DataDB.find_recipe(species_a, species_b)
	if recipe.is_empty():
		return {"ok": false, "reason": "이 조합으로는 아무 일도 일어나지 않아요", "recipe": {}}
	if not GameState.can_afford(recipe.cost):
		return {"ok": false, "reason": "자원이 부족해요 (%s 필요)" % DataDB.cost_text(recipe.cost), "recipe": recipe}
	return {"ok": true, "reason": "", "recipe": recipe}


## 조합 실행. 결과: {ok, message, result(펫 종류), uid, new_discovery}
static func combine(species_a: String, species_b: String) -> Dictionary:
	var c := check(species_a, species_b)
	if not c.ok:
		return {"ok": false, "message": c.reason, "result": "", "uid": -1, "new_discovery": false}
	var recipe: Dictionary = c.recipe
	var result: String = recipe.result
	var is_new := not GameState.is_discovered(result)
	GameState.spend(recipe.cost)
	var uid := GameState.add_pet(result)
	var name: String = DataDB.get_pet(result).name
	var message := ("새로운 펫 %s 발견했어요!" % Korean.obj(name)) if is_new else ("%s 한 마리 더 얻었어요!" % Korean.obj(name))
	return {"ok": true, "message": message, "result": result, "uid": uid, "new_discovery": is_new}


## 같은 종류 두 마리를 고른 경우 2마리 이상 있어야 한다
static func _owns(a: String, b: String) -> bool:
	if a == b:
		return GameState.count_species(a) >= 2
	return GameState.count_species(a) >= 1 and GameState.count_species(b) >= 1
