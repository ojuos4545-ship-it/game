class_name PetVisual
extends Node3D
## 펫의 3D 모습. data/pets.json 의 look(생김새 종류)·color·accent 로 단순 도형을 조합해 만든다.
## 나중에 실제 3D 모델로 바꿀 때는 이 파일의 _build_* 부분만 모델 불러오기로 교체하면 된다.
## 펫은 +Z 방향(앞)을 바라보도록 만든다. 키는 약 1.2 정도.

## 도구가 대상(나무·바위·덤불)에 닿는 순간 (작업장이 대상 흔들기·부스러기 효과에 사용)
signal work_hit

const EYE := Color("2b2118")
const HANDLE := Color("8a5a3b")
const METAL := Color("b8c0c8")
const BERRY := Color("e0566b")
const WHITE := Color("ffffff")
const CHEEK := Color("ff9eb5")

var species_id := ""
## 모든 도형이 붙는 부모 (애니메이션은 이 노드를 움직인다)
var model: Node3D

var _idle_tween: Tween
var _work_tween: Tween
## 도구를 쥐는 어깨 위치 (도구는 이 점을 중심으로 휘두른다)
var _tool_pivot: Node3D
## 수확 동작에서 손에 드는 열매
var _held_berry: Node3D


func setup(species: String) -> void:
	species_id = species
	if model:
		model.queue_free()
	model = Node3D.new()
	model.name = "Model"
	add_child(model)
	var info := DataDB.get_pet(species)
	if info.is_empty():
		push_error("[PetVisual] 없는 펫: " + species)
		return
	var c: Color = info.color
	var a: Color = info.accent
	match info.look:
		"squirrel": _build_squirrel(c, a)
		"turtle": _build_turtle(c, a)
		"frog": _build_frog(c, a)
		"chick": _build_chick(c, a)
		"bear": _build_bear(c, a)
		"mole": _build_mole(c, a)
		"beaver": _build_beaver(c, a)
		"fox": _build_fox(c, a)
		_:
			push_error("[PetVisual] 모르는 생김새: " + str(info.look))
			_add(Shapes.sphere(0.4, c, Vector3(0, 0.4, 0)))


## 제자리에서 숨 쉬듯 통통 (쉬는 동작)
func play_idle() -> void:
	stop_animation()
	_idle_tween = create_tween().set_loops()
	_idle_tween.tween_property(model, "scale", Vector3(1.04, 0.95, 1.04), 0.5).set_trans(Tween.TRANS_SINE)
	_idle_tween.tween_property(model, "scale", Vector3.ONE, 0.5).set_trans(Tween.TRANS_SINE)


func stop_animation() -> void:
	if _idle_tween:
		_idle_tween.kill()
	if _work_tween:
		_work_tween.kill()
	if model:
		model.scale = Vector3.ONE
		model.rotation = Vector3.ZERO
		model.position = Vector3.ZERO
	if _tool_pivot:
		_tool_pivot.queue_free()
		_tool_pivot = null
	if _held_berry:
		_held_berry.queue_free()
		_held_berry = null


## 노동 동작 반복: "chop"(도끼질) / "mine"(곡괭이질) / "harvest"(수확)
## phase(0~1)로 시작 시점을 어긋나게 하면 여러 펫이 똑같이 움직이지 않는다.
func play_work(kind: String, phase := 0.0) -> void:
	stop_animation()
	match kind:
		"chop":
			_make_tool(false)
			_start_swing(-45.0, 95.0, 0.45, 0.13)
		"mine":
			_make_tool(true)
			_start_swing(-60.0, 110.0, 0.5, 0.12)
		"harvest":
			_start_harvest()
		_:
			play_idle()
			return
	_work_tween.custom_step(phase * 0.9)


func is_working() -> bool:
	return _work_tween != null and _work_tween.is_valid()


# ---------------- 노동 동작 ----------------

## 도끼(false) 또는 곡괭이(true)를 오른손(어깨)에 쥐여 준다. 도구는 위(+Y)로 뻗어 있다.
func _make_tool(pickaxe: bool) -> void:
	_tool_pivot = Node3D.new()
	_tool_pivot.name = "ToolPivot"
	# 카메라 쪽(왼손)에 들어야 몸에 가려지지 않는다
	_tool_pivot.position = Vector3(-0.36, 0.62, 0.05)
	model.add_child(_tool_pivot)
	_tool_pivot.add_child(Shapes.cylinder(0.035, 0.72, HANDLE, Vector3(0, 0.36, 0)))
	if pickaxe:
		var head := Shapes.box(Vector3(0.07, 0.07, 0.46), METAL, Vector3(0, 0.7, 0))
		_tool_pivot.add_child(head)
		for z in [-1, 1]:
			var tip := Shapes.cone(0.04, 0.12, METAL, Vector3(0, 0.7, z * 0.28))
			tip.rotation_degrees.x = z * 90
			_tool_pivot.add_child(tip)
	else:
		_tool_pivot.add_child(Shapes.box(Vector3(0.05, 0.2, 0.22), METAL, Vector3(0, 0.62, 0.1)))
		_tool_pivot.add_child(Shapes.box(Vector3(0.06, 0.2, 0.03), Color("e8eef2"), Vector3(0, 0.62, 0.22)))
	_tool_pivot.rotation_degrees.x = raise_angle_default()


func raise_angle_default() -> float:
	return -45.0


## 도구를 뒤로 들었다가(raise) 앞으로 내려친다(strike). 내려치는 순간 work_hit.
func _start_swing(raise_deg: float, strike_deg: float, raise_time: float, strike_time: float) -> void:
	_work_tween = create_tween().set_loops()
	_work_tween.tween_property(_tool_pivot, "rotation_degrees:x", raise_deg, raise_time).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_work_tween.parallel().tween_property(model, "rotation_degrees:x", -7.0, raise_time)
	_work_tween.tween_property(_tool_pivot, "rotation_degrees:x", strike_deg, strike_time).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	_work_tween.parallel().tween_property(model, "rotation_degrees:x", 12.0, strike_time)
	_work_tween.tween_callback(work_hit.emit)
	_work_tween.tween_interval(0.22)


## 몸을 숙여 덤불에서 열매를 따고, 일어나며 열매를 들어 올린 뒤 콩 뛴다.
func _start_harvest() -> void:
	_held_berry = Shapes.sphere(0.09, BERRY, Vector3(0, 0.45, 0.42))
	_held_berry.visible = false
	model.add_child(_held_berry)
	_work_tween = create_tween().set_loops()
	_work_tween.tween_property(model, "rotation_degrees:x", 38.0, 0.4).set_trans(Tween.TRANS_SINE)
	_work_tween.tween_callback(work_hit.emit)
	_work_tween.tween_callback(func(): _held_berry.visible = true)
	_work_tween.tween_interval(0.15)
	_work_tween.tween_property(model, "rotation_degrees:x", -8.0, 0.35).set_trans(Tween.TRANS_SINE)
	_work_tween.parallel().tween_property(_held_berry, "position", Vector3(0, 0.95, 0.38), 0.35)
	_work_tween.tween_property(model, "position:y", 0.14, 0.12).set_ease(Tween.EASE_OUT)
	_work_tween.tween_property(model, "position:y", 0.0, 0.12).set_ease(Tween.EASE_IN)
	_work_tween.tween_callback(func():
		_held_berry.visible = false
		_held_berry.position = Vector3(0, 0.45, 0.42))
	_work_tween.tween_property(model, "rotation_degrees:x", 0.0, 0.2)
	_work_tween.tween_interval(0.15)


# ---------------- 공통 부품 ----------------

func _add(mi: Node3D, scale_v := Vector3.ONE, rot_deg := Vector3.ZERO) -> Node3D:
	mi.scale = scale_v
	mi.rotation_degrees = rot_deg
	model.add_child(mi)
	return mi


## 머리(중심 head, 반지름 r) 앞쪽에 눈 두 개와 볼터치
func _face(head: Vector3, r: float, cheeks := true) -> void:
	for side in [-1, 1]:
		_add(Shapes.sphere(r * 0.16, EYE, head + Vector3(side * r * 0.38, r * 0.12, r * 0.86)))
		_add(Shapes.sphere(r * 0.06, WHITE, head + Vector3(side * r * 0.38 + 0.015, r * 0.2, r * 0.98)))
		if cheeks:
			_add(Shapes.sphere(r * 0.13, CHEEK, head + Vector3(side * r * 0.62, -r * 0.18, r * 0.72)), Vector3(1, 0.6, 0.5))


func _feet(color: Color, spread := 0.18, z := 0.12) -> void:
	for side in [-1, 1]:
		_add(Shapes.sphere(0.1, color, Vector3(side * spread, 0.06, z)), Vector3(1, 0.6, 1.3))


# ---------------- 펫별 생김새 ----------------

func _build_squirrel(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.36, c, Vector3(0, 0.38, 0)), Vector3(1, 1.05, 0.95))
	_add(Shapes.sphere(0.24, a, Vector3(0, 0.36, 0.25)), Vector3(1, 1.1, 0.6))
	var head := Vector3(0, 0.86, 0.05)
	_add(Shapes.sphere(0.29, c, head))
	for side in [-1, 1]:
		_add(Shapes.sphere(0.09, c, head + Vector3(side * 0.17, 0.24, -0.04)))
	_face(head, 0.29)
	# 큰 꼬리
	_add(Shapes.sphere(0.3, a, Vector3(0, 0.72, -0.42)), Vector3(0.8, 1.45, 0.75), Vector3(-15, 0, 0))
	# 도토리 모자
	_add(Shapes.sphere(0.2, Color("6b4226"), head + Vector3(0, 0.24, -0.02)), Vector3(1.05, 0.55, 1.05))
	_add(Shapes.cylinder(0.025, 0.12, Color("4a2c18"), head + Vector3(0, 0.37, -0.02)))
	_feet(c)


func _build_turtle(c: Color, a: Color) -> void:
	for x in [-1, 1]:
		for z in [-1, 1]:
			_add(Shapes.cylinder(0.08, 0.2, c, Vector3(x * 0.26, 0.1, z * 0.22)))
	# 돌 등껍질
	_add(Shapes.sphere(0.45, a, Vector3(0, 0.36, -0.02)), Vector3(1, 0.62, 1.05))
	for p in [Vector3(0, 0.62, 0), Vector3(-0.2, 0.55, 0.15), Vector3(0.2, 0.55, -0.12), Vector3(0.05, 0.52, -0.28)]:
		_add(Shapes.sphere(0.09, a.lightened(0.25), p), Vector3(1, 0.5, 1))
	var head := Vector3(0, 0.45, 0.48)
	_add(Shapes.sphere(0.2, c, head))
	_face(head, 0.2)
	_add(Shapes.sphere(0.07, c, Vector3(0, 0.25, -0.5)))


func _build_frog(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.4, c, Vector3(0, 0.36, 0)), Vector3(1.15, 0.85, 1))
	_add(Shapes.sphere(0.27, a, Vector3(0, 0.28, 0.2)), Vector3(1.1, 0.85, 0.6))
	# 머리 위 물방울 뿔
	_add(Shapes.cone(0.12, 0.26, c, Vector3(0, 0.78, -0.08)))
	# 툭 튀어나온 눈
	for side in [-1, 1]:
		var e := Vector3(side * 0.18, 0.66, 0.12)
		_add(Shapes.sphere(0.13, WHITE, e))
		_add(Shapes.sphere(0.065, EYE, e + Vector3(0, 0.01, 0.1)))
		_add(Shapes.sphere(0.06, CHEEK, Vector3(side * 0.3, 0.38, 0.3)), Vector3(1, 0.6, 0.5))
	_add(Shapes.box(Vector3(0.16, 0.02, 0.02), EYE, Vector3(0, 0.45, 0.39)))
	_feet(c, 0.26, 0.2)


func _build_chick(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.32, c, Vector3(0, 0.34, 0)))
	var head := Vector3(0, 0.78, 0.03)
	# 해바라기 꽃잎 (머리 뒤 둥글게)
	for i in 10:
		var ang := TAU * i / 10.0
		var p := head + Vector3(cos(ang) * 0.3, sin(ang) * 0.3, -0.08)
		_add(Shapes.sphere(0.1, a, p), Vector3(1, 1, 0.4))
	_add(Shapes.sphere(0.25, c, head))
	_face(head, 0.25)
	_add(Shapes.cone(0.06, 0.14, a, head + Vector3(0, -0.05, 0.28)), Vector3.ONE, Vector3(90, 0, 0))
	for side in [-1, 1]:
		_add(Shapes.sphere(0.12, c.darkened(0.08), Vector3(side * 0.3, 0.38, -0.02)), Vector3(0.5, 1, 1))
	_feet(a, 0.12, 0.1)


func _build_bear(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.44, c, Vector3(0, 0.44, 0)), Vector3(1.05, 1, 0.95))
	_add(Shapes.sphere(0.28, c.lightened(0.25), Vector3(0, 0.4, 0.31)), Vector3(1, 1.1, 0.6))
	var head := Vector3(0, 0.98, 0.08)
	_add(Shapes.sphere(0.32, c, head))
	for side in [-1, 1]:
		_add(Shapes.sphere(0.1, c, head + Vector3(side * 0.23, 0.24, -0.04)))
	_add(Shapes.sphere(0.12, c.lightened(0.35), head + Vector3(0, -0.08, 0.28)), Vector3(1.2, 0.85, 0.8))
	_add(Shapes.sphere(0.04, EYE, head + Vector3(0, -0.03, 0.39)))
	_face(head, 0.32, false)
	# 이끼
	for p in [Vector3(0, 0.75, -0.3), Vector3(-0.22, 0.6, -0.28), Vector3(0.2, 0.55, -0.32), head + Vector3(0, 0.29, -0.05)]:
		_add(Shapes.sphere(0.15, a, p), Vector3(1, 0.55, 1))
	_feet(c, 0.22, 0.15)


func _build_mole(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.4, c, Vector3(0, 0.38, 0)), Vector3(1, 0.95, 1.15))
	_add(Shapes.sphere(0.1, CHEEK, Vector3(0, 0.42, 0.48)))
	# 빛나는 이마
	_add(Shapes.make_glow(Shapes.sphere(0.1, a, Vector3(0, 0.7, 0.3)), a, 2.0))
	for side in [-1, 1]:
		_add(Shapes.sphere(0.04, EYE, Vector3(side * 0.13, 0.55, 0.4)))
		_add(Shapes.sphere(0.09, Color("f2d7c9"), Vector3(side * 0.3, 0.16, 0.3)), Vector3(1.2, 0.5, 1))
	_add(Shapes.sphere(0.06, c, Vector3(0, 0.3, -0.48)))


func _build_beaver(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.4, c, Vector3(0, 0.4, 0)), Vector3(1, 1, 0.95))
	_add(Shapes.sphere(0.26, c.lightened(0.25), Vector3(0, 0.38, 0.28)), Vector3(1, 1.1, 0.6))
	var head := Vector3(0, 0.88, 0.06)
	_add(Shapes.sphere(0.28, c, head))
	for side in [-1, 1]:
		_add(Shapes.sphere(0.07, c.darkened(0.2), head + Vector3(side * 0.21, 0.17, -0.02)))
	_face(head, 0.28, false)
	_add(Shapes.sphere(0.1, c.lightened(0.3), head + Vector3(0, -0.08, 0.24)), Vector3(1.3, 0.8, 0.8))
	_add(Shapes.box(Vector3(0.09, 0.08, 0.03), WHITE, head + Vector3(0, -0.19, 0.27)))
	# 통나무 꼬리 (뒤로 비스듬히 세움, 끝에 나이테)
	_add(Shapes.cylinder(0.17, 0.8, a, Vector3(0, 0.3, -0.55)), Vector3.ONE, Vector3(-70, 0, 0))
	_add(Shapes.cylinder(0.13, 0.02, Color("f1d3a2"), Vector3(0, 0.44, -0.93)), Vector3.ONE, Vector3(-70, 0, 0))
	_feet(c.darkened(0.15))


func _build_fox(c: Color, a: Color) -> void:
	_add(Shapes.sphere(0.36, c, Vector3(0, 0.38, 0)), Vector3(0.95, 1, 1.1))
	var head := Vector3(0, 0.86, 0.08)
	_add(Shapes.sphere(0.28, c, head))
	for side in [-1, 1]:
		_add(Shapes.cone(0.1, 0.26, c, head + Vector3(side * 0.15, 0.3, -0.02)), Vector3.ONE, Vector3(0, 0, -side * 12))
		_add(Shapes.cone(0.05, 0.14, a, head + Vector3(side * 0.15, 0.29, 0.03)), Vector3.ONE, Vector3(0, 0, -side * 12))
	_add(Shapes.cone(0.1, 0.18, c, head + Vector3(0, -0.07, 0.3)), Vector3.ONE, Vector3(90, 0, 0))
	_add(Shapes.sphere(0.035, EYE, head + Vector3(0, -0.07, 0.4)))
	_face(head, 0.28)
	# 무지개 꼬리
	var rainbow := [Color("ff6b6b"), Color("ffa94d"), Color("ffd43b"), Color("69db7c"), Color("4dabf7"), Color("b197fc")]
	for i in rainbow.size():
		var t := float(i) / (rainbow.size() - 1)
		var p := Vector3(0, 0.3 + t * 0.62, -0.4 - sin(t * PI) * 0.22)
		_add(Shapes.sphere(0.17 - t * 0.04, rainbow[i], p))
	_feet(c)
