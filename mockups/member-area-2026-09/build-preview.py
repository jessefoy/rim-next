"""Package the standalone study for review; does not build or run the RIM app."""
import base64
from pathlib import Path

root = Path(__file__).parent

def data_url(name, mime):
    encoded = base64.b64encode((root / name).read_bytes()).decode('ascii')
    return 'data:' + mime + ';base64,' + encoded

css = (root / 'prototype.css').read_text()
for name in ('QuincyCF-Regular.woff2', 'open-sans.woff2'):
    asset = 'assets/' + name
    css = css.replace(asset, data_url(asset, 'font/woff2'))

html = (root / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="prototype.css">', '<style>' + css + '</style>')
for name in ('assets/icons.js', 'prototype.js'):
    html = html.replace('  <script src="' + name + '" defer></script>\n', '')
scripts = '\n'.join('<script>' + (root / name).read_text() + '</script>' for name in ('assets/icons.js', 'prototype.js'))
html = html.replace('assets/logo.png', data_url('assets/logo.png', 'image/png'))
html = html.replace('</body>', scripts + '\n</body>')
destination = root / 'RIM-member-preview.html'
destination.write_text(html)
print('Packaged standalone preview:', destination.stat().st_size, 'bytes')
