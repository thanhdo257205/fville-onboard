// Tải GLB: zone nén Draco (bộ giải nén đóng gói ở public/draco), nhân vật nén meshopt (module JS đóng gói).
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const draco = new DRACOLoader().setDecoderPath(new URL("draco/", document.baseURI).href);
export const loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);

// tải + khởi tạo sẵn bộ giải nén (Draco wasm cho zone, Meshopt cho nhân vật) — gọi lúc người chơi còn điền tên
export function preloadDecoders() {
  draco.preload();
  return MeshoptDecoder.ready;
}

const cache = new Map();
export function loadGLTF(url, { cached = false } = {}) {
  if (!cached) return loader.loadAsync(url);
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url));
  return cache.get(url);
}

export { loadJSON, url } from "./fetch.js";
