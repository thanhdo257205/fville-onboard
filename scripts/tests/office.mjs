// Office layout: verify exported collision geometry, room side, doors and budgets.
// No browser / GPU needed; reads bounds and transforms from the shipped GLB.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../../game/node_modules/three/build/three.module.js';

const cfg = JSON.parse(readFileSync(new URL('../../data/office.json', import.meta.url), 'utf8'));
const fixes = JSON.parse(readFileSync(new URL('../../data/scene_fixes.json', import.meta.url), 'utf8')).zone_05;
const doors = fixes.room_doors;
const doorCols = new Set(doors.map(d => d.col_closed));
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
  if (!n.name?.startsWith('COL_') || n.mesh == null || doorCols.has(n.name)) return;
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
for (let x = -1.5; x >= cfg.secondary[0] + 2; x -= 0.25) {
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
  const door = doors.find(d => d.id === room.id);
  assert.ok(door && door.name === room.name && door.seconds > 0 && door.degrees === 85);
  assert.ok(nodes.get(door.leaf).n.extras?.hinge && nodes.get(door.leaf).n.extras?.dynamic);
  assert.ok(nodes.has(door.col_closed) && nodes.has(door.col_open) && nodes.has(`INT_cua_${room.id}`));
  assert.equal(nodes.get(`ENV_bien_${room.id}`).n.extras?.room_name, room.name);
  assert.equal(parents.get(nodes.get(`ENV_bien_${room.id}`).i), nodes.get(door.leaf).i, 'sign must turn with door');
  for (let y = 0; y <= 3.1; y += 0.1) {
    const entry = new THREE.Vector3(cx, 0, -y);
    assert.ok(supported(entry) && clear(entry), `room ${room.id} entrance blocked at ${y}`);
  }
}
assert.equal(cfg.meeting_rooms[1].name, 'Trạch Xá');
assert.equal(cfg.meeting_rooms[2].name, 'Ước Lễ');
for (const name of ['NPC_mentor', 'NPC_manager', 'NPC_dong_nghiep_1', 'NPC_dong_nghiep_2', 'NPC_dong_nghiep_3',
  'SPAWN_ban_lam_viec', 'SPAWN_phong_phu', 'SPAWN_hanh_lang_phong_hop', 'pool_table', 'INT_ban_lam_viec']) {
  assert.ok(nodes.has(name), `missing gameplay node ${name}`);
}
console.log(`✓ office: 3 rooms on correct side, named doors, connected floors, capsule clearance, ${report.triangles_visible} triangles, ${(bytes.length/1024).toFixed(0)} KiB`);

const characters = JSON.parse(readFileSync(new URL('../../data/characters.json', import.meta.url), 'utf8'));
const manager = characters.roles.manager;
assert.equal(manager.pose, 'seated');
assert.equal(manager.node_marks, 'seat');
assert.equal(manager.chair_drop, false, 'executive chair must retain its measured height');
assert.ok(nodes.has(manager.entry_area));
const at = name => new THREE.Vector3().setFromMatrixPosition(world(nodes.get(name).i));
const boss = at('NPC_manager'), mentor = at('NPC_mentor');
const [rx0, rx1, ry0, ry1] = cfg.meeting_rooms[0].bounds;
const [mx0, mx1] = cfg.meeting_rooms[1].bounds;
assert.ok(boss.x > rx1 - 1.3 && boss.x < rx1 - .3 && -boss.z > ry0 && -boss.z < ry1, 'Prajith must sit beneath the east-wall clock / artwork');
assert.ok(mentor.x > mx0 && mentor.x < mx1, 'Ms. Nga must occupy room 2');
const desk = fixes.props.find(p => p.model === 'ceo_office'), pc = fixes.props.find(p => p.model === 'apple_desktop');
assert.equal(desk.yaw_deg, -90, 'executive desk must be perpendicular to the conference table');
assert.equal(pc.yaw_deg, 90, 'computer screen must face the seated boss');
assert.equal(nodes.get('NPC_manager').n.extras.yaw_deg, 90);
const executive = at('COL_executive_desk'), conference = at('COL_phong_hop_mentor_ban');
assert.ok(Math.abs(executive.z - conference.z) < .01, 'both tabletop centres must share the conference-table axis');
assert.ok(Math.abs(-executive.z - nodes.get('INT_phong_hop_mentor').n.extras.clock_wall_axis_y) < .01, 'desk must align with the clock / central artwork');
assert.ok(executive.x > conference.x + 2, 'executive desk must occupy the head of the conference table');
assert.ok(supported(new THREE.Vector3(...manager.arrival_exit)) && clear(new THREE.Vector3(...manager.arrival_exit)), 'boss needs a clear standing position');
let extraTris = 0, extraBytes = 0;
for (const id of ['ceo_office', 'apple_desktop']) {
  const prop = readFileSync(new URL(`../../assets/props/${id}/${id}.glb`, import.meta.url));
  const data = JSON.parse(prop.subarray(20, 20 + prop.readUInt32LE(12)).toString('utf8'));
  const tris = data.meshes.reduce((n, m) => n + m.primitives.reduce((s, p) => s + data.accessors[p.indices].count / 3, 0), 0);
  extraTris += tris; extraBytes += prop.length;
  assert.ok(!data.animations && !data.cameras && !data.extensions?.KHR_lights_punctual);
  assert.ok(data.extensionsUsed.includes('KHR_draco_mesh_compression'));
}
assert.ok(extraTris <= 4500 && extraBytes < 128 * 1024, 'executive furniture exceeds its separate runtime budget');
console.log(`✓ executive: seated boss in room 1, mentor in room 2, clear standing exit, +${extraTris} triangles / ${extraBytes} bytes`);
