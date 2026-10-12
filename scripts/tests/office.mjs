// Office layout: verify exported collision geometry, room side, doors and budgets.
// No browser / GPU needed; reads bounds and transforms from the shipped GLB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../../game/node_modules/three/build/three.module.js';

const cfg = JSON.parse(readFileSync(new URL('../../data/office.json', import.meta.url), 'utf8'));
const bytes = readFileSync(new URL('../../assets/glb/low/zone_05_office.glb', import.meta.url));
const glb = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
const report = JSON.parse(readFileSync(new URL('../../assets/glb/low/zone_05_office.report.json', import.meta.url), 'utf8'));
assert.equal(cfg.meeting_rooms.length, 3);
assert.equal(new Set(cfg.meeting_rooms.map(r => r.name)).size, 3);
assert.ok(report.triangles_visible <= 60000, 'office exceeds 60,000 visible triangles');
assert.ok(bytes.length < 2 * 1024 * 1024, 'office exceeds 2 MiB');
assert.ok(glb.extensionsUsed.includes('KHR_draco_mesh_compression'));

const parents = new Map();
glb.nodes.forEach((n, i) => (n.children || []).forEach(c => parents.set(c, i)));
const matrices = new Map();
function world(i) {
  if (matrices.has(i)) return matrices.get(i);
  const n = glb.nodes[i];
  const local = n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(
    new THREE.Vector3().fromArray(n.translation || [0, 0, 0]),
    new THREE.Quaternion().fromArray(n.rotation || [0, 0, 0, 1]),
    new THREE.Vector3().fromArray(n.scale || [1, 1, 1]));
  const matrix = parents.has(i) ? world(parents.get(i)).clone().multiply(local) : local;
  matrices.set(i, matrix);
  return matrix;
}
const nodes = new Map(glb.nodes.map((n, i) => [n.name, { n, i }]));
const colliders = [];
glb.nodes.forEach((n, i) => {
  if (!n.name?.startsWith('COL_') || n.mesh == null) return;
  for (const p of glb.meshes[n.mesh].primitives) {
    const a = glb.accessors[p.attributes.POSITION];
    const box = new THREE.Box3(new THREE.Vector3().fromArray(a.min), new THREE.Vector3().fromArray(a.max)).applyMatrix4(world(i));
    colliders.push({ name: n.name, box });
  }
});
const supported = p => colliders.some(({ box }) => Math.abs(box.max.y) < 0.05 &&
  p.x >= box.min.x && p.x <= box.max.x && p.z >= box.min.z && p.z <= box.max.z);
const clear = p => !colliders.some(({ box }) => box.max.y > 0.45 && box.min.y < 1.75 &&
  p.x > box.min.x - 0.3 && p.x < box.max.x + 0.3 && p.z > box.min.z - 0.3 && p.z < box.max.z + 0.3);
// Centre route must have a floor and capsule clearance in both directions.
for (let x = -1.5; x >= -68; x -= 0.25) {
  const p = new THREE.Vector3(x, 0, 0);
  assert.ok(supported(p), `missing floor on office route at ${x}`);
  assert.ok(clear(p), `blocked office route at ${x}`);
}
for (const room of cfg.meeting_rooms) {
  const [x0, x1, y0, y1] = room.bounds, cx = (x0 + x1) / 2;
  assert.ok(y0 >= cfg.corridor[3] && y1 > y0, 'rooms must be left when walking +X from secondary to main');
  const node = nodes.get(`INT_${room.id}`);
  assert.ok(node, `missing room ${room.id}`);
  const p = new THREE.Vector3().setFromMatrixPosition(world(node.i));
  assert.ok(Math.abs(p.x - cx) < 0.01 && Math.abs(p.z + (y0 + y1) / 2) < 0.01);
  assert.equal(node.n.extras?.label, room.name);
  assert.ok(nodes.has(`ENV_cua_${room.id}`) && nodes.has(`ENV_bien_${room.id}`), 'room needs a door and nameplate');
  for (let y = 0; y <= 3.1; y += 0.1) {
    const entry = new THREE.Vector3(cx, 0, -y);
    assert.ok(supported(entry) && clear(entry), `room ${room.id} entrance blocked at ${y}`);
  }
}
for (const name of ['NPC_mentor', 'NPC_manager', 'NPC_dong_nghiep_1', 'NPC_dong_nghiep_2', 'NPC_dong_nghiep_3',
  'SPAWN_ban_lam_viec', 'SPAWN_phong_phu', 'SPAWN_hanh_lang_phong_hop', 'pool_table', 'INT_ban_lam_viec']) {
  assert.ok(nodes.has(name), `missing gameplay node ${name}`);
}
console.log(`✓ office: 3 rooms on correct side, named doors, connected floors, capsule clearance, ${report.triangles_visible} triangles, ${(bytes.length/1024).toFixed(0)} KiB`);
