"""Exercise the exporter's actual URL/hash rewrite without copying orbital archives."""
from pathlib import Path
import ast
import hashlib
import re
import shutil
import tempfile

source = Path('scripts/build_static.py').read_text()
ast.parse(source)
with tempfile.TemporaryDirectory(prefix='atlas-perf-export-') as directory:
    out = Path(directory)
    for name in ['index.html', 'moon.html', 'station-ui.js', 'iss-search.js', 'iss-evas.js', 'station-history.js', 'iss-missions.js', 'app.js', 'pages.js']:
        shutil.copyfile(Path('static') / name, out / name)
    (out / 'transport.js').write_text('// transport fixture')
    portion = source[source.index('# Project Pages are under'):source.index('for page,title in')]
    exec(portion, {'out': out, 'hashlib': hashlib, 're': re, 'transport_file': out / 'transport.js'})
    dependencies = re.findall(r'([a-z-]+\.js)\?v=([a-f0-9]+)', (out / 'station-ui.js').read_text())
    assert len(dependencies) == 4
    for name, version in dependencies:
        assert version == hashlib.sha256((out / name).read_bytes()).hexdigest()[:12]
    assert (out / 'moon.html').read_text().count('id="catalog-percent"') == 1
    assert './station-ui.js?v=' in (out / 'index.html').read_text()
print('Static export: relative station URLs, rewritten dependency hashes and lunar loader verified.')
