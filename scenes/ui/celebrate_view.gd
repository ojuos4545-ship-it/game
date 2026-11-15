extends VBoxContainer
## 도감 완성 축하 창 내용.


func _ready() -> void:
	name = "CelebrateView"
	add_theme_constant_override("separation", 12)
	alignment = BoxContainer.ALIGNMENT_CENTER
	var title := UIParts.label("축하합니다! 펫 %d종을 모두 발견했어요" % DataDB.pet_ids.size(), &"HeaderLabel")
	add_child(title)
	var grid := GridContainer.new()
	grid.columns = 8
	grid.add_theme_constant_override("h_separation", 6)
	grid.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	add_child(grid)
	for id in DataDB.pet_ids:
		var box := VBoxContainer.new()
		box.add_child(UIParts.portrait(id, 78))
		box.add_child(UIParts.label(DataDB.get_pet(id).name, &"SmallLabel"))
		grid.add_child(box)
	add_child(UIParts.label("Little Haven 미니판 클리어!\n펫들이 일하는 모습을 계속 즐겨 보세요."))
	var ok := Button.new()
	ok.name = "CelebrateOkButton"
	ok.text = "계속하기"
	ok.theme_type_variation = &"MenuButtonBig"
	ok.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	ok.pressed.connect(func(): get_tree().call_group("hud", "close_all_windows"))
	add_child(ok)
