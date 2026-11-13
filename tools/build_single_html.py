"""게임 전체(index.html + style.css + game.js + assets 그림)를 HTML 파일 하나로 묶는다.
게임 실행에는 필요 없는 도구다. 파일 하나만 주고받아야 할 때(메신저로 보내기, AI 채팅에 올리기 등) 쓴다.

사용: python3 tools/build_single_html.py [출력 파일]
      출력 파일을 생략하면 little-haven-single.html 로 만든다(이 이름은 .gitignore에 들어 있다).

- 그림 파일 경로('assets/.../이름.png')를 그림 내용 자체(data URL)로 바꿔 넣는다.
- 원본 파일은 바꾸지 않는다.
"""
import base64
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'little-haven-single.html'
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'style.css').read_text(encoding='utf-8')
    js = (ROOT / 'game.js').read_text(encoding='utf-8')

    def embed(match):
        data = base64.b64encode((ROOT / match.group(1)).read_bytes()).decode()
        return "'data:image/png;base64," + data + "'"

    js, count = re.subn(r"'(assets/(?:pets|buildings|decor|resources)/[a-z]+\.png)'", embed, js)
    link = '<link rel="stylesheet" href="style.css" />'
    script = '<script src="game.js"></script>'
    if link not in html or script not in html:
        sys.exit('index.html의 style.css / game.js 연결 줄을 찾지 못했습니다.')
    if '</script' in js.lower() or '</style' in css.lower():
        sys.exit('game.js나 style.css 안에 태그를 닫는 글자가 있어 한 파일로 묶을 수 없습니다.')
    html = html.replace(link, '<style>\n' + css + '\n</style>').replace(script, '<script>\n' + js + '\n</script>')
    out.write_text(html, encoding='utf-8')
    print(f'{out} 생성 (그림 경로 {count}곳을 그림 내용으로 교체, {len(html) // 1024}KB)')


main()
