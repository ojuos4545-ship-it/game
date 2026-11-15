extends PanelContainer
## 메뉴 창 공통 틀 (제목 + 닫기 버튼 + 내용 영역).
## 펫 목록·조합·도감 창이 이 틀을 함께 쓴다. 내용은 각 단계에서 Content 안에 채운다.

signal close_requested

@export var title: String = "창":
	set(value):
		title = value
		if is_node_ready():
			%Title.text = value
@export_multiline var placeholder: String = "":
	set(value):
		placeholder = value
		if is_node_ready():
			%Placeholder.text = value


func _ready() -> void:
	%Title.text = title
	%Placeholder.text = placeholder
	%Placeholder.visible = not placeholder.is_empty()
	%CloseButton.pressed.connect(close_requested.emit)


## 각 단계에서 실제 내용을 넣을 영역
func get_content() -> VBoxContainer:
	return %Content


## 내용 화면을 넣는다 (안내 문구는 숨김)
func set_view(view: Control) -> void:
	%Placeholder.visible = false
	view.size_flags_vertical = Control.SIZE_EXPAND_FILL
	%Content.add_child(view)
