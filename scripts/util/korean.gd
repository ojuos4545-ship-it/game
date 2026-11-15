class_name Korean
## 한국어 조사 붙이기 (받침 유무에 따라 을/를, 이/가, 은/는, 과/와).


static func has_batchim(word: String) -> bool:
	if word.is_empty():
		return false
	var code := word.unicode_at(word.length() - 1)
	if code < 0xAC00 or code > 0xD7A3:
		return false
	return (code - 0xAC00) % 28 != 0


## "도토를", "이끼곰을"
static func obj(word: String) -> String:
	return word + ("을" if has_batchim(word) else "를")


## "도토가", "이끼곰이"
static func subj(word: String) -> String:
	return word + ("이" if has_batchim(word) else "가")


## "도토는", "이끼곰은"
static func topic(word: String) -> String:
	return word + ("은" if has_batchim(word) else "는")
