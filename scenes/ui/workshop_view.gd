extends VBoxContainer
## 작업장 창 내용 (작업장을 클릭하면 열림).
## 생산 정보 / 창고 + 수집 / 작업 자리(펫 넣기·빼기) / 쉬는 펫 목록 / 업그레이드

var workshop_id := ""

var _info_label: Label
var _storage_row: HBoxContainer
var _storage_bar: ProgressBar
var _storage_label: Label
var _collect_button: Button
var _timer_bar: ProgressBar
var _slots_row: HBoxContainer
var _picker: GridContainer
var _picker_label: Label
var _upgrade_label: Label
var _upgrade_button: Button
## 자리·쉬는 펫 버튼 구성 (같으면 버튼을 새로 만들지 않음)
var _layout_sig := ""


func _ready() -> void:
	name = "WorkshopView"
	add_theme_constant_override("separation", 8)

	_info_label = UIParts.label("", &"", HORIZONTAL_ALIGNMENT_LEFT)
	add_child(_info_label)

	# 다음 생산까지 남은 시간 막대
	var timer_row := HBoxContainer.new()
	timer_row.add_theme_constant_override("separation", 12)
	add_child(timer_row)
	var timer_label := UIParts.label("다음 생산까지", &"SmallLabel", HORIZONTAL_ALIGNMENT_LEFT)
	timer_label.custom_minimum_size.x = 150
	timer_row.add_child(timer_label)
	_timer_bar = _make_bar(Color("8fcf6a"), 10)
	_timer_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_timer_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	timer_row.add_child(_timer_bar)

	# 창고 + 수집 (자동 수집이 꺼져 있을 때만 보임)
	_storage_row = HBoxContainer.new()
	_storage_row.add_theme_constant_override("separation", 12)
	add_child(_storage_row)
	_storage_label = UIParts.label("", &"", HORIZONTAL_ALIGNMENT_LEFT)
	_storage_label.custom_minimum_size.x = 150
	_storage_row.add_child(_storage_label)
	_storage_bar = _make_bar(Color("b5793f"), 18)
	_storage_bar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_storage_bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	_storage_row.add_child(_storage_bar)
	_collect_button = Button.new()
	_collect_button.name = "CollectButton"
	_collect_button.pressed.connect(_on_collect)
	_storage_row.add_child(_collect_button)

	_slots_row = HBoxContainer.new()
	_slots_row.add_theme_constant_override("separation", 8)
	add_child(_slots_row)

	_picker_label = UIParts.label("", &"", HORIZONTAL_ALIGNMENT_LEFT)
	add_child(_picker_label)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size.y = 92
	scroll.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	add_child(scroll)
	_picker = GridContainer.new()
	_picker.columns = 30
	_picker.add_theme_constant_override("h_separation", 6)
	scroll.add_child(_picker)

	var up := HBoxContainer.new()
	up.add_theme_constant_override("separation", 12)
	add_child(up)
	_upgrade_label = UIParts.label("", &"SmallLabel", HORIZONTAL_ALIGNMENT_LEFT)
	_upgrade_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_upgrade_label.add_theme_font_size_override("font_size", 16)
	up.add_child(_upgrade_label)
	_upgrade_button = Button.new()
	_upgrade_button.name = "UpgradeButton"
	_upgrade_button.text = "업그레이드"
	_upgrade_button.pressed.connect(_on_upgrade)
	up.add_child(_upgrade_button)

	GameState.workshop_changed.connect(func(id): if id == workshop_id: refresh())
	GameState.pets_changed.connect(refresh)
	visibility_changed.connect(func(): _layout_sig = "")
	GameState.resource_changed.connect(func(_id, _n): _refresh_upgrade())


func show_workshop(id: String) -> void:
	workshop_id = id
	refresh()


func _process(_delta: float) -> void:
	if is_visible_in_tree():
		var clock := get_tree().get_first_node_in_group("production_clock")
		_timer_bar.value = clock.progress() if clock else 0.0


func refresh() -> void:
	if workshop_id.is_empty():
		return
	var ws := DataDB.get_workshop(workshop_id)
	var res: Dictionary = DataDB.get_resource(ws.resource)
	var liked: Array[String] = []
	for e in ws.likes:
		liked.append(DataDB.get_element(e).name)
	var interval: float = DataDB.balance.production_interval
	_info_label.text = "%s 생산 · 좋아하는 속성: %s (생산 ×%s) · %s초마다 %s %s%s" % [
		res.name, "·".join(liked), Iso.fmt(DataDB.balance.like_multiplier),
		Iso.fmt(interval), res.name, Iso.fmt(WorkshopSystem.total_output(workshop_id)),
		" (자동 수집)" if WorkshopSystem.auto_collect() else ""]
	_storage_row.visible = not WorkshopSystem.auto_collect()

	var cap := WorkshopSystem.capacity(workshop_id)
	var stored := WorkshopSystem.stored(workshop_id)
	_storage_label.text = "창고 %d / %d" % [int(floor(stored + 0.001)), cap]
	_storage_bar.max_value = cap
	_storage_bar.value = stored
	(_storage_bar.get_theme_stylebox("fill") as StyleBoxFlat).bg_color = res.color
	var can_take := int(floor(stored + 0.001))
	_collect_button.text = "수집하기 (+%d)" % can_take
	_collect_button.disabled = can_take <= 0

	var sig := "%s|L%d|" % [workshop_id, WorkshopSystem.level(workshop_id)]
	for p in GameState.pets:
		sig += "%d:%s:%d," % [p.uid, p.workshop, p.slot]
	if sig != _layout_sig:
		_layout_sig = sig
		_refresh_slots()
		_refresh_picker()
	_refresh_upgrade()


# ---------------- 내부 ----------------

func _make_bar(color: Color, height: float) -> ProgressBar:
	var bar := ProgressBar.new()
	bar.show_percentage = false
	bar.custom_minimum_size.y = height
	bar.max_value = 1.0
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.48, 0.32, 0.2, 0.18)
	bg.set_corner_radius_all(6)
	var fill := StyleBoxFlat.new()
	fill.bg_color = color
	fill.set_corner_radius_all(6)
	bar.add_theme_stylebox_override("background", bg)
	bar.add_theme_stylebox_override("fill", fill)
	return bar


func _refresh_slots() -> void:
	UIParts.clear(_slots_row)
	var workers := WorkshopSystem.workers(workshop_id)
	var open := WorkshopSystem.slot_count(workshop_id)
	for i in DataDB.max_workshop_slots(workshop_id):
		var parts := UIParts.card(Vector2(170, 150))
		parts[0].name = "Slot%d" % i
		var box: VBoxContainer = parts[1]
		box.alignment = BoxContainer.ALIGNMENT_CENTER
		if i >= open:
			box.add_child(UIParts.label("잠김", &"SmallLabel"))
			box.add_child(UIParts.label("업그레이드하면 열려요", &"SmallLabel"))
			parts[0].modulate = Color(1, 1, 1, 0.55)
		elif workers.has(i):
			var pet: Dictionary = workers[i]
			box.add_child(UIParts.portrait(pet.species, 64))
			box.add_child(UIParts.label(DataDB.get_pet(pet.species).name))
			var out := WorkshopSystem.output(pet.species, workshop_id)
			var like := WorkshopSystem.likes(pet.species, workshop_id)
			box.add_child(UIParts.label("+%s%s" % [Iso.fmt(out), " (좋아함!)" if like else ""], &"SmallLabel"))
			var b := Button.new()
			b.name = "Remove_%d" % pet.uid
			b.text = "쉬게 하기"
			b.add_theme_font_size_override("font_size", 15)
			b.pressed.connect(_on_remove.bind(pet.uid))
			box.add_child(b)
		else:
			box.add_child(UIParts.label("빈 자리", &""))
			box.add_child(UIParts.label("아래 쉬는 펫을 눌러\n일을 맡기세요", &"SmallLabel"))
		_slots_row.add_child(parts[0])


func _refresh_picker() -> void:
	UIParts.clear(_picker)
	var resting := GameState.pets.filter(func(p): return p.workshop.is_empty())
	var full := WorkshopSystem.free_slot(workshop_id) < 0
	if resting.is_empty():
		_picker_label.text = "쉬는 펫이 없어요 (펫 창에서 입양하거나, 다른 작업장에서 쉬게 하세요)"
	elif full:
		_picker_label.text = "빈 자리가 없어요 (업그레이드하면 자리가 늘어나요)"
	else:
		_picker_label.text = "쉬는 펫 (누르면 이 작업장에서 일해요)"
	# 이 작업장을 좋아하는 펫이 앞에 오도록
	resting.sort_custom(func(a, b): return WorkshopSystem.output(a.species, workshop_id) > WorkshopSystem.output(b.species, workshop_id))
	for pet in resting:
		var b := Button.new()
		b.name = "Assign_%d" % pet.uid
		var out := WorkshopSystem.output(pet.species, workshop_id)
		var like := WorkshopSystem.likes(pet.species, workshop_id)
		b.text = "%s\n+%s%s" % [DataDB.get_pet(pet.species).name, Iso.fmt(out), " ♥" if like else ""]
		b.icon = PetPortraits.get_texture(pet.species)
		b.expand_icon = true
		b.custom_minimum_size = Vector2(130, 80)
		b.add_theme_font_size_override("font_size", 15)
		b.add_theme_constant_override("icon_max_width", 48)
		b.disabled = full
		b.tooltip_text = "좋아하는 작업장이라 생산량 2배!" if like else ""
		b.pressed.connect(_on_assign.bind(pet.uid))
		_picker.add_child(b)


func _refresh_upgrade() -> void:
	if workshop_id.is_empty() or not _upgrade_button:
		return
	var nxt := WorkshopSystem.next_level_info(workshop_id)
	if nxt.is_empty():
		_upgrade_label.text = "최고 레벨이에요 (Lv%d)" % WorkshopSystem.level(workshop_id)
		_upgrade_button.disabled = true
		return
	var parts: Array[String] = []
	for id in DataDB.resource_ids:
		if nxt.upgrade_cost.has(id):
			parts.append("%s %d/%d" % [DataDB.get_resource(id).name, GameState.get_resource(id), nxt.upgrade_cost[id]])
	var cap_text := "" if WorkshopSystem.auto_collect() else ", 창고 %d" % nxt.capacity
	_upgrade_label.text = "Lv%d → Lv%d: 자리 %d개, 생산 ×%s%s\n비용: %s" % [
		WorkshopSystem.level(workshop_id), WorkshopSystem.level(workshop_id) + 1,
		nxt.slots, Iso.fmt(nxt.bonus), cap_text, ", ".join(parts)]
	_upgrade_button.disabled = not WorkshopSystem.check_upgrade(workshop_id).is_empty()


func _toast(text: String) -> void:
	get_tree().call_group("hud", "show_toast", text)


func _on_collect() -> void:
	var n := WorkshopSystem.collect(workshop_id)
	if n > 0:
		_toast("%s %d개를 수집했어요!" % [DataDB.get_resource(DataDB.get_workshop(workshop_id).resource).name, n])


func _on_assign(uid: int) -> void:
	_toast(WorkshopSystem.assign(uid, workshop_id).message)


func _on_remove(uid: int) -> void:
	_toast(WorkshopSystem.unassign(uid).message)


func _on_upgrade() -> void:
	_toast(WorkshopSystem.upgrade(workshop_id).message)
