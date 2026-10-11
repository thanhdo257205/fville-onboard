// Bảng tên nhỏ trên đầu NPC (HTML qua CSS2DRenderer): ẩn khi xa hơn maxDistance (characters.json name_tags,
// mặc định 12 m) hoặc bị tường (COL_) che.
// Màn thấp (body.short — ui/touch.js): chữ nhỏ hơn (CSS), bảng tên vai phụ (name_tags.minor_roles, vd "Passenger") chỉ hiện
// khi gần hơn minorDistance; các bảng tên đang hiện (cả người chơi khác — net/remotes.js) không được đè nhau: bảng ở thấp hơn
// trên màn hình (thường là người gần hơn) giữ chỗ, bảng chồng lên thì dời lên từng nấc, quá DODGE_STEPS nấc vẫn chồng thì ẩn.
// Xếp lại DODGE_HZ lần / giây (đo vị trí = bắt trình duyệt tính lại bố cục — mỗi khung thì máy yếu chậm hẳn), dưới 2 bảng thì
// thôi. Đang hội thoại: ẩn hết (CSS body.talking).
import * as THREE from "three";
import { CSS2DRenderer, CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import { blocked } from "../world/collision.js";

const DODGE_STEPS = 2;    // số nấc dời lên tối đa (mỗi nấc = chiều cao bảng + GAP)
const GAP = 2;            // px giữa 2 bảng tên
const DODGE_HZ = 5;       // số lần xếp lại mỗi giây

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
    this.minorRoles = new Set();   // vai phụ: bảng tên chỉ hiện khi gần (màn thấp)
    this.minorDistance = 5;
    this.dodgeTimer = 0;
  }
  get short() { return document.body.classList.contains("short"); }
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
        const far = this.short && this.minorRoles.has(t.userData.role) ? this.minorDistance : this.maxDistance;
        t.visible = d < far && !(this.occlusion && blocked(collider, camera.position, p));
      }
    }
    this.renderer.render(scene, camera);
    this.dodgeTimer -= dt;
    if (this.short && !document.body.classList.contains("talking")) { if (this.dodgeTimer <= 0) { this.dodgeTimer = 1 / DODGE_HZ; this.dodge(); } }
    else if (this._dodged) this.undodge();
  }

  // màn thấp: dời các bảng tên đang đè nhau (CSS2DRenderer đặt transform mỗi khung → dời bằng style.top)
  dodge() {
    const els = [...this.renderer.domElement.querySelectorAll(".nametag")];
    const shown = els.filter((el) => el.style.display !== "none");
    if (shown.length < 2) { if (this._dodged) this.undodge(); return; }
    const items = [];
    for (const el of els) {
      if (el.style.display === "none") { el.style.top = ""; el.style.visibility = ""; continue; }
      const dy = +el.dataset.dy || 0, r = el.getBoundingClientRect();
      items.push({ el, x0: r.left, x1: r.right, y0: r.top - dy, y1: r.bottom - dy, h: r.height });
    }
    items.sort((a, b) => b.y1 - a.y1);
    const placed = [];
    const hit = (it, dy) => placed.some((p) => it.x0 < p.x1 && it.x1 > p.x0 && it.y0 + dy < p.y1 + GAP && it.y1 + dy > p.y0 - GAP);
    for (const it of items) {
      let dy = 0, k = 0;
      while (hit(it, dy) && k < DODGE_STEPS) { k++; dy = -k * (it.h + GAP); }
      const ok = !hit(it, dy);
      it.el.style.visibility = ok ? "" : "hidden";
      if ((+it.el.dataset.dy || 0) !== dy) { it.el.dataset.dy = dy; it.el.style.top = dy ? `${dy}px` : ""; }
      if (ok) placed.push({ x0: it.x0, x1: it.x1, y0: it.y0 + dy, y1: it.y1 + dy });
    }
    this._dodged = true;
  }
  undodge() {
    for (const el of this.renderer.domElement.querySelectorAll(".nametag")) { el.style.top = ""; el.style.visibility = ""; delete el.dataset.dy; }
    this._dodged = false;
  }
  // smoke / __game: các bảng tên đang thấy (toạ độ màn hình)
  visibleRects() {
    return [...this.renderer.domElement.querySelectorAll(".nametag")].filter((el) => el.style.display !== "none" && el.style.visibility !== "hidden"
      && getComputedStyle(this.renderer.domElement).display !== "none").map((el) => { const r = el.getBoundingClientRect(); return { text: el.textContent, x0: r.left, x1: r.right, y0: r.top, y1: r.bottom }; });
  }
}
