"""Build the existing static site; no collection and no publication timestamp edits."""
import argparse,json,shutil
from pathlib import Path

def build(snapshot=None):
    root=Path(__file__).parent; out=root/'dist'
    if out.exists(): shutil.rmtree(out)
    (out/'public').mkdir(parents=True)
    html=(root/'index.html').read_text()
    html=html.replace('</body>','<script type="module" src="public/fic-weekly.mjs"></script>\n<script type="module" src="public/pl-weekly.mjs"></script>\n</body>')
    (out/'index.html').write_text(html)
    for source in (root/'public').iterdir():
        if source.is_file() and source.suffix in {'.mjs','.json','.png','.svg','.jpg','.webp','.css'}:
            shutil.copy2(source,out/'public'/source.name)
    if snapshot is not None: shutil.copy2(snapshot,out/'public/fantasygm.json')
    # Authenticated content must never be cached as publicly shareable content.
    (out/'_headers').write_text('/*\n  Cache-Control: private, no-store\n  X-Robots-Tag: noindex, nofollow\n  Referrer-Policy: same-origin\n  X-Content-Type-Options: nosniff\n')
    print('Built existing four-page site in dist; preserved collection timestamp.')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--snapshot',type=Path);args=p.parse_args();build(args.snapshot)
