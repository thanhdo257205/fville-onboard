// Tủ đồ: chọn áo (characters.json → wardrobe.outfits) và phụ kiện (accessories, vd mũ lưỡi trai cam). Mở bằng nút 👕
// (máy tính: góc phải dưới; cảm ứng: hàng nút — ui/touch.js), phím I, hoặc nút trong menu Esc. Bảng ở bên phải màn hình, camera
// quay ra trước mặt nhân vật (Game.openWardrobe) — bấm món đồ là mặc ngay. Món chưa mở khoá: ổ khoá + câu gợi ý cách mở.
// Khung xem trước đầu bảng: chân dung nhân vật mặc bộ đang trỏ tới (rê chuột / focus / chạm — cả món chưa mở khoá), mặc định
// bộ đang mặc; thẻ áo có ảnh thu nhỏ (như màn tạo nhân vật — models.<id>.portrait / outfit_portraits).
// Phím: 1–9 chọn theo thứ tự (áo rồi phụ kiện), I / Esc đóng. Dữ liệu + mặc / đội: Game.wardrobeInfo / setPlayerOutfit /
// setAccessory (lưu bản lưu: player.outfit, player.accessories; người chơi khác thấy qua mạng).
import { t } from "../i18n.js";
import { device } from "../core/device.js";
import { hud } from "./hud.js";
import { sound } from "../core/sound.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export class Wardrobe {
  // game: Game (toggleWardrobe, wardrobeInfo, setPlayerOutfit, setAccessory)
  constructor({ game }) {
    this.game = game;
    this.el = document.createElement("div");
    this.el.id = "wardrobe";
    this.el.hidden = true;
    document.body.append(this.el);
    // nút mở trên máy tính (cảm ứng dùng nút trong hàng nút của ui/touch.js)
    this.btn = document.createElement("button");
    this.btn.id = "wardrobe-btn";
    this.btn.type = "button";
    this.btn.hidden = true;
    this.btn.innerHTML = "👕<kbd>I</kbd>";
    this.btn.addEventListener("click", () => this.game.toggleWardrobe());
    document.body.append(this.btn);
    this.el.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.act === "close") return this.game.toggleWardrobe();
      const k = this.indexOf(b);
      if (k >= 0) { this.preview(k); this.pick(k); }
    });
    // rê chuột / focus (phím Tab) vào thẻ → xem trước; rời bảng → về bộ đang mặc
    const hover = (e) => { const b = e.target.closest?.(".item"); const k = b ? this.indexOf(b) : -1; if (k >= 0) this.preview(k); };
    this.el.addEventListener("pointerover", hover);
    this.el.addEventListener("focusin", hover);
    this.el.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") this.preview(-1); });   // ngón tay: giữ món vừa chạm
    this.list = [];
    this.btnKey = "";
  }
  get open() { return !this.el.hidden; }

  show() { this.previewing = null; this.draw(); this.el.hidden = false; this.el.querySelector(".item.on")?.focus({ preventScroll: true }); }
  hide() { this.el.hidden = true; }

  indexOf(b) { return this.list.findIndex((x) => x.kind === b.dataset.kind && x.id === b.dataset.id); }

  // khung xem trước: món thứ i (−1 = bộ đang mặc). Phụ kiện: chân dung bộ đang mặc + biểu tượng món đó
  preview(i) {
    const box = this.el.querySelector(".preview");
    if (!box) return;
    const x = this.list[i], info = this.info_;
    const worn = this.list.find((y) => y.kind === "outfit" && y.worn);
    const show = x ?? worn;
    const img = x?.kind === "acc" ? info.wornImg : show?.img;
    const im = box.querySelector("img");
    if (img) { if (im.getAttribute("src") !== img) im.src = img; im.hidden = false; } else im.hidden = true;
    box.querySelector(".badge").textContent = x?.kind === "acc" ? x.icon || "" : "";
    box.querySelector(".badge").hidden = x?.kind !== "acc";
    box.querySelector("b").textContent = show?.name ?? "";
    const on = show && (show.kind === "outfit" ? show.worn : show.on);
    box.querySelector(".st").textContent = !show ? "" : !show.unlocked ? t("wardrobe.locked")
      : show.kind === "outfit" ? (on ? t("wardrobe.wearing") : t("wardrobe.wear")) : t(on ? "wardrobe.on" : "wardrobe.off");
    box.querySelector(".st").className = `st${on ? " on" : ""}`;
    box.classList.toggle("locked", !!show && !show.unlocked);
    this.previewing = x ? x.id : null;
  }

  draw() {
    const info = this.info_ = this.game.wardrobeInfo();
    this.list = [...info.outfits.map((o) => ({ kind: "outfit", ...o })), ...info.accessories.map((a) => ({ kind: "acc", ...a }))];
    let n = 0;
    const card = (x) => {
      n += 1;
      const on = x.kind === "outfit" ? x.worn : x.on;
      const state = !x.unlocked ? t("wardrobe.locked") : x.kind === "outfit" ? (on ? t("wardrobe.wearing") : t("wardrobe.wear"))
        : t(on ? "wardrobe.on" : "wardrobe.off");
      // món chưa mở khoá: không dùng disabled (rê chuột / focus vẫn được để xem trước), bấm → câu gợi ý cách mở
      const thumb = x.img ? `<img alt="" src="${esc(x.img)}">` : esc(x.icon || "👕");
      return `<button type="button" class="item${on ? " on" : ""}${x.unlocked ? "" : " locked"}" data-kind="${x.kind}" data-id="${esc(x.id)}"${x.unlocked ? "" : " aria-disabled=\"true\""}
        aria-pressed="${on ? "true" : "false"}">
        <span class="ic${x.img ? " ph" : ""}" aria-hidden="true">${thumb}${x.unlocked ? "" : "<i>🔒</i>"}</span>
        <span class="tx"><b>${esc(x.name)}</b><small>${esc(x.unlocked ? x.desc || "" : x.locked || "")}</small></span>
        <span class="st">${esc(state)}</span><kbd>${n}</kbd></button>`;
    };
    const outs = this.list.filter((x) => x.kind === "outfit").map(card).join("");
    const accs = this.list.filter((x) => x.kind === "acc").map(card).join("");
    this.el.innerHTML = `<div class="panel" role="dialog" aria-label="${esc(t("wardrobe.title"))}">
      <header><h2>👕 ${esc(t("wardrobe.title"))}</h2><button type="button" class="x" data-act="close" aria-label="${esc(t("wardrobe.close"))}">×</button></header>
      <div class="preview" aria-live="polite"><div class="pic"><img alt="" hidden><span class="badge" hidden></span></div>
        <div class="cap"><b></b><span class="st"></span></div></div>
      <h3>${esc(t("wardrobe.outfits"))}</h3><div class="items">${outs}</div>
      ${accs ? `<h3>${esc(t("wardrobe.accessories"))}</h3><div class="items">${accs}</div>` : ""}
      <p class="muted keys">${esc(device.touch ? "" : t("wardrobe.keys", { n: this.list.length }))}</p></div>`;
    // giữ món đang xem trước sau khi vẽ lại (vd vừa bấm mặc)
    this.preview(this.previewing ? this.list.findIndex((x) => x.id === this.previewing) : -1);
  }

  // chọn món thứ i (0…): áo → mặc; phụ kiện → đội / bỏ
  async pick(i) {
    const x = this.list[i];
    if (x) this.preview(i);
    if (!x || !x.unlocked) { if (x) hud.toast(x.locked || t("wardrobe.locked")); return false; }
    if (x.kind === "outfit") {
      if (!x.worn && this.game.setPlayerOutfit(x.id)) { sound.play("tap"); hud.toast(t("wardrobe.worn_outfit", { name: x.name })); }
    } else {
      const on = !x.on;
      await this.game.setAccessory(x.id, on);
      sound.play("tap");
      hud.toast(t(on ? "wardrobe.worn_on" : "wardrobe.worn_off", { name: x.name }));
    }
    if (this.open) this.draw();
    return true;
  }

  // mỗi khung: nút 👕 trên máy tính chỉ hiện lúc đang đi lại (chỉ đụng DOM khi khác lần trước)
  update() {
    const g = this.game;
    const show = !device.touch && !this.open && g.mode === "play" && g.state.phase === "playing" && !g.cutscene && !g.preview && !g.timeSkipping;
    const key = `${show}|${t("wardrobe.title")}`;
    if (key === this.btnKey) return;
    this.btnKey = key;
    this.btn.hidden = !show;
    this.btn.title = this.btn.ariaLabel = `${t("wardrobe.title")} (I)`;
  }

  // __game.wardrobe: trạng thái cho kiểm thử
  info() {
    // nút / bảng position: fixed → offsetParent luôn null; đo bằng khung bao
    const r = (el) => { if (!el || el.hidden) return null; const b = el.getBoundingClientRect(); return b.width ? { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } : null; };
    const pv = this.el.querySelector(".preview img");
    return { open: this.open, button: r(this.btn), items: this.list.map((x) => ({ kind: x.kind, id: x.id, unlocked: x.unlocked, on: x.kind === "outfit" ? x.worn : x.on, img: x.img || null })),
      preview: pv && !pv.hidden ? { img: pv.getAttribute("src"), name: this.el.querySelector(".preview b")?.textContent, item: this.previewing } : null };
  }
}
