extends Node3D
## 메인 화면. 1단계에서는 "실행 확인용" 화면만 보여준다.
## → 2단계에서 실제 게임 월드(지형, 작업장 자리, UI)로 교체한다.

@onready var _cube: MeshInstance3D = $TestCube
@onready var _camera: Camera3D = $Camera3D


func _ready() -> void:
	_camera.look_at(Vector3.ZERO, Vector3.UP)
	print("[Main] 메인 화면 시작 - 버전 ", ProjectSettings.get_setting("application/config/version"))


func _process(delta: float) -> void:
	_cube.rotate_y(delta * 0.8)
