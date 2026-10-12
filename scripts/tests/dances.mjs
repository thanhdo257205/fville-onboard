// Shipped dance assets must bind to each existing playable rig without changing its mesh.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MeshoptDecoder } from '../../game/node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
await MeshoptDecoder.ready;
const root = new URL('../../', import.meta.url);
const cfg = JSON.parse(readFileSync(new URL('data/characters.json', root), 'utf8'));
const dances = JSON.parse(readFileSync(new URL('data/dances.json', root), 'utf8')).dances;
const emotes = JSON.parse(readFileSync(new URL('data/net.json', root), 'utf8')).emotes;
assert.equal(dances.length, 34);
const ids = new Set(dances.map(d => d.id));
assert.equal(ids.size, 34);
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
  assert.ok(model.dance_glb, `${id} missing dance asset`);
  const base = glb(model.glb.low).data, { bytes, data: pack, binary } = glb(model.dance_glb);
  total += bytes;
  assert.ok(bytes < 2 * 1024 * 1024, `${id} dance pack exceeds 2 MiB`);
  assert.ok(pack.extensionsUsed.includes('EXT_meshopt_compression'));
  assert.equal(pack.meshes.length, base.meshes.length, 'dance variant must contain its playable mesh');
  assert.equal(triangles(pack), triangles(base), 'do not alter the character geometry');
  assert.deepEqual(boneNames(pack), boneNames(base), 'dance skeleton must match the existing rig');
  assert.deepEqual(new Set(pack.animations.map(a => a.name)), ids);
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
      assert.ok(times.at(-1) > 0 && times.at(-1) < 60, 'dance duration must be finite and short');
      assert.ok(values.every(Number.isFinite), `${anim.name} contains nonfinite transforms`);
      assert.ok(times.every((v, i) => Number.isFinite(v) && (!i || v > times[i - 1])), 'key times must increase');
    }
  }
}
for (const d of dances) {
  assert.ok(d.label.en && d.label.vi && d.id === d.anim);
  assert.ok(emotes.some(e => e.id === d.id && e.anim === d.anim && e.dance), 'server must allow dance messages');
}
console.log(`✓ dances: 34 animations × 4 matching playable rigs, unchanged meshes, network allowlist, ${(total/1024/1024).toFixed(2)} MiB total loaded on demand`);
