"""스프라이트 시트(여러 펫을 한 장에 그린 그림) 한 장을 펫별 48x48 투명 PNG로 잘라 낸다.
게임 실행에는 필요 없는 도구다. Python과 Pillow, numpy가 있어야 한다.
사용: python3 tools/slice_sprites.py <시트.png> <출력폴더> <이름1,이름2,...> [행수]
예:   python3 tools/slice_sprites.py sheet.png assets/pets sproutbun,pebblelamb,dewotter,breezefox,embergecko,sparkchick 2
- 시트는 단색(자홍색 권장) 배경에 펫이 서로 떨어져 있어야 한다.
- 배경: 네 모서리 색과 비슷한 색을 가장자리부터 번져 가며 지운다(안쪽의 같은 색은 남긴다).
- 덩어리(연결된 불투명 영역)를 찾아 큰 순서로 이름 수만큼 고르고, 위→아래, 왼쪽→오른쪽 순으로 이름을 붙인다.
"""
import sys
from collections import deque
import numpy as np
from PIL import Image

SIZE = 48
PAD = 2


def remove_background(rgb, hue_tolerance=28):
    """배경색과 색상(hue)이 비슷하고 충분히 진한 픽셀을 가장자리부터 번져 가며 지운다.
    배경이 살짝 얼룩지거나 발밑에 같은 색 그림자가 있어도 함께 지워진다."""
    h, w, _ = rgb.shape
    f = rgb.astype(np.float32) / 255
    mx = f.max(axis=2); mn = f.min(axis=2); delta = mx - mn
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    hue = np.zeros((h, w), dtype=np.float32)
    nz = delta > 1e-6
    rmax = nz & (mx == r); gmax = nz & (mx == g) & ~rmax; bmax = nz & ~rmax & ~gmax
    hue[rmax] = (60 * ((g - b) / np.where(nz, delta, 1)) % 360)[rmax]
    hue[gmax] = (60 * ((b - r) / np.where(nz, delta, 1)) + 120)[gmax]
    hue[bmax] = (60 * ((r - g) / np.where(nz, delta, 1)) + 240)[bmax]
    sat = np.where(mx > 0, delta / np.where(mx > 0, mx, 1), 0)
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]).astype(np.int32)
    bg = np.median(border, axis=0)
    bh = np.concatenate([hue[0], hue[-1], hue[:, 0], hue[:, -1]])
    bg_hue = float(np.median(bh))
    diff = np.abs(hue - bg_hue); diff = np.minimum(diff, 360 - diff)
    # 배경보다 뚜렷이 밝은 분홍(꽃봉오리 등)은 배경으로 보지 않는다. 발밑 그림자는 배경보다 어두우므로 지워진다.
    bg_value = float(bg.max()) / 255
    similar = (diff < hue_tolerance) & (sat > 0.38) & (mx <= bg_value + 0.09)
    # 나뭇잎 사이처럼 둘러싸인 틈으로 비치는 배경색은 번져 가는 방식으로는 닿지 않으므로 색이 거의 같으면 지운다.
    near_bg = np.sqrt(((rgb.astype(np.int32) - bg) ** 2).sum(axis=2)) < 45
    mask = np.zeros((h, w), dtype=bool)  # True = 배경
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if similar[y, x] and not mask[y, x]:
                mask[y, x] = True; queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if similar[y, x] and not mask[y, x]:
                mask[y, x] = True; queue.append((y, x))
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and similar[ny, nx] and not mask[ny, nx]:
                mask[ny, nx] = True; queue.append((ny, nx))
    # 경계에 남는 배경색 테두리를 없애려고 배경을 1픽셀 넓힌다.
    mask |= near_bg
    grown = mask.copy()
    grown[1:, :] |= mask[:-1, :]; grown[:-1, :] |= mask[1:, :]; grown[:, 1:] |= mask[:, :-1]; grown[:, :-1] |= mask[:, 1:]
    return grown, bg


def components(opaque):
    h, w = opaque.shape
    seen = np.zeros((h, w), dtype=bool)
    boxes = []
    for sy in range(h):
        for sx in range(w):
            if not opaque[sy, sx] or seen[sy, sx]:
                continue
            queue = deque([(sy, sx)]); seen[sy, sx] = True
            y0 = y1 = sy; x0 = x1 = sx; count = 0
            while queue:
                y, x = queue.popleft(); count += 1
                y0 = min(y0, y); y1 = max(y1, y); x0 = min(x0, x); x1 = max(x1, x)
                for dy in (-2, -1, 0, 1, 2):  # 2픽셀 이내 틈은 같은 덩어리로 본다
                    for dx in (-2, -1, 0, 1, 2):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and opaque[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; queue.append((ny, nx))
            boxes.append((count, x0, y0, x1 + 1, y1 + 1))
    return boxes


def small_blobs(solid):
    h, w = solid.shape
    seen = np.zeros((h, w), dtype=bool)
    out = []
    for sy in range(h):
        for sx in range(w):
            if not solid[sy, sx] or seen[sy, sx]:
                continue
            queue = deque([(sy, sx)]); seen[sy, sx] = True; pixels = []
            while queue:
                y, x = queue.popleft(); pixels.append((y, x))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; queue.append((ny, nx))
            out.append((len(pixels), 0, 0, 0, 0, pixels))
    return out


def main():
    sheet_path, out_dir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
    rows = int(sys.argv[4]) if len(sys.argv) > 4 else 2
    image = Image.open(sheet_path).convert('RGB')
    # 계산을 빠르게 하려고 긴 변 768로 줄여서 처리한다.
    scale = 768 / max(image.size)
    if scale < 1:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    rgb = np.array(image)
    background, bg_color = remove_background(rgb)
    opaque = ~background
    boxes = sorted(components(opaque), reverse=True)[:len(names)]
    if len(boxes) < len(names):
        print(f'덩어리가 {len(boxes)}개뿐입니다(필요 {len(names)}개)'); sys.exit(1)
    # 행으로 묶은 뒤 왼쪽→오른쪽
    boxes.sort(key=lambda b: (b[2] + b[4]) / 2)
    per_row = -(-len(names) // rows)
    ordered = []
    for r in range(rows):
        ordered += sorted(boxes[r * per_row:(r + 1) * per_row], key=lambda b: (b[1] + b[3]) / 2)
    clean = rgb.copy(); clean[~opaque] = 0
    rgba = np.dstack([clean, np.where(opaque, 255, 0).astype(np.uint8)])
    print('배경색', bg_color.astype(int).tolist())
    for name, (count, x0, y0, x1, y1) in zip(names, ordered):
        crop = Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA')
        inner = SIZE - PAD * 2
        ratio = inner / max(crop.size)
        small = crop.convert('RGBa').resize((max(1, round(crop.width * ratio)), max(1, round(crop.height * ratio))), Image.BOX).convert('RGBA')
        # 반투명 가장자리를 없애 픽셀아트처럼 또렷하게
        arr = np.array(small); arr[..., 3] = np.where(arr[..., 3] >= 128, 255, 0); arr[arr[..., 3] == 0] = 0
        # 몸에서 떨어진 외톨이 점(3픽셀 이하)을 지운다.
        solid = arr[..., 3] > 0
        for count, x0, y0, x1, y1, pixels in small_blobs(solid):
            if count <= 3:
                for py, px in pixels: arr[py, px] = 0
        small = Image.fromarray(arr, 'RGBA')
        canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        canvas.paste(small, ((SIZE - small.width) // 2, SIZE - PAD - small.height))  # 발이 바닥에 닿게 아래 정렬
        canvas.save(f'{out_dir}/{name}.png')
        print(f'{name}: 원본 {x1 - x0}x{y1 - y0} (픽셀 {count}) → {small.width}x{small.height}')


main()
