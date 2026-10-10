// App My FPT (phím Tab): tab Checklist, Túi đồ, Huy hiệu, Bản đồ (+ Sổ lời khuyên khi có phần thưởng so_loi_khuyen, zone 5)
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
    const tabs = list.map((k) => `<button data-tab="${k}" class="${this.tab === k ? "on" : ""}">${t(`myfpt.tabs.${k}`)}</button>`).join("");
    this.el.innerHTML = `<div class="phone">
      <div class="top"><b>${t("myfpt.title")}</b><span>${escape(s.player.name)}</span>
        <button class="help ${this.helpOpen ? "on" : ""}" data-a="help">? ${t("myfpt.help")} <kbd>H</kbd></button></div>
      ${this.helpOpen ? `<div class="helpbox"><b>${t("guide.help_title")}</b>${(this.game?.guide.helpLines() || []).map((l) => `<p>${escape(l)}</p>`).join("")}</div>` : ""}
      <div class="stats">${stat("hieu_biet")}${stat("ket_noi")}</div>
      <nav>${tabs}</nav>
      <div class="page">${this[this.tab]()}</div>
      <div class="foot">${t("myfpt.close")}</div></div>`;
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

function escape(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }
