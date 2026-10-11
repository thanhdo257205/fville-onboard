#!/usr/bin/env bash
# Mô hình đồ vật tải về (Sketchfab…) → GLB nhẹ cho game, không cần Blender (gltf-transform qua npx):
#   gộp phép biến đổi, gốc ở giữa đáy, hàn đỉnh, giảm tam giác, bỏ dữ liệu thừa, texture ≤ 512 px WebP, nén Draco.
#   scripts/tools/make_prop.sh <id> [tỉ lệ giữ tam giác, mặc định 0.3]
#   vào: assets/props/<id>/source/<id>.glb (chỉ trên máy làm việc, .gitignore)  ra: assets/props/<id>/<id>.glb
# Đặt vào zone: data/scene_fixes.json → <zone>.props (game/src/world/zone.js placeProps); ghi nguồn + giấy phép vào CREDITS.md.
set -euo pipefail
id="$1"; ratio="${2:-0.3}"
src="assets/props/$id/source/$id.glb"; out="assets/props/$id/$id.glb"
G="npx --yes @gltf-transform/cli@4.5.1"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
$G flatten "$src" "$tmp/1.glb"
$G center "$tmp/1.glb" "$tmp/2.glb" --pivot below
$G weld "$tmp/2.glb" "$tmp/3.glb"
$G simplify "$tmp/3.glb" "$tmp/4.glb" --ratio "$ratio" --error 0.02
$G prune "$tmp/4.glb" "$tmp/5.glb"
$G resize "$tmp/5.glb" "$tmp/6.glb" --width 512 --height 512
$G webp "$tmp/6.glb" "$tmp/7.glb" --quality 82
$G draco "$tmp/7.glb" "$out"
ls -la "$out"
