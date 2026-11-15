extends Node3D
## 게임 월드: 잔디 바닥, 길, 주변 장식(나무·바위·꽃).
## 카메라·조명·작업장 부지는 world.tscn 에 배치되어 있다.

const GRASS := Color("8fcf6a")
const GRASS_DARK := Color("74b856")
const PATH := Color("dcc08a")
const TRUNK := Color("8a5a3b")
const LEAF := Color("4f9e4a")
const LEAF_LIGHT := Color("6fbf5a")
const ROCK := Color("b9b4aa")
const FLOWERS := [Color("ff8fa3"), Color("ffd166"), Color("ffffff"), Color("b39ddb")]

## 화면 기준 "가로" 방향 (카메라가 45도 돌아가 있어서 월드에서는 대각선)
const SCREEN_RIGHT := Vector3(0.7071, 0, -0.7071)
## 화면 기준 "안쪽(위)" 방향
const SCREEN_BACK := Vector3(-0.7071, 0, -0.7071)


func _ready() -> void:
	# 3D 물체(작업장) 마우스 클릭을 받으려면 켜야 한다
	get_viewport().physics_object_picking = true
	_build_ground()
	_build_paths()
	_build_decor()


func _build_ground() -> void:
	var ground := Shapes.box(Vector3(60, 1, 60), GRASS, Vector3(0, -0.5, 0), false)
	ground.name = "Ground"
	add_child(ground)
	# 잔디 얼룩 (단조로움 방지)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 26:
		var p := Vector3(rng.randf_range(-18, 18), 0.005, rng.randf_range(-18, 18))
		var s := rng.randf_range(1.2, 2.6)
		add_child(Shapes.box(Vector3(s, 0.01, s * 0.7), GRASS_DARK, p, false))


## 화면 기준 좌표(가로 sx, 깊이 sd)를 월드 좌표로 바꾼다.
func _screen_to_world(sx: float, sd: float) -> Vector3:
	return SCREEN_RIGHT * sx + SCREEN_BACK * sd


## 작업장 배치 (화면 기준 가로 sx, 깊이 sd) — world.tscn 의 Plots 위치와 같음
const PLOT_SCREEN_POS := [Vector2(-6.5, -1.5), Vector2(0, 3.0), Vector2(6.5, -1.5)]
const ROAD_DEPTH := -6.0


func _build_paths() -> void:
	# 앞쪽을 가로지르는 큰 길
	var road := Shapes.box(Vector3(30, 0.04, 1.8), PATH, _screen_to_world(0, ROAD_DEPTH) + Vector3(0, 0.02, 0), false)
	road.rotation.y = deg_to_rad(45)
	add_child(road)
	# 큰 길에서 안쪽 광산으로 이어지는 길
	var length := 5.2
	var branch := Shapes.box(Vector3(1.4, 0.04, length), PATH, _screen_to_world(0, ROAD_DEPTH + length / 2.0) + Vector3(0, 0.02, 0), false)
	branch.rotation.y = deg_to_rad(45)
	add_child(branch)


func _build_decor() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	# 뒤쪽 숲 (화면 위쪽)
	for i in 26:
		var sx := rng.randf_range(-17, 17)
		var sd := rng.randf_range(7.0, 11.0)
		if absf(sx) < 4.0:
			sd += 0.8
		_add_tree(_screen_to_world(sx, sd), rng.randf_range(0.8, 1.25), rng.randi() % 2 == 0)
	# 광산 양옆 숲
	for p in [Vector2(-8.0, 4.0), Vector2(-10.5, 4.8), Vector2(-6.5, 6.2), Vector2(8.0, 4.0), Vector2(10.5, 4.6), Vector2(6.6, 6.0)]:
		_add_tree(_screen_to_world(p.x, p.y), rng.randf_range(0.85, 1.15), rng.randi() % 2 == 0)
	# 양옆 가장자리 나무
	for p in [Vector2(-13.5, -0.5), Vector2(-14.5, 1.5), Vector2(13.5, -0.5), Vector2(14.5, 1.5), Vector2(-12.5, -8.5), Vector2(12.5, -8.5)]:
		_add_tree(_screen_to_world(p.x, p.y), rng.randf_range(0.8, 1.05), rng.randi() % 2 == 0)
	# 바위
	for p in [Vector2(-3.4, 0.6), Vector2(3.6, 0.4), Vector2(-11.5, -3.5), Vector2(11.0, -4.0)]:
		_add_rock(_screen_to_world(p.x, p.y), rng.randf_range(0.4, 0.65))
	# 길가 꽃
	for i in 36:
		var sx := rng.randf_range(-15, 15)
		var sd := ROAD_DEPTH - 1.2 if rng.randi() % 2 == 0 else ROAD_DEPTH + 1.15
		if sd > ROAD_DEPTH and (absf(sx) < 1.3 or absf(absf(sx) - 6.5) < 3.2):
			continue
		var c: Color = FLOWERS[rng.randi() % FLOWERS.size()]
		add_child(Shapes.sphere(0.12, c, _screen_to_world(sx, sd + rng.randf_range(-0.25, 0.25)) + Vector3(0, 0.12, 0)))


func _add_tree(pos: Vector3, scale_f: float, round_tree: bool) -> void:
	var tree := Node3D.new()
	tree.position = pos
	tree.scale = Vector3.ONE * scale_f
	tree.add_child(Shapes.cylinder(0.18, 1.0, TRUNK, Vector3(0, 0.5, 0)))
	if round_tree:
		tree.add_child(Shapes.sphere(0.85, LEAF_LIGHT, Vector3(0, 1.6, 0)))
	else:
		tree.add_child(Shapes.cone(0.9, 1.4, LEAF, Vector3(0, 1.4, 0)))
		tree.add_child(Shapes.cone(0.65, 1.1, LEAF, Vector3(0, 2.1, 0)))
	add_child(tree)


func _add_rock(pos: Vector3, size: float) -> void:
	var rock := Shapes.sphere(size, ROCK, pos + Vector3(0, size * 0.35, 0))
	rock.scale = Vector3(1.0, 0.6, 0.85)
	add_child(rock)
