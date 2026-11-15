extends Node
## 저장/불러오기 담당. 저장 파일은 각 PC의 사용자 폴더(user://)에 생긴다.
## → 6단계(저장 및 통합)에서 구현한다.

const SAVE_PATH := "user://save_game.json"


func _ready() -> void:
	print("[SaveManager] 준비 완료 (저장 기능은 6단계에서 구현)")
