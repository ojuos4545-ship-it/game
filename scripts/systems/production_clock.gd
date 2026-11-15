extends Node
## 생산 시계: balance.json 의 production_interval(초)마다 모든 작업장이 한 번씩 생산한다.
## 메인 화면에 들어 있다. (자동 점검에서는 WorkshopSystem.tick 을 직접 부른다)
## 화면이 느린 PC나 브라우저 탭이 잠시 가려졌을 때도 생산이 느려지지 않도록
## 화면 프레임 시간 대신 실제 시계 시간을 쓴다. 한 번에 따라잡는 시간은 최대 1분.

const MAX_CATCH_UP := 60.0

var _elapsed := 0.0
var _last_usec := 0


func _ready() -> void:
	add_to_group("production_clock")
	_last_usec = Time.get_ticks_usec()


func _process(delta: float) -> void:
	var now := Time.get_ticks_usec()
	var real := (now - _last_usec) / 1000000.0
	_last_usec = now
	var interval: float = DataDB.balance.get("production_interval", 5.0)
	_elapsed += minf(maxf(delta, real), MAX_CATCH_UP)
	while _elapsed >= interval:
		_elapsed -= interval
		WorkshopSystem.tick_all()


## 다음 생산까지 남은 비율 (0~1, 화면 진행 막대용)
func progress() -> float:
	return _elapsed / DataDB.balance.get("production_interval", 5.0)
