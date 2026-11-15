extends Node3D
## 작업장 부지 (빈 땅 + 울타리 + 이름표).
## 5단계에서 이 부지 위에 작업장 건물·소품·펫 배치 슬롯이 올라간다.

const PLOT_SIZE := 5.0
const FENCE_COLOR := Color("8a5a3b")

## data/workshops.json 의 id (lumber / mine / farm)
@export var workshop_id: String = ""

var info: Dictionary = {}


func _ready() -> void:
	info = DataDB.get_workshop(workshop_id)
	if info.is_empty():
		push_error("[WorkshopPlot] 데이터 없음: " + workshop_id)
		return
	_build_ground()
	_build_fence()
	_build_name_label()


func _build_ground() -> void:
	add_child(Shapes.box(Vector3(PLOT_SIZE, 0.2, PLOT_SIZE), info.plot_color, Vector3(0, 0.1, 0), false))


func _build_fence() -> void:
	var half := PLOT_SIZE / 2.0
	# 화면 안쪽 두 변에만 울타리 (앞쪽 두 변은 펫이 잘 보이도록 비워 둠)
	for p in [Vector3(-half, 0, -half), Vector3(half, 0, -half), Vector3(-half, 0, half)]:
		add_child(Shapes.box(Vector3(0.18, 0.7, 0.18), FENCE_COLOR, p + Vector3(0, 0.45, 0)))
	add_child(Shapes.box(Vector3(PLOT_SIZE, 0.1, 0.1), FENCE_COLOR, Vector3(0, 0.55, -half)))
	add_child(Shapes.box(Vector3(0.1, 0.1, PLOT_SIZE), FENCE_COLOR, Vector3(-half, 0.55, 0)))


func _build_name_label() -> void:
	var label := Label3D.new()
	label.name = "NameLabel"
	label.text = info.name
	label.font = load("res://assets/fonts/NanumGothic-Bold.ttf")
	label.font_size = 96
	label.pixel_size = 0.01
	label.outline_size = 24
	label.modulate = Color.WHITE
	label.outline_modulate = Color("4a3426")
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	label.position = Vector3(0, 3.2, 0)
	add_child(label)
