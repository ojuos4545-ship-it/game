"""잘라 낸 투명 PNG를 '진한 외곽선 + 쨍한 색 + 적은 색 수' 도트 그림으로 다듬는다(슬달이 방식).
게임 실행에는 필요 없는 도구다. Python과 Pillow, numpy가 있어야 한다.

사용: python3 tools/bold_pixels.py <입력 폴더> <출력 폴더> [--colors 14] [--saturation 1.55] [--contrast 1.18]
예:   python3 tools/bold_pixels.py 잘라낸_펫 assets/pets --colors 14
      python3 tools/bold_pixels.py 잘라낸_시설 assets/buildings --colors 24 --saturation 1.25

- 입력 폴더의 모든 PNG를 처리해 같은 이름으로 출력 폴더에 저장한다(입력과 출력이 같으면 덮어쓴다).
- 그림 가장자리에 외곽선이 들어갈 빈칸(1칸)이 있어야 한다. tools/slice_sprites.py로 자른 그림은 2칸 여백이 있다.
- 순서: 채도·대비 올리기 → 색 수 줄이기 → 몸과 맞닿은 빈칸 1칸을 진한 색으로 칠해 외곽선 만들기.
"""
import argparse
import glob
import os

import numpy as np
from PIL import Image, ImageEnhance

OUTLINE = (34, 24, 38, 255)


def bold(image, colors, saturation, contrast):
    a = np.array(image.convert('RGBA'))
    alpha = a[..., 3] > 0
    rgb = Image.fromarray(a[..., :3], 'RGB')
    rgb = ImageEnhance.Color(rgb).enhance(saturation)
    rgb = ImageEnhance.Contrast(rgb).enhance(contrast)
    rgb = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT).convert('RGB')
    out = np.dstack([np.array(rgb), np.where(alpha, 255, 0).astype(np.uint8)])
    out[~alpha] = 0
    h, w = alpha.shape
    edge = np.zeros_like(alpha)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        shifted = np.zeros_like(alpha)
        ys = slice(max(dy, 0), h + min(dy, 0)); yd = slice(max(-dy, 0), h + min(-dy, 0))
        xs = slice(max(dx, 0), w + min(dx, 0)); xd = slice(max(-dx, 0), w + min(-dx, 0))
        shifted[yd, xd] = alpha[ys, xs]
        edge |= shifted
    out[edge & ~alpha] = OUTLINE
    return Image.fromarray(out, 'RGBA')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('src'); parser.add_argument('dst')
    parser.add_argument('--colors', type=int, default=14)
    parser.add_argument('--saturation', type=float, default=1.55)
    parser.add_argument('--contrast', type=float, default=1.18)
    args = parser.parse_args()
    os.makedirs(args.dst, exist_ok=True)
    paths = sorted(glob.glob(os.path.join(args.src, '*.png')))
    for path in paths:
        bold(Image.open(path), args.colors, args.saturation, args.contrast).save(os.path.join(args.dst, os.path.basename(path)))
    print(f'{len(paths)}개 처리 → {args.dst}')


main()
