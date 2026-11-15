extends Node
## 생산 시계: balance.json 의 production_interval(초)마다 모든 작업장이 한 번씩 생산한다.
## 메인 화면에 들어 있다. (자동 점검에서는 WorkshopSystem.tick 을 직접 부른다)

var _elapsed := 0.0


func _ready() -> void:
	add_to_group("production_clock")


func _process(delta: float) -> void:
	var interval: float = DataDB.balance.get("production_interval", 5.0)
	_elapsed += delta
	while _elapsed >= interval:
		_elapsed -= interval
		WorkshopSystem.tick_all()


## 다음 생산까지 남은 비율 (0~1, 화면 진행 막대용)
func progress() -> float:
	return _elapsed / DataDB.balance.get("production_interval", 5.0)
