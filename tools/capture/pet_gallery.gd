extends Node
## 개발용: 펫 8종 초상화를 한 화면에 나열 (모형 확인용)
## tools/screenshot.sh build/pets.png 30 --scene=res://tools/capture/pet_gallery.tscn


func _ready() -> void:
	var bg := ColorRect.new()
	bg.color = Color("fff7e3")
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(bg)
	var grid := GridContainer.new()
	grid.columns = 4
	grid.position = Vector2(60, 30)
	grid.add_theme_constant_override("h_separation", 40)
	add_child(grid)
	for id in DataDB.pet_ids:
		var box := VBoxContainer.new()
		var tex := TextureRect.new()
		tex.texture = PetPortraits.get_texture(id)
		tex.custom_minimum_size = Vector2(240, 240)
		tex.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tex.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		box.add_child(tex)
		var label := Label.new()
		label.text = "%s (%s)" % [DataDB.get_pet(id).name, DataDB.pet_elements_text(id)]
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_color_override("font_color", Color("4a3426"))
		label.add_theme_font_size_override("font_size", 22)
		box.add_child(label)
		grid.add_child(box)
