"""Prepare the supplied two-triangle grass plane for the toon renderer.

Usage: python scripts/tools/prepare_grass.py <source.glb>
Requires gltf-transform on PATH. The source stays in ignored source/.
"""
import argparse
import json
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def prepare(source):
    dest = ROOT / "assets/props/grass_ground"
    (dest / "source").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, dest / "source/grass_ground.glb")
    data = source.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + size])
    # Toon uses base color only: do not download/upload redundant AO,
    # metallic/roughness and normal images from the 6.9 MB source.
    for mat in doc.get("materials", []):
        mat.pop("normalTexture", None)
        mat.pop("occlusionTexture", None)
        pbr = mat.setdefault("pbrMetallicRoughness", {})
        pbr.pop("metallicRoughnessTexture", None)
        pbr.update(metallicFactor=0, roughnessFactor=1)
    encoded = json.dumps(doc, ensure_ascii=False).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    tail = data[20 + size:]
    raw = struct.pack("<III", 0x46546C67, 2, 20 + len(encoded) + len(tail))
    raw += struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + tail
    cli = shutil.which("gltf-transform.cmd") or shutil.which("gltf-transform")
    if not cli:
        raise SystemExit("Install @gltf-transform/cli before preparing grass.")
    with tempfile.TemporaryDirectory() as directory:
        work = Path(directory)
        current = work / "base.glb"
        current.write_bytes(raw)
        # Geometry already has just two triangles; simplifying further would
        # remove the plane. Weld/prune remove unused data without changing it.
        for name, options in [("weld", []), ("prune", []),
                              ("resize", ["--width", "512", "--height", "512"]),
                              ("webp", ["--quality", "82"]), ("draco", [])]:
            out = work / f"{name}.glb"
            subprocess.run([cli, name, str(current), str(out), *options], check=True)
            current = out
        shutil.copyfile(current, dest / "grass_ground.glb")
    print(f"Grass: {len(data):,} -> {(dest / 'grass_ground.glb').stat().st_size:,} bytes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    prepare(parser.parse_args().source)
