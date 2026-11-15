extends Node
## 저장/불러오기 담당.
## - 게임 시작 시 저장 파일이 있으면 불러온다.
## - 상태가 바뀌면 "저장 필요" 표시를 해 두고, 몇 초마다 한 번씩 저장한다 (너무 자주 쓰지 않도록).
## - 창을 닫을 때도 저장한다.
## 저장 위치: user://save_game.json
##   Windows: %APPDATA%/Godot/app_userdata/Little Haven/  ·  웹: 브라우저 저장소(IndexedDB)

signal saved

const SAVE_PATH := "user://save_game.json"
const AUTOSAVE_INTERVAL := 5.0

## false 면 저장하지 않는다 (자동 점검·화면 캡처 중에 실제 저장을 덮어쓰지 않도록)
var enabled := true
var save_path := SAVE_PATH
## 마지막으로 저장한 시각 (화면 표시용, "" = 아직 없음)
var last_saved_time := ""

var _dirty := false
var _elapsed := 0.0


func _ready() -> void:
	if has_save():
		if load_game():
			print("[SaveManager] 저장된 게임을 불러왔습니다")
		else:
			push_warning("[SaveManager] 저장 파일을 읽지 못해 새 게임으로 시작합니다")
	else:
		print("[SaveManager] 저장 파일 없음 - 새 게임")
	for sig in [GameState.resource_changed, GameState.pets_changed, GameState.workshop_changed]:
		sig.connect(func(_a = null, _b = null): _dirty = true)


func _process(delta: float) -> void:
	_elapsed += delta
	if _elapsed >= AUTOSAVE_INTERVAL:
		_elapsed = 0.0
		if _dirty:
			save_game()


func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_CLOSE_REQUEST or what == NOTIFICATION_APPLICATION_PAUSED:
		save_game()


func has_save() -> bool:
	return FileAccess.file_exists(save_path)


## 지금 상태를 파일에 쓴다. 성공하면 true.
func save_game() -> bool:
	if not enabled:
		return false
	var f := FileAccess.open(save_path, FileAccess.WRITE)
	if f == null:
		push_error("[SaveManager] 저장 실패: " + error_string(FileAccess.get_open_error()))
		return false
	f.store_string(JSON.stringify(GameState.to_save(), "\t"))
	f.close()
	_dirty = false
	last_saved_time = Time.get_time_string_from_system()
	saved.emit()
	return true


## 파일에서 상태를 불러온다. 파일이 없거나 깨졌으면 false (상태는 그대로).
func load_game() -> bool:
	if not has_save():
		return false
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string(save_path))
	if not GameState.load_save(parsed):
		return false
	_dirty = false
	return true


## 처음부터 다시 시작 (저장 파일도 새 상태로 덮어씀)
func start_new_game() -> void:
	GameState.new_game()
	save_game()


func delete_save() -> void:
	if has_save():
		DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
