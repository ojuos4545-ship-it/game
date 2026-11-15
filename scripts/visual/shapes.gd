class_name Shapes
## 단순 도형(상자·원기둥·공·원뿔)을 만드는 도우미.
## 임시 그래픽은 전부 이 도형들의 조합이다. 나중에 실제 모델로 바꿀 때 이 부분만 교체된다.


static func material(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.85
	return m


static func _make(mesh: Mesh, color: Color, pos: Vector3, shadow := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = material(color)
	mi.position = pos
	if not shadow:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


static func box(size: Vector3, color: Color, pos := Vector3.ZERO, shadow := true) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	return _make(mesh, color, pos, shadow)


static func cylinder(radius: float, height: float, color: Color, pos := Vector3.ZERO) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = radius
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 12
	return _make(mesh, color, pos)


static func cone(radius: float, height: float, color: Color, pos := Vector3.ZERO) -> MeshInstance3D:
	var mesh := CylinderMesh.new()
	mesh.top_radius = 0.0
	mesh.bottom_radius = radius
	mesh.height = height
	mesh.radial_segments = 10
	return _make(mesh, color, pos)


static func sphere(radius: float, color: Color, pos := Vector3.ZERO) -> MeshInstance3D:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 16
	mesh.rings = 8
	return _make(mesh, color, pos)
