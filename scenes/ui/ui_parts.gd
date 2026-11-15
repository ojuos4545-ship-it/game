class_name UIParts
## 여러 화면에서 함께 쓰는 작은 UI 조각 만들기.


static func label(text: String, variation := &"", align := HORIZONTAL_ALIGNMENT_CENTER) -> Label:
	var l := Label.new()
	l.text = text
	l.horizontal_alignment = align
	if variation != &"":
		l.theme_type_variation = variation
	return l


static func portrait(species: String, size: float, silhouette := false) -> TextureRect:
	var t := TextureRect.new()
	t.texture = PetPortraits.get_texture(species)
	t.custom_minimum_size = Vector2(size, size)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	if silhouette:
		t.modulate = Color(0, 0, 0, 0.55)
	return t


## 카드(테두리 있는 칸) + 안쪽 세로 상자. 돌려주는 값: [카드, 세로상자]
static func card(min_size: Vector2) -> Array:
	var c := PanelContainer.new()
	c.theme_type_variation = &"CardPanel"
	c.custom_minimum_size = min_size
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 2)
	c.add_child(box)
	return [c, box]


static func clear(node: Node) -> void:
	for child in node.get_children():
		node.remove_child(child)
		child.queue_free()
