class_name Iso
## 쿼터뷰 카메라 기준 방향. 카메라가 45도 돌아가 있어서 화면의 가로·세로는 월드에서 대각선이다.

## 화면 오른쪽
const SCREEN_RIGHT := Vector3(0.7071, 0, -0.7071)
## 화면 안쪽(위)
const SCREEN_BACK := Vector3(-0.7071, 0, -0.7071)
## 카메라 쪽(화면 아래)
const TOWARD_CAMERA := Vector3(0.7071, 0, 0.7071)


## 화면 기준 좌표(가로 sx, 깊이 sd) → 월드(또는 부지 안) 좌표
static func screen(sx: float, sd: float, y := 0.0) -> Vector3:
	return SCREEN_RIGHT * sx + SCREEN_BACK * sd + Vector3(0, y, 0)


## +Z가 앞인 물체를 dir 방향으로 바라보게 하는 Y 회전값
static func face_yaw(dir: Vector3) -> float:
	return atan2(dir.x, dir.z)


## 소수 생산량을 보기 좋게 ("2", "2.4")
static func fmt(amount: float) -> String:
	if absf(amount - roundf(amount)) < 0.05:
		return str(int(roundf(amount)))
	return "%.1f" % amount
