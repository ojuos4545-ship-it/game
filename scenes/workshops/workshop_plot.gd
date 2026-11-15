extends Node3D
## 작업장 한 곳: 땅·울타리·이름표 + 작업 대상(나무/바위/덤불) + 일하는 펫 + 클릭하면 작업장 창 열기.
## 생산이 일어나면 펫 머리 위로 "+N"이 떠오르고, 도구가 닿으면 대상이 흔들리며 부스러기가 튄다.

const PLOT_SIZE := 5.0
const FENCE_COLOR := Color("8a5a3b")
const PET_SCALE := 1.0

## 작업 자리 (화면 기준 가로 sx, 깊이 sd). 펫은 오른쪽 앞 대각선의 대상을 바라보며 일한다.
const SLOT_SCREEN_POS := [Vector2(-1.9, 0.5), Vector2(-0.2, 1.5), Vector2(-0.4, -1.1), Vector2(1.2, 0.0)]
## 펫 → 대상 방향 (화면 오른쪽에서 카메라 쪽으로 25도)
const WORK_DIR := Vector3(0.94, 0, -0.34)
const TARGET_DIST := 0.95

## data/workshops.json 의 id (lumber / mine / farm)
@export var workshop_id: String = ""

var info: Dictionary = {}
## uid -> PetVisual (일하는 펫)
var worker_visuals: Dictionary = {}
## 자리 번호 -> 작업 대상 노드
var targets: Dictionary = {}

var _stations: Node3D
var _name_label: Label3D
var _status_label: Label3D
var _signature := ""


func _ready() -> void:
	info = DataDB.get_workshop(workshop_id)
	if info.is_empty():
		push_error("[WorkshopPlot] 데이터 없음: " + workshop_id)
		return
	_build_ground()
	_build_fence()
	_build_props()
	_build_labels()
	_build_click_area()
	_stations = Node3D.new()
	_stations.name = "Stations"
	add_child(_stations)
	GameState.workshop_changed.connect(_on_workshop_changed)
	GameState.pets_changed.connect(_rebuild_if_changed)
	GameState.produced.connect(_on_produced)
	_rebuild_if_changed()
	_update_status()


## 작업 자리의 부지 안 좌표
static func slot_position(slot: int) -> Vector3:
	var p: Vector2 = SLOT_SCREEN_POS[slot]
	return Iso.screen(p.x, p.y)


# ---------------- 만들기 ----------------

func _build_ground() -> void:
	add_child(Shapes.box(Vector3(PLOT_SIZE, 0.2, PLOT_SIZE), info.plot_color, Vector3(0, 0.1, 0), false))


func _build_fence() -> void:
	var half := PLOT_SIZE / 2.0
	# 화면 안쪽 두 변에만 울타리 (앞쪽 두 변은 펫이 잘 보이도록 비워 둠)
	for p in [Vector3(-half, 0, -half), Vector3(half, 0, -half), Vector3(-half, 0, half)]:
		add_child(Shapes.box(Vector3(0.18, 0.7, 0.18), FENCE_COLOR, p + Vector3(0, 0.45, 0)))
	add_child(Shapes.box(Vector3(PLOT_SIZE, 0.1, 0.1), FENCE_COLOR, Vector3(0, 0.55, -half)))
	add_child(Shapes.box(Vector3(0.1, 0.1, PLOT_SIZE), FENCE_COLOR, Vector3(-half, 0.55, 0)))


## 작업장마다 뒤쪽 모서리에 놓는 장식 (통나무 더미 / 광석 더미 / 우물)
func _build_props() -> void:
	var corner := Iso.screen(0, 2.5, 0.2)
	match info.work:
		"chop":
			for i in 3:
				var log := Shapes.cylinder(0.16, 1.1, Color("a0703f"), corner + Vector3(0, 0.16 + (0.27 if i == 2 else 0.0), -0.18 + 0.34 * (i % 2) + (0.17 if i == 2 else 0.0)))
				log.rotation_degrees.z = 90
				add_child(log)
			add_child(Shapes.cylinder(0.25, 0.3, Color("8a5a3b"), corner + Iso.screen(1.3, -0.6, 0.15)))
			add_child(Shapes.cylinder(0.2, 0.02, Color("e6c38f"), corner + Iso.screen(1.3, -0.6, 0.31)))
		"mine":
			add_child(_make_rock(0.55, corner + Vector3(0, 0, 0), 3))
			add_child(_make_rock(0.35, corner + Iso.screen(1.0, -0.4), 1))
			# 광석 수레
			var cart := corner + Iso.screen(-1.1, -0.5)
			add_child(Shapes.box(Vector3(0.6, 0.3, 0.4), Color("6b4a33"), cart + Vector3(0, 0.3, 0)))
			add_child(Shapes.sphere(0.12, Color("7fb3e6"), cart + Vector3(-0.1, 0.48, 0)))
			add_child(Shapes.sphere(0.1, Color("7fb3e6"), cart + Vector3(0.12, 0.47, 0.05)))
			for x in [-0.2, 0.2]:
				for z in [-0.21, 0.21]:
					var w := Shapes.cylinder(0.08, 0.04, Color("3d3d3d"), cart + Vector3(x, 0.1, z))
					w.rotation_degrees.x = 90
					add_child(w)
		"harvest":
			# 우물
			add_child(Shapes.cylinder(0.4, 0.45, Color("a9a59c"), corner + Vector3(0, 0.22, 0)))
			add_child(Shapes.cylinder(0.32, 0.03, Color("3fa7e0"), corner + Vector3(0, 0.44, 0)))
			for x in [-0.33, 0.33]:
				add_child(Shapes.box(Vector3(0.06, 0.7, 0.06), Color("8a5a3b"), corner + Vector3(x, 0.75, 0)))
			add_child(Shapes.box(Vector3(0.9, 0.06, 0.5), Color("b5562f"), corner + Vector3(0, 1.12, 0)))
			# 새싹 줄
			for i in 4:
				add_child(Shapes.cone(0.08, 0.22, Color("6fbf5a"), corner + Iso.screen(-1.4 + i * 0.3, -1.0, 0.11)))


func _build_labels() -> void:
	_name_label = _make_label3d(72, 20)
	_name_label.name = "NameLabel"
	_name_label.text = info.name
	_name_label.position = Vector3(0, 3.05, 0)
	add_child(_name_label)
	_status_label = _make_label3d(44, 14)
	_status_label.name = "StatusLabel"
	_status_label.position = Vector3(0, 2.3, 0)
	add_child(_status_label)


func _make_label3d(font_size: int, outline: int) -> Label3D:
	var label := Label3D.new()
	label.font = load("res://assets/fonts/NanumGothic-Bold.ttf")
	label.font_size = font_size
	label.pixel_size = 0.01
	label.outline_size = outline
	label.modulate = Color.WHITE
	label.outline_modulate = Color("4a3426")
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.no_depth_test = true
	return label


## 부지 전체를 덮는 클릭 영역
func _build_click_area() -> void:
	var area := Area3D.new()
	area.name = "ClickArea"
	var shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(PLOT_SIZE, 2.5, PLOT_SIZE)
	shape.shape = box
	shape.position = Vector3(0, 1.25, 0)
	area.add_child(shape)
	area.input_event.connect(_on_area_input)
	area.mouse_entered.connect(_on_hover.bind(true))
	area.mouse_exited.connect(_on_hover.bind(false))
	add_child(area)


func _make_target(slot: int) -> Node3D:
	var t := Node3D.new()
	t.name = "Target%d" % slot
	t.position = slot_position(slot) + WORK_DIR * TARGET_DIST + Vector3(0, 0.2, 0)
	match info.work:
		"chop":
			t.add_child(Shapes.cylinder(0.13, 0.9, Color("8a5a3b"), Vector3(0, 0.45, 0)))
			t.add_child(Shapes.cone(0.5, 0.8, Color("4f9e4a"), Vector3(0, 1.15, 0)))
			t.add_child(Shapes.cone(0.36, 0.6, Color("5fae55"), Vector3(0, 1.5, 0)))
		"mine":
			t.add_child(_make_rock(0.36, Vector3.ZERO, 2))
		"harvest":
			var bush := Shapes.sphere(0.32, Color("4f9e4a"), Vector3(0, 0.26, 0))
			bush.scale = Vector3(1.1, 0.85, 1.1)
			t.add_child(bush)
			for p in [Vector3(0.18, 0.4, 0.2), Vector3(-0.15, 0.35, 0.25), Vector3(0.05, 0.52, 0.12), Vector3(0.28, 0.25, -0.05), Vector3(-0.25, 0.42, -0.08)]:
				t.add_child(Shapes.sphere(0.065, Color("e0566b"), p))
	return t


## 회색 바위 + 파란 광석 결정
func _make_rock(size: float, pos: Vector3, crystals: int) -> Node3D:
	var n := Node3D.new()
	n.position = pos
	var rock := Shapes.sphere(size, Color("8d8a84"), Vector3(0, size * 0.55, 0))
	rock.scale = Vector3(1.1, 0.8, 1.0)
	n.add_child(rock)
	for i in crystals:
		var ang := TAU * i / maxi(crystals, 1) + 0.6
		var c := Shapes.box(Vector3(0.1, 0.24, 0.1), Color("7fb3e6"), Vector3(cos(ang) * size * 0.5, size * 1.05, sin(ang) * size * 0.4))
		c.rotation_degrees = Vector3(15, ang * 50, 20)
		Shapes.make_glow(c, Color("7fb3e6"), 0.4)
		n.add_child(c)
	return n


# ---------------- 일하는 펫 다시 배치 ----------------

## 배치·레벨이 바뀌었을 때만 다시 만든다 (애니메이션이 매번 처음으로 돌아가지 않게)
func _rebuild_if_changed() -> void:
	var sig := "L%d" % WorkshopSystem.level(workshop_id)
	var ws_workers := WorkshopSystem.workers(workshop_id)
	for s in ws_workers:
		sig += "|%d:%d" % [s, ws_workers[s].uid]
	if sig == _signature:
		return
	_signature = sig
	_rebuild()


func _rebuild() -> void:
	for c in _stations.get_children():
		c.queue_free()
	worker_visuals.clear()
	targets.clear()
	var ws_workers := WorkshopSystem.workers(workshop_id)
	for slot in WorkshopSystem.slot_count(workshop_id):
		var target := _make_target(slot)
		_stations.add_child(target)
		targets[slot] = target
		if ws_workers.has(slot):
			var pet: Dictionary = ws_workers[slot]
			var v := PetVisual.new()
			v.name = "Worker_%d" % pet.uid
			v.position = slot_position(slot) + Vector3(0, 0.2, 0)
			v.scale = Vector3.ONE * PET_SCALE
			v.rotation.y = Iso.face_yaw(WORK_DIR)
			_stations.add_child(v)
			v.setup(pet.species)
			v.play_work(info.work, fmod(slot * 0.37, 1.0))
			v.work_hit.connect(_on_work_hit.bind(slot))
			worker_visuals[pet.uid] = v


# ---------------- 반응 ----------------

func _on_workshop_changed(id: String) -> void:
	if id != workshop_id:
		return
	_rebuild_if_changed()
	_update_status()


func _update_status() -> void:
	var res_name: String = DataDB.get_resource(info.resource).name
	var cap := WorkshopSystem.capacity(workshop_id)
	var stored_i := int(floor(WorkshopSystem.stored(workshop_id) + 0.001))
	_name_label.text = "%s Lv%d" % [info.name, WorkshopSystem.level(workshop_id)]
	if WorkshopSystem.auto_collect():
		var rate := WorkshopSystem.total_output(workshop_id)
		if rate > 0.0:
			_status_label.text = "%s +%s / %s초" % [res_name, Iso.fmt(rate), Iso.fmt(DataDB.balance.production_interval)]
			_status_label.modulate = Color.WHITE
		else:
			_status_label.text = "일꾼 없음 · 눌러서 배치"
			_status_label.modulate = Color("ffd166")
	elif WorkshopSystem.is_full(workshop_id):
		_status_label.text = "%s 가득! 눌러서 수집" % res_name
		_status_label.modulate = Color("ffd166")
	else:
		_status_label.text = "%s %d/%d" % [res_name, stored_i, cap]
		_status_label.modulate = Color.WHITE


func get_status_text() -> String:
	return _status_label.text


## 생산 시 펫 머리 위로 "+N" 글자가 떠올랐다 사라진다
func _on_produced(ws: String, uid: int, amount: float) -> void:
	if ws != workshop_id or not worker_visuals.has(uid):
		return
	var v: Node3D = worker_visuals[uid]
	var label := _make_label3d(60, 18)
	label.name = "FloatText"
	label.text = "+" + Iso.fmt(amount)
	label.modulate = Color("fff3c4")
	label.outline_modulate = DataDB.get_resource(info.resource).color.darkened(0.35)
	label.position = v.position + Vector3(0, 1.25, 0)
	_stations.add_child(label)
	var tw := label.create_tween()
	tw.tween_property(label, "position:y", label.position.y + 0.7, 1.1).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(label, "modulate:a", 0.0, 1.1).set_delay(0.4)
	tw.tween_callback(label.queue_free)


## 도구가 닿으면 대상이 흔들리고 부스러기가 튄다
func _on_work_hit(slot: int) -> void:
	var t: Node3D = targets.get(slot)
	if not is_instance_valid(t):
		return
	var tw := t.create_tween()
	tw.tween_property(t, "rotation_degrees:z", 7.0, 0.05)
	tw.tween_property(t, "rotation_degrees:z", -5.0, 0.08)
	tw.tween_property(t, "rotation_degrees:z", 0.0, 0.08)
	var chip_color: Color = {"chop": Color("d9a066"), "mine": Color("b9b4aa"), "harvest": Color("6fbf5a")}.get(info.work, Color.WHITE)
	for i in 3:
		var chip := Shapes.box(Vector3(0.07, 0.07, 0.07), chip_color, t.position + Vector3(0, 0.5, 0), false)
		_stations.add_child(chip)
		var dir := Vector3(randf_range(-0.5, 0.5), 0, randf_range(-0.5, 0.5))
		var ctw := chip.create_tween()
		ctw.tween_property(chip, "position", chip.position + dir + Vector3(0, 0.45, 0), 0.25).set_ease(Tween.EASE_OUT)
		ctw.tween_property(chip, "position:y", 0.25, 0.2).set_ease(Tween.EASE_IN)
		ctw.tween_property(chip, "scale", Vector3.ZERO, 0.15)
		ctw.tween_callback(chip.queue_free)


func _on_area_input(_camera: Node, event: InputEvent, _pos: Vector3, _normal: Vector3, _shape: int) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		get_tree().call_group("hud", "open_workshop", workshop_id)


func _on_hover(inside: bool) -> void:
	_name_label.modulate = Color("ffe8a3") if inside else Color.WHITE
	Input.set_default_cursor_shape(Input.CURSOR_POINTING_HAND if inside else Input.CURSOR_ARROW)
