extends Node
## 펫 초상화(UI에 쓰는 그림) 만들기.
## 펫 3D 모형을 작은 화면(SubViewport)에 한 번 찍어서, 펫 목록·도감 등에 그림으로 보여준다.
## 3D 모형을 바꾸면 초상화도 자동으로 바뀐다.

const SIZE := Vector2i(192, 192)

## 펫 종류 id -> SubViewport
var _viewports: Dictionary = {}


## 펫 종류의 초상화 그림을 돌려준다 (처음 요청 시 만든다)
func get_texture(species: String) -> Texture2D:
	if not _viewports.has(species):
		_viewports[species] = _make_viewport(species)
	return _viewports[species].get_texture()


func _make_viewport(species: String) -> SubViewport:
	var vp := SubViewport.new()
	vp.name = "Portrait_" + species
	vp.size = SIZE
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE
	add_child(vp)

	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.8, 0.82, 0.9)
	env.ambient_light_energy = 0.6
	var we := WorldEnvironment.new()
	we.environment = env
	vp.add_child(we)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, 30, 0)
	sun.light_energy = 0.75
	vp.add_child(sun)

	var cam := Camera3D.new()
	cam.fov = 30
	cam.position = Vector3(0, 1.25, 3.4)
	vp.add_child(cam)
	cam.look_at(Vector3(0, 0.6, 0))

	var pet := PetVisual.new()
	pet.rotation_degrees.y = 25
	vp.add_child(pet)
	pet.setup(species)
	return vp
