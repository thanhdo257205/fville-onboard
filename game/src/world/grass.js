// Replace only low, horizontal green ground faces. Roads, furniture and COL_
// remain intact. Full rectangular grids collapse to the source plane's 2 tris.
import * as THREE from "three";
import { loadGLTF, url } from "../core/assets.js";
import { splitGrass } from "./grass-geometry.js";
import { makeZoneMaterial } from "../render/renderer.js";

const GROUND = /^ENV_(ground|ngoai_troi|hat_lua|tang_tret)(?:_\d+)?$/;
let model;
async function grassMaterial() {
  if (!model) model = loadGLTF(url("assets/props/grass_ground/grass_ground.glb")).then((gltf) => {
    let src;
    gltf.scene.traverse((o) => { if (o.isMesh && o.material.map) src ??= o.material; });
    if (!src) throw new Error("Grass ground model has no base color texture");
    src.map.wrapS = src.map.wrapT = THREE.RepeatWrapping;
    src.map.anisotropy = 4;
    src.map.userData.shared = true;
    const { material } = makeZoneMaterial(src);
    material.userData.shared = true;
    material.userData.outlineParameters = { visible: false };
    // Only the material is shared; each zone owns its terrain geometry.
    gltf.scene.traverse((o) => { o.geometry?.dispose(); });
    src.dispose();
    return material;
  }).catch((error) => { model = null; throw error; });
  return model;
}

export async function grassTexture() { return (await grassMaterial()).map; }

export async function replaceGrass(zone) {
  const candidates = [];
  zone.root.updateMatrixWorld(true);
  zone.root.traverse((o) => {
    if (o.isMesh && o.visible && (GROUND.test(o.name) || GROUND.test(o.parent?.name ?? ""))) candidates.push(o);
  });
  const surfaces = candidates.flatMap((o) => {
    const split = splitGrass(o.geometry, o.matrixWorld);
    return split ? [{ o, split }] : [];
  });
  if (!surfaces.length) return;
  const material = await grassMaterial();
  const inverse = zone.root.matrixWorld.clone().invert();
  const stats = { before: 0, after: 0, rectangles: 0, meshes: 0 };
  const replaced = new Set();
  for (const { o, split } of surfaces) {
    // Clone so an instanced mesh's other users keep their original indices.
    const previous = o.geometry;
    o.geometry = previous.clone().setIndex(split.kept);
    replaced.add(previous);
    split.terrain.applyMatrix4(inverse);
    const grass = new THREE.Mesh(split.terrain, material);
    grass.name = `GRASS_${o.name}`;
    grass.userData.surface = "grass";
    zone.root.add(grass);
    stats.before += split.before; stats.after += split.after;
    stats.rectangles += split.rectangles; stats.meshes++;
  }
  const used = new Set();
  zone.root.traverse((o) => { if (o.geometry) used.add(o.geometry); });
  for (const geometry of replaced) if (!used.has(geometry)) geometry.dispose();
  (zone.fixes ||= {}).grass = stats;
}
