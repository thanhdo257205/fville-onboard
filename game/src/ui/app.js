// App My FPT (phím Tab) — bố cục điện thoại thông minh: thanh trạng thái (giờ trong game, sóng / wifi / pin), thanh app (avatar,
// tên, Help, nút × cho màn cảm ứng), nội dung cuộn riêng, thanh tab dưới có biểu tượng, vạch home; màn hẹp / thấp (điện thoại
// thật) chiếm trọn màn hình (style.css #myfpt). Tab Checklist, Túi đồ, Huy hiệu, Bản đồ (+ Sổ lời khuyên khi có phần thưởng so_loi_khuyen, zone 5)
// + 2 chỉ số Hiểu biết, Kết nối; nút Help (phím H) = gợi ý của mục tiêu hiện tại (game/guide.js). Túi đồ: thẻ nhân viên, ảnh
// check-in, La bàn nghề nghiệp (kết quả gặp Prajith), Nhiệm vụ đầu tiên (từ Manager). Đã xong game: nút xem lại màn tổng kết
// đầu tab Checklist (như menu Esc → View summary). Bản đồ: ảnh zone chụp từ trên xuống + dấu bạn / Tú / mục tiêu (ui/map.js).
// Huy hiệu 6 giá trị: ô sáng khi đã thể hiện giá trị VÀ đã có huy hiệu; Đợt 2 chỉ Respect và Fairness hoạt động.
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";
import { ZoneMap } from "./map.js";
import { sound } from "../core/sound.js";

export class MyFptApp {
  constructor(content, state) {
    this.c = content;
    this.s = state;
    this.tab = "checklist";
    const el = document.createElement("div");
    el.id = "myfpt";
    el.hidden = true;
    document.body.appendChild(el);
    this.el = el;
    this.helpOpen = false;
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-tab]");
      if (b) { if (b.dataset.tab !== this.tab) sound.play("select"); this.tab = b.dataset.tab; this.draw(); }
      if (e.target.closest("[data-a=help]")) { sound.play("tap"); this.toggleHelp(); }
      if (e.target.closest("[data-a=summary]")) this.game?.openSummary();   // tự đóng app, không qua chế độ chơi
      if (e.target.closest("[data-a=close]")) this.game?.toggleApp();       // nút × (màn cảm ứng không có phím Tab)
    });
  }
  get open() { return !this.el.hidden; }
  show(tab) { if (tab) this.tab = tab; this.helpOpen = false; this.el.hidden = false; this.draw(); }
  toggleHelp() { this.helpOpen = !this.helpOpen; this.draw(); }
  hide() { this.el.hidden = true; }

  draw() {
    const s = this.s, c = this.c;
    const stat = (k) => `<div class="stat"><span>${t(`stats.${k}`)}</span><div class="bar"><i style="width:${s.stats[k]}%"></i></div><b>${s.stats[k]}</b></div>`;
    const list = ["checklist", "bag", "badges", "map", ...(s.hasReward("so_loi_khuyen") ? ["advice"] : [])];
    if (!list.includes(this.tab)) this.tab = "checklist";
    const tabs = list.map((k) => `<button data-tab="${k}" class="${this.tab === k ? "on" : ""}" aria-pressed="${this.tab === k}"><svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[k]}</svg><span>${t(`myfpt.tabs.${k}`)}</span></button>`).join("");
    const clock = document.getElementById("clock")?.textContent || "";
    const initial = [...String(s.player.name || "").trim()][0]?.toUpperCase() || "·";
    this.el.innerHTML = `<div class="phone">
      <div class="status" aria-hidden="true"><span class="clock">${escape(clock)}</span><span class="sys">${SYS_ICONS}</span></div>
      <header class="appbar"><span class="avatar" aria-hidden="true">${escape(initial)}</span><div class="who"><b>${t("myfpt.title")}</b><small>${escape(s.player.name)}</small></div>
        <button class="help ${this.helpOpen ? "on" : ""}" data-a="help">? ${t("myfpt.help")} <kbd>H</kbd></button>
        <button class="close" data-a="close" aria-label="${escape(t("myfpt.close_btn"))}">×</button></header>
      <div class="screen">
      ${this.helpOpen ? `<div class="helpbox"><b>${t("guide.help_title")}</b>${(this.game?.guide.helpLines() || []).map((l) => `<p>${escape(l)}</p>`).join("")}</div>` : ""}
      <div class="stats">${stat("hieu_biet")}${stat("ket_noi")}</div>
      <div class="page">${this[this.tab]()}</div>
      <div class="foot">${t("myfpt.close")}</div></div>
      <div class="dock"><nav class="tabbar">${tabs}</nav><i class="home" aria-hidden="true"></i></div></div>`;
  }

  // checklist nhóm theo 4 Act (data/acts.json): tiêu đề Act + tiến độ; mục chưa có việc (zone 5) hiện khóa
  checklist() {
    const cur = this.s.currentQuest(this.s.zone);
    const curCk = cur?.checklist;
    const status = this.game?.acts.status() || [];
    const curAct = this.game?.acts.current()?.act.id;
    const done = this.game?.complete ? `<button class="ghost wide view-summary" data-a="summary">🏆 ${t("menu.view_summary")}</button>` : "";
    const item = (it) => {
      const x = this.c.checklist.find((c) => c.id === it.id);
      return `<li class="${it.done ? "done" : ""} ${it.id === curCk ? "current" : ""} ${it.locked ? "later" : ""}">
        <span class="tick">${it.done ? "✓" : it.locked ? "🔒" : ""}</span>${tx(x.title)}${it.locked ? `<em>${t("myfpt.checklist_soon")}</em>` : ""}</li>`;
    };
    return done + status.map((st) => `<section class="act ${st.complete ? "complete" : ""} ${st.act.id === curAct ? "now" : ""}">
      <header><b>${t("acts.label", { n: st.act.number })} · ${tx(st.act.title)}</b><span>${t("myfpt.act_progress", { done: st.done, total: st.total })}</span></header>
      <div class="actbar"><i style="width:${(100 * st.done) / st.total}%"></i></div>
      <ol class="check">${st.items.map(item).join("")}</ol></section>`).join("");
  }

  bag() {
    const s = this.s, c = this.c;
    const pos = this.game?.characters.cfg.character_creation.positions.find((x) => x.id === s.player.position);
    const grains = `<li class="grains"><span class="icon">🌾</span><div><b>${t("myfpt.grains", { n: s.grains.size, total: c.grainsTotal })}</b>
      <small>${t("myfpt.grains_hint")}</small></div></li>`;
    const rows = s.rewards.filter((id) => !String(c.rewards.get(id)?.type).startsWith("badge")).map((id) => {
      const r = c.rewards.get(id);
      // thẻ nhân viên: in ảnh thẻ + tên + vị trí; ảnh check-in: hiện ảnh
      if (id === "the_nhan_vien") {
        return `<li class="card-row"><div class="id-card small"><div class="top">FPT Software</div>
          ${s.photos.id ? `<img src="${s.photos.id}" alt="">` : `<div class="nophoto">🙂</div>`}
          <b>${escape(s.player.name)}</b><span>${escape(tx(pos?.name) || "")} · Intern</span></div>
          <div><b>${tx(r.name)}</b><small>${tx(r.desc)}</small></div></li>`;
      }
      // La bàn nghề nghiệp: xu hướng + hướng phát triển theo vị trí intern (minigames.career_compass)
      if (id === "la_ban_nghe_nghiep" && s.compass) {
        const d = c.minigames.career_compass, tr = d?.traits[s.compass.trait];
        const dir = d?.directions[s.compass.position]?.[s.compass.trait] ?? d?.directions.developer?.[s.compass.trait];
        return `<li class="compass-row"><span class="icon">${r.icon}</span><div><b>${tx(r.name)} · ${escape(tx(tr?.name))}</b>
          <small>${escape(tx(tr?.desc))}</small><small class="dir">→ ${escape(tx(dir))}</small></div></li>`;
      }
      // Nhiệm vụ đầu tiên: việc Manager giao (minigames.priorities → mission)
      if (id === "nhiem_vu_dau_tien") {
        return `<li class="mission-row"><span class="icon">${r.icon}</span><div><b>${tx(r.name)}</b><small>${escape(tx(c.minigames.priorities?.mission) || tx(r.desc))}</small></div></li>`;
      }
      if (r.type === "photo" && s.photos.checkin) {
        return `<li class="photo-row"><img class="thumb" src="${s.photos.checkin}" alt=""><div><b>${tx(r.name)}</b><small>${tx(r.desc)}</small></div></li>`;
      }
      return `<li><span class="icon">${r.icon}</span><div><b>${draftMark(r.draft)}${tx(r.name)}</b><small>${tx(r.desc)}</small></div></li>`;
    });
    const carry = s.items.map((id) => {
      const r = c.carry.get(id);
      return `<li class="carry"><span class="icon">${r.icon}</span><div><b>${tx(r.name)}</b><small>${t("myfpt.carry")} · ${tx(r.desc)}</small></div></li>`;
    });
    return `<ul class="bag">${carry.join("")}${rows.join("")}${grains}</ul>`;
  }

  // dữ liệu tab Bản đồ (ảnh chụp lại khi đổi zone / tầng; chụp xong → vẽ lại tab) — __game.map dùng chung
  mapView() {
    if (!this.game?.zone) return null;
    this.zmap ??= new ZoneMap(this.game, () => { if (this.open && this.tab === "map") this.draw(); });
    return this.zmap.view();
  }

  map() {
    const v = this.mapView();
    if (!v) return `<p class="empty">${t("myfpt.map_empty")}</p>`;
    if (v.pending) return `<div class="map-h"><b>${escape(t(`zones.${this.s.zone}.title`))}</b></div><p class="empty">${t("myfpt.map_loading")}</p>`;
    const at = ([u, w]) => `left:${(u * 100).toFixed(1)}%;top:${(w * 100).toFixed(1)}%`;
    const arrow = `<svg viewBox="-10 -10 20 20"><path d="M0-9L7 7L0 3L-7 7Z"/></svg>`;
    const tu = this.game.characters.displayName("tu");
    const floor = v.target?.floor ? ` <em>${t(`myfpt.map_${v.target.floor}`)}</em>` : "";
    return `<div class="map-h"><b>${escape(t(`zones.${this.s.zone}.title`))}</b></div>
      <div class="map" style="width:${v.w}px;aspect-ratio:${v.w} / ${v.h}"><img src="${v.url}" alt="">
        ${v.tu ? `<i class="mk tu" style="${at(v.tu.uv)}"></i>` : ""}
        ${v.target ? `<i class="mk goal" style="${at(v.target.uv)}">!</i>` : ""}
        <i class="mk me" style="${at(v.me.uv)};--r:${v.me.deg}deg">${arrow}</i></div>
      <div class="map-legend"><span><i class="mk me">${arrow}</i>${t("myfpt.map_you")}</span>${v.tu ? `<span><i class="mk tu"></i>${escape(tu)}</span>` : ""}</div>
      ${v.target ? `<p class="map-goal"><i class="mk goal">!</i><span>${escape(this.game.objectiveText())}${floor}</span></p>` : ""}`;
  }

  // Sổ lời khuyên (zone 5): lời khuyên ngày đầu của đồng nghiệp, theo thứ tự nhận
  advice() {
    const s = this.s, c = this.c;
    if (!s.advice.length) return `<p class="empty">${t("myfpt.advice_empty")}</p>`;
    return `<h3 class="advice-h">📒 ${t("myfpt.advice_title")}</h3><ul class="advice">${s.advice.map((id) => {
      const a = c.adviceById.get(id);
      return a ? `<li><p>“${escape(tx(a.text))}”</p><small>— ${escape(c.names?.(a.from) ?? a.from)}</small></li>` : "";
    }).join("")}</ul>`;
  }

  badges() {
    const s = this.s, c = this.c;
    const own = (id) => s.hasReward(id);
    const team = c.rewards.get("huy_hieu_dong_doi");
    const badge = c.rewards.get(c.badge.reward);
    const slots = c.values.map((v) => {
      const lit = s.valueLit(v.id);
      const cls = lit ? "lit" : v.active ? "" : "inactive";
      return `<div class="slot ${cls}" title="${escape(tx(v.how))}"><b>${v.vi.split(" ")[0]}</b><span>${draftMark(v.draft)}${tx(v.name)}</span>
        <small>${lit ? "✓" : v.active ? tx(v.hint) : t("myfpt.value_inactive")}</small></div>`;
    }).join("");
    return `<div class="badge ${own("huy_hieu_dong_doi") ? "" : "locked"}"><span class="icon">${team.icon}</span><div><b>${tx(team.name)}</b><small>${tx(team.desc)}</small></div></div>
      <div class="badge big ${own(c.badge.reward) ? "" : "locked"}"><span class="icon">${badge.icon}</span>
        <div><b>${c.badge.name}</b><small>${draftMark(c.badge.draft)}${tx(c.badge.subtitle)}</small>
        ${own(c.badge.reward) ? "" : `<small class="lock">${t("myfpt.values_locked")}</small>`}</div></div>
      <div class="slots">${slots}</div>`;
  }
}

// biểu tượng thanh tab (nét 2 px, màu theo chữ) và thanh trạng thái (sóng, wifi, pin) — vẽ bằng SVG, không phụ thuộc emoji của máy
const TAB_ICONS = {
  checklist: '<path d="M4 6h2M4 12h2M4 18h2M9 6h11M9 12h11M9 18h11"/>',
  bag: '<path d="M6 8h12l1 12H5L6 8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  badges: '<circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  advice: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6"/>',
};
const SYS_ICONS = '<svg viewBox="0 0 20 14"><rect x="1" y="9" width="3" height="4" rx="1"/><rect x="6" y="6" width="3" height="7" rx="1"/><rect x="11" y="3" width="3" height="10" rx="1"/><rect x="16" y="0" width="3" height="13" rx="1"/></svg>'
  + '<svg viewBox="0 0 20 14"><path d="M1 5a13 13 0 0 1 18 0M4 8a9 9 0 0 1 12 0M7 11a4.5 4.5 0 0 1 6 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="10" cy="13" r="1.2"/></svg>'
  + '<svg viewBox="0 0 26 14"><rect x="1" y="1.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="3.5" width="15" height="7" rx="1.5"/><path d="M23.5 5v4a2 2 0 0 0 0-4z"/></svg>';

function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
