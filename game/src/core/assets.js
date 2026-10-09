// Tải GLB: zone nén Draco (bộ giải nén đóng gói ở public/draco), nhân vật nén meshopt (module JS đóng gói).
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const draco = new DRACOLoader().setDecoderPath(new URL("draco/", document.baseURI).href);
export const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

const cache = new Map();
export function loadGLTF(url, { cached = false } = {}) {
  if (!cached) return loader.loadAsync(url);
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

export async function loadJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// đường dẫn tương đối gốc web (index.html) — chạy được cả dev lẫn bản build đặt trong thư mục con
export const url = (p) => new URL(p.replace(/^\//, ""), document.baseURI).href;
