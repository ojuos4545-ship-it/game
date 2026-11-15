extends Node
## 메인 화면: 게임 월드(3D)와 화면 UI(HUD)를 함께 띄운다.


func _ready() -> void:
	print("[Main] 메인 화면 시작 - 버전 ", ProjectSettings.get_setting("application/config/version"))
