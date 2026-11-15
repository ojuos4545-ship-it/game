extends Node
## 자동 점검(테스트) 실행기.
## 사용법: tools/run_tests.sh  (또는 godot --headless --path . res://tests/test_runner.tscn)
## 모든 점검을 통과하면 종료 코드 0, 하나라도 실패하면 1.

var _passed := 0
var _failed := 0


func _ready() -> void:
	print("========== Little Haven 자동 점검 ==========")
	_test_stage1_project()
	_test_stage2_data()
	_test_stage2_screen()
	_test_stage3_pets()
	_test_stage3_adoption()
	_test_stage3_visuals()
	_test_stage3_screen()
	_test_stage4_recipes()
	_test_stage4_combine()
	_test_stage4_screen()
	print("--------------------------------------------")
	print("결과: 통과 %d / 실패 %d" % [_passed, _failed])
	get_tree().quit(0 if _failed == 0 else 1)


func check(condition: bool, name: String) -> void:
	if condition:
		_passed += 1
		print("  [통과] ", name)
	else:
		_failed += 1
		print("  [실패] ", name)


# ---------- 1단계: 프로젝트 기본 구성 ----------
func _test_stage1_project() -> void:
	print("[1단계] 프로젝트 기본 구성")
	var root := get_tree().root
	check(root.has_node("DataDB"), "DataDB 자동 로드됨")
	check(root.has_node("GameState"), "GameState 자동 로드됨")
	check(root.has_node("SaveManager"), "SaveManager 자동 로드됨")

	var font: Resource = load(ProjectSettings.get_setting("gui/theme/custom_font"))
	check(font is FontFile, "한글 폰트 로드됨")
	if font is FontFile:
		check((font as FontFile).has_char("한".unicode_at(0)), "폰트에 한글 글자 포함")

	var main_path: String = ProjectSettings.get_setting("application/run/main_scene")
	var packed: PackedScene = load(main_path)
	check(packed != null, "메인 화면 파일 로드됨")
	if packed:
		var main := packed.instantiate()
		check(main != null, "메인 화면 생성됨")
		if main:
			main.free()


# ---------- 2단계: 데이터 · 자원 ----------
func _test_stage2_data() -> void:
	print("[2단계] 데이터와 자원")
	check(DataDB.errors.is_empty(), "데이터 파일 오류 없음 %s" % [DataDB.errors])
	check(DataDB.resource_ids == ["wood", "ore", "berry"], "자원 3종 (목재·광석·열매)")
	check(DataDB.workshop_ids == ["lumber", "mine", "farm"], "작업장 3종 (벌목장·광산·농장)")
	check(DataDB.get_workshop("mine").get("name") == "광산", "작업장 이름 읽기")

	GameState.new_game()
	check(GameState.get_resource("wood") == 0, "시작 자원 0")
	GameState.add_resource("wood", 5)
	check(GameState.get_resource("wood") == 5, "자원 더하기")
	GameState.add_resource("wood", -10)
	check(GameState.get_resource("wood") == 0, "자원은 0 아래로 내려가지 않음")
	GameState.new_game()


# ---------- 2단계: 기본 게임 화면 ----------
func _test_stage2_screen() -> void:
	print("[2단계] 기본 게임 화면")
	var main: Node = load(ProjectSettings.get_setting("application/run/main_scene")).instantiate()
	add_child(main)

	var camera: Camera3D = main.find_child("Camera3D", true, false)
	check(camera != null and camera.projection == Camera3D.PROJECTION_ORTHOGONAL, "쿼터뷰 카메라(직교)")

	var plots: Node = main.find_child("Plots", true, false)
	var names: Array = []
	if plots:
		for plot in plots.get_children():
			var label: Label3D = plot.get_node_or_null("NameLabel")
			names.append(label.text if label else "?")
	check(names == ["벌목장", "광산", "농장"], "작업장 부지 3곳 + 이름표 %s" % [names])

	var hud: Node = main.find_child("HUD", true, false)
	check(hud != null, "화면 UI 존재")
	if hud:
		check(hud.get_amount_text("ore") == "0", "자원바 초기값 0")
		GameState.add_resource("ore", 7)
		check(hud.get_amount_text("ore") == "7", "자원 변경 시 자원바 자동 갱신")

		check(not hud.is_any_window_open(), "시작 시 창 닫혀 있음")
		hud.find_child("PetsButton", true, false).pressed.emit()
		check(hud.windows.pets.visible, "펫 버튼 → 펫 창 열림")
		hud.find_child("CombineButton", true, false).pressed.emit()
		check(hud.windows.combine.visible and not hud.windows.pets.visible, "다른 버튼 → 이전 창 닫히고 새 창 열림")
		hud.find_child("CombineButton", true, false).pressed.emit()
		check(not hud.is_any_window_open(), "같은 버튼 다시 → 창 닫힘")
		hud.find_child("DexButton", true, false).pressed.emit()
		hud.windows.dex.find_child("CloseButton", true, false).pressed.emit()
		check(not hud.is_any_window_open(), "닫기 버튼 → 창 닫힘")

	main.queue_free()
	GameState.new_game()


# ---------- 3단계: 펫 데이터 · 보유 · 도감 ----------
func _test_stage3_pets() -> void:
	print("[3단계] 펫 데이터와 보유")
	check(DataDB.pet_ids.size() == 8, "펫 8종")
	var base := DataDB.pet_ids.filter(func(id): return DataDB.get_pet(id).obtain == "base")
	check(base == ["doto", "mongdol", "pongdang", "haerong"], "기본 펫 4종 %s" % [base])
	check(DataDB.element_ids.size() == 4, "속성 4종")
	check(DataDB.pet_elements_text("ikkigom") == "숲·물", "속성 이름 표시 (이끼곰 = 숲·물)")
	check(Korean.obj("도토") == "도토를" and Korean.obj("이끼곰") == "이끼곰을", "조사 붙이기 (를/을)")

	GameState.new_game()
	check(GameState.pets.size() == 4, "새 게임: 기본 펫 4마리 보유")
	check(GameState.discovered.size() == 4 and GameState.is_discovered("doto"), "새 게임: 기본 4종 도감 등록")
	check(not GameState.is_discovered("rumi"), "새 게임: 루미는 미발견")

	var found: Array = []
	var on_found := func(sp): found.append(sp)
	GameState.pet_discovered.connect(on_found)
	GameState.add_pet("doto")
	GameState.add_pet("ikkigom")
	GameState.add_pet("ikkigom")
	GameState.pet_discovered.disconnect(on_found)
	check(found == ["ikkigom"], "새 종류일 때만 '발견' 알림 %s" % [found])
	check(GameState.count_species("ikkigom") == 2 and GameState.pets.size() == 7, "같은 종류 여러 마리 보유")
	var uids := {}
	for p in GameState.pets:
		uids[p.uid] = true
	check(uids.size() == 7, "펫마다 고유번호가 다름")
	GameState.new_game()


func _test_stage3_adoption() -> void:
	print("[3단계] 입양")
	GameState.new_game()
	check(not AdoptionSystem.check("doto").is_empty(), "열매 0개: 입양 불가")
	var r := AdoptionSystem.adopt("doto")
	check(not r.ok and GameState.pets.size() == 4, "입양 실패 시 펫·자원 변화 없음")
	GameState.add_resource("berry", 20)
	r = AdoptionSystem.adopt("doto")
	check(r.ok and r.message == "도토를 입양했어요!", "입양 성공 메시지: " + r.message)
	check(GameState.get_resource("berry") == 5, "입양 비용 차감 (20 - 15 = 5)")
	check(GameState.count_species("doto") == 2 and GameState.pets.size() == 5, "도토 한 마리 추가")
	GameState.add_resource("berry", 100)
	r = AdoptionSystem.adopt("ikkigom")
	check(not r.ok and GameState.count_species("ikkigom") == 0, "조합 펫은 입양 불가: " + r.message)
	GameState.new_game()


func _test_stage3_visuals() -> void:
	print("[3단계] 펫 3D 모형")
	var all_ok := true
	var sizes: Array = []
	for id in DataDB.pet_ids:
		var v := PetVisual.new()
		add_child(v)
		v.setup(id)
		sizes.append(v.model.get_child_count())
		if v.model.get_child_count() < 6:
			all_ok = false
		v.free()
	check(all_ok, "8종 모두 도형 조합으로 생성됨 (부품 수 %s)" % [sizes])
	var tex_ok := true
	for id in DataDB.pet_ids:
		if not PetPortraits.get_texture(id) is Texture2D:
			tex_ok = false
	check(tex_ok, "8종 초상화 그림 생성됨")


func _test_stage3_screen() -> void:
	print("[3단계] 펫 창 · 도감 창")
	GameState.new_game()
	var main: Node = load(ProjectSettings.get_setting("application/run/main_scene")).instantiate()
	add_child(main)
	var hud: Node = main.find_child("HUD", true, false)
	var pets_view: Node = hud.find_child("PetsView", true, false)
	var dex_view: Node = hud.find_child("DexView", true, false)
	check(pets_view != null and dex_view != null, "펫 창·도감 창 내용 연결됨")
	if pets_view and dex_view:
		check(pets_view._count_label.text == "보유 펫 4마리" and pets_view._grid.get_child_count() == 4, "펫 창: 보유 펫 4마리 카드")
		var adopt_btn: Button = pets_view.find_child("Adopt_doto", true, false)
		check(adopt_btn != null and adopt_btn.disabled, "열매 부족 시 입양 버튼 비활성")
		GameState.add_resource("berry", 15)
		adopt_btn = pets_view.find_child("Adopt_doto", true, false)
		check(adopt_btn != null and not adopt_btn.disabled, "열매 충분하면 입양 버튼 활성")
		adopt_btn.pressed.emit()
		check(pets_view._grid.get_child_count() == 5, "입양 버튼 → 카드 5장으로 갱신")
		check(hud.get_toast_text() == "도토를 입양했어요!", "입양 알림 메시지 표시")

		check(dex_view._count_label.text == "발견한 펫 4 / 8", "도감: 발견 4 / 8")
		var bear_card: Node = dex_view.find_child("Dex_ikkigom", true, false)
		check(bear_card != null and bear_card.find_child("*", true, false) != null, "도감: 미발견 칸 존재")
		GameState.add_pet("ikkigom")
		check(dex_view._count_label.text == "발견한 펫 5 / 8", "새 펫 획득 → 도감 5 / 8")
		check(hud.get_toast_text().begins_with("새로운 펫 발견! 이끼곰"), "새 펫 발견 알림 표시")
	main.queue_free()
	GameState.new_game()


# ---------- 4단계: 조합 ----------
func _test_stage4_recipes() -> void:
	print("[4단계] 조합표")
	check(DataDB.recipe_ids.size() == 4, "조합표 4개")
	check(DataDB.find_recipe("doto", "pongdang").get("result") == "ikkigom", "도토 + 퐁당 = 이끼곰")
	check(DataDB.find_recipe("pongdang", "doto").get("result") == "ikkigom", "순서 바꿔도 같은 결과")
	check(DataDB.find_recipe("mongdol", "haerong").get("result") == "bandi", "몽돌 + 해롱 = 반디")
	check(DataDB.find_recipe("doto", "mongdol").get("result") == "beodi", "도토 + 몽돌 = 버디")
	check(DataDB.find_recipe("ikkigom", "bandi").get("result") == "rumi", "이끼곰 + 반디 = 루미 (2차 조합)")
	check(DataDB.find_recipe("pongdang", "haerong").is_empty(), "퐁당 + 해롱 = 조합표에 없음")


func _test_stage4_combine() -> void:
	print("[4단계] 조합 규칙")
	GameState.new_game()
	var r := CombineSystem.combine("doto", "pongdang")
	check(not r.ok and GameState.count_species("ikkigom") == 0, "자원 부족: 조합 안 됨 (" + r.message + ")")

	GameState.add_resource("wood", 50)
	GameState.add_resource("ore", 50)
	GameState.add_resource("berry", 50)
	r = CombineSystem.combine("pongdang", "haerong")
	check(not r.ok and GameState.get_resource("berry") == 50, "조합표에 없는 조합: 자원 그대로 (" + r.message + ")")
	r = CombineSystem.combine("ikkigom", "bandi")
	check(not r.ok, "보유하지 않은 펫으로는 조합 불가")
	r = CombineSystem.combine("doto", "doto")
	check(not r.ok, "같은 펫 두 마리는 2마리 이상 있어야 함")

	r = CombineSystem.combine("doto", "pongdang")
	check(r.ok and r.result == "ikkigom" and r.new_discovery, "조합 성공: 이끼곰 (" + r.message + ")")
	check(GameState.get_resource("wood") == 40 and GameState.get_resource("berry") == 40, "조합 비용 차감 (목재 10, 열매 10)")
	check(GameState.count_species("doto") == 1 and GameState.count_species("pongdang") == 1, "재료 펫은 사라지지 않음")
	check(GameState.is_discovered("ikkigom"), "도감 등록")
	r = CombineSystem.combine("doto", "pongdang")
	check(r.ok and not r.new_discovery and GameState.count_species("ikkigom") == 2, "다시 조합하면 한 마리 더 (" + r.message + ")")

	r = CombineSystem.combine("mongdol", "haerong")
	check(r.ok and r.result == "bandi", "반디 조합")
	r = CombineSystem.combine("ikkigom", "bandi")
	check(not r.ok, "루미: 자원 부족 시 불가 (30씩 필요)")
	GameState.add_resource("wood", 30)
	GameState.add_resource("ore", 30)
	GameState.add_resource("berry", 30)
	r = CombineSystem.combine("bandi", "ikkigom")
	check(r.ok and r.result == "rumi", "조합으로 얻은 펫끼리 2차 조합 → 루미")
	r = CombineSystem.combine("doto", "mongdol")
	check(r.ok and r.result == "beodi", "버디 조합")
	check(GameState.discovered.size() == 8, "도감 8종 모두 발견 가능")
	GameState.new_game()


func _test_stage4_screen() -> void:
	print("[4단계] 조합 창")
	GameState.new_game()
	var main: Node = load(ProjectSettings.get_setting("application/run/main_scene")).instantiate()
	add_child(main)
	var hud: Node = main.find_child("HUD", true, false)
	var view: Node = hud.find_child("CombineView", true, false)
	check(view != null, "조합 창 내용 연결됨")
	if view:
		var go: Button = view.find_child("CombineGoButton", true, false)
		check(view._picker.get_child_count() == 4, "보유 펫 4종 선택 버튼")
		check(go.disabled, "재료 없으면 조합 버튼 비활성")
		view.find_child("Pick_doto", true, false).pressed.emit()
		view.find_child("Pick_pongdang", true, false).pressed.emit()
		check(view.selected == ["doto", "pongdang"], "펫 누르면 재료 칸에 들어감")
		check(view._result_box.find_child("*", true, false) != null and _texts(view._result_box).has("???"), "결과 미리보기: 미발견 펫은 ???")
		check(go.disabled and view._info_label.text.contains("부족"), "자원 부족 안내 + 버튼 비활성")
		GameState.add_resource("wood", 10)
		GameState.add_resource("berry", 10)
		check(not go.disabled, "자원 충분하면 조합 버튼 활성")
		go.pressed.emit()
		check(_texts(view._result_box).has("이끼곰"), "조합 후 결과 칸에 이끼곰 표시")
		check(hud.get_toast_text() == "새로운 펫 이끼곰을 발견했어요!", "조합 결과 알림: " + hud.get_toast_text())
		check(view.find_child("Pick_ikkigom", true, false) != null, "새 펫이 선택 목록에 추가됨")
		check(view.selected == ["doto", "pongdang"], "재료 칸 유지 (재료 펫 그대로)")
		view.find_child("Slot1", true, false).pressed.emit()
		check(view.selected == ["doto", ""], "재료 칸 누르면 비워짐")
		view.find_child("Pick_haerong", true, false).pressed.emit()
		view.find_child("Slot0", true, false).pressed.emit()
		view.find_child("Pick_pongdang", true, false).pressed.emit()
		check(view._info_label.text.contains("아무 일도"), "없는 조합 안내: " + view._info_label.text)
	main.queue_free()
	GameState.new_game()


## 노드 아래 모든 Label 글자 모으기
func _texts(node: Node) -> Array:
	var out: Array = []
	for n in node.find_children("*", "Label", true, false):
		out.append(n.text)
	return out
