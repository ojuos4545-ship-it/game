extends Node
## 개발용: 밸런스 모의 플레이. 실제 게임 규칙(data/*.json)으로 새 게임부터 도감 완성까지 진행해 걸리는 시간을 잰다.
## 실행: godot --headless --path . res://tools/balance_sim.tscn
## 플레이 방식 두 가지:
##  - 기본: 조합만 (입양·업그레이드 안 함) → "가장 단순하게 플레이하면 얼마나?"
##  - 적극: 빈 자리 있으면 입양, 자리가 다 차면 업그레이드 → "부지런히 하면 얼마나?"

const GOALS := [["doto", "pongdang"], ["mongdol", "haerong"], ["doto", "mongdol"], ["ikkigom", "bandi"]]
const MAX_TICKS := 20000


func _ready() -> void:
	SaveManager.enabled = false
	DataDB.balance.auto_collect = true
	var interval: float = DataDB.balance.production_interval
	for active in [false, true]:
		print("=== %s ===" % ("적극 플레이 (입양·업그레이드)" if active else "기본 플레이 (조합만)"))
		var log := simulate(active)
		for line in log:
			print("  %5.1f분  %s" % [line[0] * interval / 60.0, line[1]])
	get_tree().quit()


func simulate(active: bool) -> Array:
	GameState.new_game()
	var log: Array = []
	var goal_i := 0
	for t in MAX_TICKS:
		_assign_resting()
		if goal_i < GOALS.size():
			var g: Array = GOALS[goal_i]
			if CombineSystem.check(g[0], g[1]).ok:
				var r := CombineSystem.combine(g[0], g[1])
				log.append([t, "조합 → %s (도감 %d/8)" % [DataDB.get_pet(r.result).name, GameState.discovered.size()]])
				goal_i += 1
				_assign_resting()
				if goal_i == GOALS.size():
					log.append([t, "도감 완성! 보유 펫 %d마리, 작업장 Lv %s" % [GameState.pets.size(), _levels()]])
					return log
				continue
		if active:
			_try_adopt(log, t)
			_try_upgrade(log, t)
		WorkshopSystem.tick_all()
	log.append([MAX_TICKS, "시간 초과"])
	return log


## 쉬는 펫을 가장 많이 생산하는 빈 자리로
func _assign_resting() -> void:
	for p in GameState.pets:
		if not p.workshop.is_empty():
			continue
		var best := ""
		var best_out := -1.0
		for ws in DataDB.workshop_ids:
			if WorkshopSystem.free_slot(ws) >= 0 and WorkshopSystem.output(p.species, ws) > best_out:
				best = ws
				best_out = WorkshopSystem.output(p.species, ws)
		if not best.is_empty():
			WorkshopSystem.assign(p.uid, best)


## 빈 자리가 있는 작업장에 맞는 기본 펫 입양
func _try_adopt(log: Array, t: int) -> void:
	for ws in DataDB.workshop_ids:
		if WorkshopSystem.free_slot(ws) < 0:
			continue
		for id in DataDB.pet_ids:
			if DataDB.get_pet(id).obtain == "base" and WorkshopSystem.likes(id, ws) and AdoptionSystem.check(id).is_empty():
				AdoptionSystem.adopt(id)
				log.append([t, "입양 %s → %s" % [DataDB.get_pet(id).name, DataDB.get_workshop(ws).name]])
				_assign_resting()
				return


## 모든 자리가 차 있으면 업그레이드
func _try_upgrade(log: Array, t: int) -> void:
	for ws in DataDB.workshop_ids:
		if WorkshopSystem.free_slot(ws) >= 0:
			return
	for ws in DataDB.workshop_ids:
		if WorkshopSystem.check_upgrade(ws).is_empty():
			WorkshopSystem.upgrade(ws)
			log.append([t, "업그레이드 %s Lv%d" % [DataDB.get_workshop(ws).name, WorkshopSystem.level(ws)]])
			return


func _levels() -> String:
	var parts: Array[String] = []
	for ws in DataDB.workshop_ids:
		parts.append(str(WorkshopSystem.level(ws)))
	return "/".join(parts)
