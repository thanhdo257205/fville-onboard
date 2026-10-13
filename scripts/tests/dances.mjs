// Shipped dance assets must bind to each existing playable rig without changing its mesh.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../../game/node_modules/three/build/three.module.js';
import { MeshoptDecoder } from '../../game/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
await MeshoptDecoder.ready;
const root = new URL('../../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('data/characters.json', root), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('data/dances.json', root), 'utf8'));
const dances = manifest.dances;
assert.equal(manifest.segments.length, 34);
assert.deepEqual(new Set(manifest.order), new Set(manifest.segments.map(s => s.id)));
assert.equal(manifest.order.length, 34);
const emotes = JSON.parse(readFileSync(new URL('data/net.json', root), 'utf8')).emotes;
assert.equal(dances.length, 2);
const ids = new Set(dances.map(d => d.id));
assert.equal(ids.size, 2);
const glb = path => {
  const b = readFileSync(new URL(path, root));
  const end = 20 + b.readUInt32LE(12);
  return { bytes: b.length, data: JSON.parse(b.subarray(20, end).toString('utf8')), binary: b.subarray(end + 8) };
};
const triangles = j => j.meshes.reduce((n, m) => n + m.primitives.reduce((s, p) => s + j.accessors[p.indices].count / 3, 0), 0);
const boneNames = j => j.skins[0].joints.map(i => j.nodes[i].name).sort();
let total = 0;
for (const id of Object.values(cfg.roles.player.looks).flat()) {
  const model = cfg.models[id];
  const sequence = JSON.parse(readFileSync(new URL(`assets/characters/${id}/${id}_dances.report.json`, root), 'utf8'));
  assert.deepEqual(sequence.order, manifest.order);
  assert.equal(sequence.joins.length, 33);
  assert.equal(sequence.root_continuity, true, 'segments must preserve the travelled horizontal position');
  assert.equal(sequence.root_joins.length, 33);
  assert.ok(sequence.loop_bridge_frames >= 10, 'repeating the dance needs a blended closing pose');
  assert.ok(sequence.joins.every(j => (j.to_frame - j.from_frame - 1) / sequence.fps >= .35), 'each join needs a pose blend');
  assert.ok(model.dance_glb, `${id} missing dance asset`);
  const gracefulPath = model.dance_glbs?.dance_graceful;
  assert.ok(gracefulPath, `${id} needs its ActorCore asset`);
  const graceful = JSON.parse(readFileSync(new URL(gracefulPath.replace('.glb', '.report.json'), root), 'utf8'));
  assert.equal(graceful.anim, 'dance_graceful');
  assert.equal(graceful.source_frames, 697);
  assert.equal(graceful.mapped_bones, boneNames(glb(model.glb.low).data).length);
  assert.ok(graceful.lowest_after_m >= -.002 && graceful.floor_lift_max_m < .15, 'retargeted feet need valid floor contact');
  assert.ok(graceful.duration_s > 23 && graceful.duration_s < 24);
  const base = glb(model.glb.low).data;
  for (const entry of [{ path: model.dance_glb, anim: 'dance_breakdance_full', report: sequence },
    { path: gracefulPath, anim: 'dance_graceful', report: graceful }]) {
    const { bytes, data: pack, binary } = glb(entry.path), packReport = entry.report;
    total += bytes;
    assert.ok(bytes < 2 * 1024 * 1024, `${id} dance pack exceeds 2 MiB`);
    assert.ok(pack.extensionsUsed.includes('EXT_meshopt_compression'));
    assert.equal(pack.meshes.length, base.meshes.length, 'dance variant must contain its playable mesh');
    assert.equal(triangles(pack), triangles(base), 'do not alter the character geometry');
    assert.deepEqual(boneNames(pack), boneNames(base), 'dance skeleton must match the existing rig');
    assert.deepEqual(new Set(pack.animations.map(a => a.name)), new Set([entry.anim]));
    const decoded = new Map();
    const floats = accessor => {
      // Meshopt stores rotations as normalized int16 after quantization.
      const formats = { 5120: ['getInt8', 1, 127], 5121: ['getUint8', 1, 255], 5122: ['getInt16', 2, 32767],
        5123: ['getUint16', 2, 65535], 5125: ['getUint32', 4, 4294967295], 5126: ['getFloat32', 4, 1] };
      const format = formats[accessor.componentType];
      assert.ok(format, 'animation accessor has an unsupported component type');
      const vi = accessor.bufferView, view = pack.bufferViews[vi], ext = view.extensions?.EXT_meshopt_compression;
      if (!decoded.has(vi)) {
        if (ext) {
          const out = new Uint8Array(ext.count * ext.byteStride);
          MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, binary.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength), ext.mode, ext.filter);
          decoded.set(vi, out);
        } else decoded.set(vi, binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
      }
      const values = decoded.get(vi), data = new DataView(values.buffer, values.byteOffset, values.byteLength);
      const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type], stride = view.byteStride || n * format[1];
      assert.ok(n, 'animation accessor must contain scalar or TRS values');
      const out = [];
      for (let i = 0; i < accessor.count; i++) for (let k = 0; k < n; k++) {
        const value = data[format[0]]((accessor.byteOffset || 0) + i * stride + k * format[1], true);
        out.push(accessor.normalized ? Math.max(-1, value / format[2]) : value);
      }
      return out;
    };
    for (const anim of pack.animations) {
      const hips = anim.channels.find(c => /Hips$/.test(pack.nodes[c.target.node].name) && c.target.path === 'translation');
      assert.ok(hips, 'dance must retain the hips trajectory');
      const sampler = anim.samplers[hips.sampler], times = floats(pack.accessors[sampler.input]), values = floats(pack.accessors[sampler.output]);
      const parents = new Map(); pack.nodes.forEach((n, i) => (n.children || []).forEach(c => parents.set(c, i)));
      const matrix = i => {
        if (i == null) return new THREE.Matrix4();
        const n = pack.nodes[i], local = n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(
          new THREE.Vector3().fromArray(n.translation || [0, 0, 0]), new THREE.Quaternion().fromArray(n.rotation || [0, 0, 0, 1]), new THREE.Vector3().fromArray(n.scale || [1, 1, 1]));
        return matrix(parents.get(i)).multiply(local);
      };
      const parent = matrix(parents.get(hips.target.node));
      const point = t => {
        const hi = times.findIndex(x => x >= t - .0001), lo = Math.max(0, hi - 1);
        const k = hi === lo ? 0 : (t - times[lo]) / (times[hi] - times[lo]);
        return new THREE.Vector3().fromArray(values, lo * 3).lerp(new THREE.Vector3().fromArray(values, hi * 3), k).applyMatrix4(parent);
      };
      for (const join of packReport.joins || []) {
        const a = point((join.from_frame - 1) / packReport.fps), b = point((join.to_frame - 1) / packReport.fps);
        assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < .01, `${id}: ${join.next} resets the horizontal position`);
      }
      const first = point(times[0]), last = point(times.at(-1));
      assert.ok(Math.abs(first.y - last.y) < .03, 'loop must preserve the starting vertical pose');
      for (const channel of anim.channels.filter(c => c.target.path === 'rotation')) {
        const s = anim.samplers[channel.sampler], v = floats(pack.accessors[s.output]);
        const a = new THREE.Quaternion().fromArray(v, 0).normalize(), b = new THREE.Quaternion().fromArray(v, v.length - 4).normalize();
        assert.ok(a.angleTo(b) < .02, 'loop must return to the same orientation without resetting its position');
      }
      assert.ok(anim.channels.length > 10, `${anim.name} contains no full-body animation`);
      for (const channel of anim.channels) {
        assert.ok(pack.nodes[channel.target.node]?.name, 'animation targets an unknown node');
        assert.ok(['translation', 'rotation', 'scale'].includes(channel.target.path));
      }
      for (const sampler of anim.samplers) {
        const input = pack.accessors[sampler.input], output = pack.accessors[sampler.output];
        assert.ok(input.count > 1);
        assert.equal(input.count, output.count);
        const times = floats(input), values = floats(output);
        assert.ok(Math.abs(times.at(-1) - packReport.duration_s) < .04, 'the complete source motion must be present in the timeline');
        assert.ok(times.at(-1) > 0 && times.at(-1) < 600, 'combined dance duration must be finite and bounded');
        assert.ok(values.every(Number.isFinite), `${anim.name} contains nonfinite transforms`);
        assert.ok(times.every((v, i) => Number.isFinite(v) && (!i || v > times[i - 1])), 'key times must increase');
      }
    }
  }
}
for (const d of dances) {
  assert.ok(d.label.en && d.label.vi && d.id === d.anim);
  assert.ok(emotes.some(e => e.id === d.id && e.anim === d.anim && e.dance), 'server must allow dance messages');
}
console.log(`✓ dances: Breakdance sequence + ActorCore Graceful Dance × 4 matching playable rigs, unchanged meshes, network allowlist, ${(total/1024/1024).toFixed(2)} MiB total loaded on demand`);
