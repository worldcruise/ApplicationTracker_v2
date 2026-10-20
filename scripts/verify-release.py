"""Independent ZIP/CRC/path/hash verifier; accepts exactly one release directory."""
import hashlib
import json
from pathlib import Path
import sys
import zipfile

folder = Path(sys.argv[1])
metadata = json.loads((folder / 'release.json').read_text(encoding='utf-8'))
archive = folder / f"applicationtracker-{metadata['release']}.zip"
expected = (folder / 'SHA256SUMS').read_text(encoding='utf-8').split()[0]
assert hashlib.sha256(archive.read_bytes()).hexdigest() == expected, 'Archive checksum mismatch'
with zipfile.ZipFile(archive) as zipped:
    assert zipped.testzip() is None, 'ZIP CRC failure'
    assert set(zipped.namelist()) == set(metadata['files']), 'ZIP file set mismatch'
    assert len(zipped.namelist()) == len(set(zipped.namelist())), 'Duplicate ZIP paths'
    for name, digest in metadata['files'].items():
        assert not name.startswith('/') and '..' not in name.split('/'), 'Unsafe ZIP path'
        assert hashlib.sha256(zipped.read(name)).hexdigest() == digest, 'File hash mismatch'
print(json.dumps({'result': 'PASS', 'independentZipCrcAndHashes': len(metadata['files']), 'published': False}))
