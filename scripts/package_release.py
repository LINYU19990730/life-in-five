"""Export only the public project allowlist, leaving local research files in place."""
from pathlib import Path
import json
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
FILES = ['.gitignore', '.gitattributes', 'README.md', 'LICENSE', 'DATA_LICENSE.md',
         'CONTRIBUTING.md', 'CITATION.cff', 'package.json', 'PUBLICATION_REVIEW.md']
DIRECTORIES = ['docs', 'research', 'scripts', '.github']
EXCLUDED = {'__pycache__', 'node_modules', '.git', 'test-results', 'playwright-report'}


def main():
    data = json.loads((ROOT / 'docs/data/research.json').read_text(encoding='utf-8'))
    files = [ROOT / name for name in FILES]
    for directory in DIRECTORIES:
        files += [p for p in (ROOT / directory).rglob('*') if p.is_file()
                  and not EXCLUDED.intersection(p.relative_to(ROOT).parts)
                  and p.suffix != '.pyc' and not p.name.startswith('.env')]
    output = ROOT / 'releases'
    output.mkdir(exist_ok=True)
    archive = output / f"life-in-five-{data['meta'].get('edition_date', data['meta']['asof'])}.zip"
    # A fixed metadata timestamp makes unchanged inputs produce the same archive.
    date = tuple(map(int, data['meta'].get('edition_date', data['meta']['asof']).split('-'))) + (0, 0, 0)
    from zipfile import ZipInfo
    with ZipFile(archive, 'w', compression=ZIP_DEFLATED) as z:
        for path in sorted(files):
            info = ZipInfo(path.relative_to(ROOT).as_posix(), date)
            info.compress_type = ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            z.writestr(info, path.read_bytes())
    print(f"Public archive: releases/{archive.name} ({len(files)} files)")


if __name__ == '__main__':
    main()
