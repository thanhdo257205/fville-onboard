// Bảng tên nhỏ trên đầu NPC (HTML qua CSS2DRenderer): ẩn khi xa hơn maxDistance (characters.json name_tags,
// mặc định 12 m) hoặc bị tường (COL_) che.
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { blocked } from "../world/collision.js";

export class NameTags {
  constructor(container) {
    this.renderer = new CSS2DRenderer();
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.domElement.className = "nametags";
    container.appendChild(this.renderer.domElement);
    this.tags = [];
    this.timer = 0;
    this.maxDistance = 12;
    this.occlusion = true;
    this.above = 0.28;
  }
  add(parent, text, height) {
    const el = document.createElement("div");
    el.className = "nametag";
    el.textContent = text;
    const obj = new CSS2DObject(el);
    obj.position.set(0, height + this.above, 0);
    parent.add(obj);
    this.tags.push(obj);
    return obj;
  }
  clear() { for (const t of this.tags) { t.element.remove(); t.parent?.remove(t); } this.tags = []; }
  setSize(w, h) { this.renderer.setSize(w, h); }
  render(scene, camera, collider, dt) {
    this.timer -= dt;
    if (this.timer <= 0 && collider) {      // kiểm tra che khuất 5 lần/giây
      this.timer = 0.2;
      const p = new THREE.Vector3();
      for (const t of this.tags) {
        t.getWorldPosition(p);
        const d = p.distanceTo(camera.position);
        t.visible = d < this.maxDistance && !(this.occlusion && blocked(collider, camera.position, p));
      }
    }
    this.renderer.render(scene, camera);
  }
}
