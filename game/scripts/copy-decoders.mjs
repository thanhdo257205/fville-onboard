// Chép bộ giải nén Draco (wasm) từ three vào public/ để đóng gói cùng game — không tải từ CDN.
// (Meshopt là module JS, Vite tự đóng gói khi import.)
import { cpSync, mkdirSync, existsSync } from "node:fs";
const src = "node_modules/three/examples/jsm/libs/draco/gltf";
if (existsSync(src)) {
  mkdirSync("public/draco", { recursive: true });
  cpSync(src, "public/draco", { recursive: true });
  console.log("draco decoder → public/draco");
}
