class_name AdoptionSystem
## 입양 규칙: 기본 펫(obtain = base)만, 입양 비용(adopt_cost)을 내고 한 마리 추가.


## 입양할 수 없는 이유를 돌려준다. 입양 가능하면 빈 문자열.
static func check(species: String) -> String:
	var info := DataDB.get_pet(species)
	if info.is_empty():
		return "없는 펫입니다"
	if info.obtain != "base":
		return "%s 조합으로만 얻을 수 있어요" % Korean.topic(info.name)
	if not GameState.can_afford(info.adopt_cost):
		return "자원이 부족해요 (%s 필요)" % DataDB.cost_text(info.adopt_cost)
	return ""


## 입양을 실행한다. 결과: {ok: bool, message: String, uid: int}
static func adopt(species: String) -> Dictionary:
	var reason := check(species)
	if not reason.is_empty():
		return {"ok": false, "message": reason, "uid": -1}
	var info := DataDB.get_pet(species)
	GameState.spend(info.adopt_cost)
	var uid := GameState.add_pet(species)
	return {"ok": true, "message": "%s 입양했어요!" % Korean.obj(info.name), "uid": uid}
