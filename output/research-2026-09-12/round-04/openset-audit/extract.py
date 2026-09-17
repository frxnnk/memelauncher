from pathlib import Path
from html import unescape
from html.parser import HTMLParser
import json
import re

ROOT = Path(__file__).parent / 'raw'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.text = []
        self.links = []
        self.pre = []
        self.in_pre = False
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(v for k, v in attrs if k == 'href')
        if tag == 'pre':
            self.in_pre = True
    def handle_endtag(self, tag):
        if tag == 'pre':
            self.in_pre = False
    def handle_data(self, text):
        self.text.append(text)
        if self.in_pre:
            self.pre.append(text)

for path in ROOT.glob('*.html'):
    parsed = Page()
    parsed.feed(path.read_text(encoding='utf-8-sig'))
    (ROOT / (path.stem + '.txt')).write_text('\n'.join(parsed.text), encoding='utf-8')
    (ROOT / (path.stem + '-links.json')).write_text(json.dumps(sorted(set(parsed.links)), indent=2), encoding='utf-8')
    if path.stem.startswith('receipt-'):
        try:
            obj = json.loads(''.join(parsed.pre))
            (ROOT / (path.stem + '.json')).write_text(json.dumps(obj, indent=2), encoding='utf-8')
            print(path.stem, json.dumps(obj))
        except ValueError as error:
            print(path.stem, 'Raw receipt parse:', str(error))
    if path.stem == 'how-it-works':
        print('Rules links', json.dumps(parsed.links))
