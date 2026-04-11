#!/usr/bin/env python3
"""CrazyMoe Barcode Reader - reads UPCs from photos using Claude Vision"""
from __future__ import annotations
import argparse, base64, csv, io, json, re, sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import anthropic
except ImportError:
    import subprocess; subprocess.run([sys.executable,"-m","pip","install","anthropic","--quiet"])
    import anthropic

try:
    from PIL import Image
except ImportError:
    import subprocess; subprocess.run([sys.executable,"-m","pip","install","Pillow","--quiet"])
    from PIL import Image

CHECKPOINT = ".barcode_checkpoint.json"
IMAGE_EXTS = {".jpg",".jpeg",".png",".webp",".heic",".gif"}
PROMPT = """Read the barcode/UPC from this image.
Return ONLY the digits (12-13 for UPC, 8 for EAN-8).
If you see a model number instead, return that.
If nothing is readable, return NONE.
No explanation, just the code."""

def encode(path, max_side=1100):
    img = Image.open(path)
    if img.mode not in ("RGB","L"): img = img.convert("RGB")
    scale = min(1.0, max_side/max(img.size))
    if scale < 1.0: img = img.resize((round(img.width*scale),round(img.height*scale)), Image.LANCZOS)
    buf = io.BytesIO(); img.save(buf,"JPEG",quality=85)
    return base64.b64encode(buf.getvalue()).decode(), "image/jpeg"

def normalize(raw):
    v = (raw or "").strip()
    if not v or v.upper()=="NONE": return ""
    v = v.replace(" ","")
    m = re.search(r"\d{8,14}", v)
    if m: return m.group(0)
    m = re.search(r"[A-Z0-9][A-Z0-9\-/]{5,24}", v, re.I)
    return m.group(0) if m else ""

def read_one(client, path, model):
    try:
        d, mt = encode(path)
        r = client.messages.create(model=model, max_tokens=40, messages=[{
            "role":"user","content":[
                {"type":"image","source":{"type":"base64","media_type":mt,"data":d}},
                {"type":"text","text":PROMPT}]}])
        return normalize(r.content[0].text if r.content else "")
    except Exception as e:
        return f"ERROR:{e}"

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--folder", required=True)
    p.add_argument("--key", required=True)
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--model", default="claude-haiku-4-5-20251001")
    p.add_argument("--no-resume", action="store_true")
    args = p.parse_args()

    folder = Path(args.folder)
    files = sorted(f for f in folder.iterdir() if f.suffix.lower() in IMAGE_EXTS)
    if not files: print("No images found"); return

    cp_path = folder/CHECKPOINT
    results = {}
    if not args.no_resume and cp_path.exists():
        results = json.loads(cp_path.read_text())

    print(f"\nCrazyMoe Barcode Reader")
    print(f"Images: {len(files)} | Workers: {args.workers}")
    print(f"Cached: {sum(1 for f in files if f.name in results)}\n")

    client = anthropic.Anthropic(api_key=args.key)
    todo = [f for f in files if f.name not in results]

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(read_one, client, f, args.model): f for f in todo}
        for i, fut in enumerate(as_completed(futures), 1):
            path = futures[fut]
            code = fut.result()
            results[path.name] = code
            cp_path.write_text(json.dumps(results, indent=2))
            ok = "✓" if code and not code.startswith("ERROR") else "✗"
            print(f"[{i:03d}/{len(todo)}] {ok} {path.name:<45} {code or 'not found'}")

    # Write outputs
    with open(folder/"barcodes.csv","w",newline="") as f:
        w = csv.writer(f); w.writerow(["filename","upc"])
        for img in files: w.writerow([img.name, results.get(img.name,"")])

    upcs = [results[f.name] for f in files if results.get(f.name,"") and not results[f.name].startswith("ERROR")]
    (folder/"upcs_only.txt").write_text("\n".join(upcs))

    failures = [f.name for f in files if not results.get(f.name,"") or results[f.name].startswith("ERROR")]
    if failures: (folder/"failures.txt").write_text("\n".join(failures))

    print(f"\nDone: {len(upcs)} read, {len(failures)} failed")
    print(f"upcs_only.txt → paste into scanner Bulk tab")

if __name__=="__main__": main()
