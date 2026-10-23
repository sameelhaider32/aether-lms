"""Deterministic MV3 release packaging; Python standard library only."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=root / 'dist')
args = parser.parse_args()
out = args.out.resolve()
out.mkdir(parents=True, exist_ok=True)
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8-sig'))
version = manifest['version']
assert manifest['manifest_version'] == 3 and re.fullmatch(r'\d+\.\d+\.\d+', version)
assert manifest['permissions'] == ['storage']
for group in manifest['content_scripts']:
    assert group['run_at'] == 'document_start'
    assert group['matches'] == ['https://lms.lums.edu.pk/*']
    for entry in group['css'] + group['js']:
        assert (root / entry).is_file(), entry

release = out / f'aether-lms-extension-v{version}'
release.mkdir(exist_ok=True)
files = [root / name for name in ['manifest.json', 'README.md', 'LICENSE',
         'THIRD_PARTY_NOTICES.md', 'PRIVACY.md', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md']]
for folder in ['src', 'preview', 'vendor', 'fonts', 'icons', 'docs']:
    files += sorted(p for p in (root / folder).rglob('*') if p.is_file())
expected = {p.relative_to(root).as_posix() for p in files}
# Refuse to retain accidental artifacts from a previous build. Never delete paths.
existing = {p.relative_to(release).as_posix() for p in release.rglob('*') if p.is_file()}
assert not existing - expected, 'Unexpected files in output; choose a fresh --out directory.'
hashes = {}
for p in sorted(files):
    rel = p.relative_to(root)
    target = release / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    data = p.read_bytes()
    if p.suffix in {'.js', '.mjs', '.css', '.json', '.md', '.txt', '.html'} or p.name.startswith('LICENSE'):
        data = data.replace(b'\r\n', b'\n')
    target.write_bytes(data)
    hashes[rel.as_posix()] = hashlib.sha256(data).hexdigest()
archive = out / f'aether-lms-extension-v{version}.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for rel in sorted(hashes):
        info = zipfile.ZipInfo(f'aether-lms-extension-v{version}/' + rel, date_time=(2026, 10, 22, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 3  # Fixed Unix metadata on Windows and Linux alike.
        info.external_attr = 0o100644 << 16
        z.writestr(info, (release / rel).read_bytes())
(out / f'release-v{version}-sha256.json').write_text(json.dumps({'archive':hashlib.sha256(archive.read_bytes()).hexdigest(),'files':hashes}, indent=2)+'\n', encoding='utf-8')
print(f'Packaged {len(hashes)} local assets: {archive}')
