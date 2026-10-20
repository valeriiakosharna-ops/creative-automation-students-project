"""Dependency-free structural checks for this static GitHub Pages site."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent


class SiteParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.targets = []
        self.assets = []
        self.controls = []
        self.labels = set()
        self.label_depth = 0
        self.errors = []
        self.headings = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'label':
            self.label_depth += 1
            if 'for' in attrs:
                self.labels.add(attrs['for'])
        if tag == 'h1':
            self.headings += 1
        if 'id' in attrs:
            if attrs['id'] in self.ids:
                self.errors.append(f"Duplicate id: {attrs['id']}")
            self.ids.add(attrs['id'])
        for name in ('href', 'src'):
            if attrs.get(name):
                value = attrs[name]
                if value.startswith('#'):
                    self.targets.append(value[1:])
                elif not urlsplit(value).scheme and not value.startswith('//'):
                    self.assets.append(urlsplit(value).path)
        for name in ('aria-controls', 'aria-labelledby'):
            self.targets.extend(attrs.get(name, '').split())
        if tag in ('input', 'select', 'textarea'):
            self.controls.append((attrs.get('id'), self.label_depth > 0, bool(attrs.get('aria-label'))))

    def handle_endtag(self, tag):
        if tag == 'label':
            self.label_depth -= 1


parser = SiteParser()
parser.feed((ROOT / 'index.html').read_text())
parser.close()
for target in parser.targets:
    if target not in parser.ids:
        parser.errors.append(f'Missing link or ARIA target: {target}')
for asset in parser.assets:
    if asset.startswith('/'):
        parser.errors.append(f'Absolute asset path breaks repository Pages hosting: {asset}')
    if not (ROOT / asset).is_file() and not ((ROOT / asset).is_dir() and (ROOT / asset / 'index.html').is_file()):
        parser.errors.append(f'Missing local asset: {asset}')
for identifier, wrapped, aria_label in parser.controls:
    if not (wrapped or aria_label or identifier in parser.labels):
        parser.errors.append(f'Unlabelled form control: {identifier}')
if parser.headings != 1:
    parser.errors.append(f'Expected one h1, found {parser.headings}')
if parser.errors:
    raise SystemExit('\n'.join(parser.errors))
print(f'Site checks passed: {len(parser.ids)} unique IDs, {len(parser.targets)} navigation/ARIA targets, '
      f'{len(parser.assets)} local assets, {len(parser.controls)} labelled controls.')
