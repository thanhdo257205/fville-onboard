// Regression: preserve non-grass surfaces, holes, transforms and collision data.
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import * as THREE from "../../game/node_modules/three/build/three.module.js";
import { splitGrass } from "../../game/src/world/grass-geometry.js";

function patch(x, z, size = 1, color = [0.25, 0.6, 0.1], y = 0) {
  const p = [x,y,z, x,y,z+size, x+size,y,z+size, x,y,z, x+size,y,z+size, x+size,y,z];
  return { p, c: Array.from({length:6},()=>color).flat() };
}
function geometry(...patches) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(patches.flatMap(p=>p.p),3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(patches.flatMap(p=>p.c),3));
  return g;
}
const matrix = new THREE.Matrix4();
const grid = geometry(patch(0,0),patch(1,0),patch(0,1),patch(1,1),patch(2,0,1,[0.3,0.3,0.3]));
const positions = grid.attributes.position.array.slice();
const result = splitGrass(grid,matrix);
assert.equal(result.before,8); assert.equal(result.after,2);
assert.equal(result.kept.length,6);
assert.deepEqual(grid.attributes.position.array,positions); // COL_ and view sources remain unchanged
assert.equal(result.terrain.attributes.uv.getX(2),0.5); // one tile per 4 metres
assert.equal(result.terrain.attributes.normal.getY(0),1);
assert.equal(splitGrass(geometry(patch(0,0,1,[0.3,0.3,0.3])),matrix),null);
assert.equal(splitGrass(geometry(patch(0,0,1,undefined,2)),matrix),null); // elevated green furniture
const holes = splitGrass(geometry(patch(0,0),patch(2,0)),matrix);
assert.equal(holes.after,4); assert.equal(holes.rectangles,0);
const translated = splitGrass(geometry(patch(0,0)),new THREE.Matrix4().makeTranslation(8,0.1,4));
assert.equal(translated.terrain.attributes.position.getX(0),8);
assert.equal(translated.terrain.attributes.uv.getX(0),2);
const indexed = geometry(patch(0,0)); indexed.setIndex([0,1,2,3,4,5]);
assert.equal(splitGrass(indexed,matrix).after,2);
const asset = new URL('../../assets/props/grass_ground/grass_ground.glb',import.meta.url);
const bytes=readFileSync(asset), json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
assert.ok(statSync(asset).size<=80*1024,'grass must stay <= 80 KiB');
assert.equal(json.images.length,1);
assert.equal(json.images[0].mimeType,'image/webp');
assert.equal(json.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+json.accessors[p.indices].count/3,0),0),2);
assert.ok(json.extensionsUsed.includes('KHR_draco_mesh_compression'));
assert.ok(readFileSync(new URL('../../CREDITS.md',import.meta.url),'utf8').includes('assets/props/grass_ground/grass_ground.glb'));
console.log('✓ grass: geometry, roads, holes, transforms, 4 m UV, 2 triangles, WebP and 80 KiB budget');
