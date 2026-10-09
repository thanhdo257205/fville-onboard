// App My FPT (phím Tab): 3 tab Checklist, Túi đồ, Huy hiệu + 2 chỉ số Hiểu biết, Kết nối.
// Huy hiệu 6 giá trị: ô sáng khi đã thể hiện giá trị VÀ đã có huy hiệu; Đợt 2 chỉ Respect và Fairness hoạt động.
import { tx, draftMark } from "../content/content.js";
import { t } from "../i18n.js";

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
    el.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) { this.tab = b.dataset.tab; this.draw(); } });
  }
  get open() { return !this.el.hidden; }
  show(tab) { if (tab) this.tab = tab; this.el.hidden = false; this.draw(); }
  hide() { this.el.hidden = true; }

  draw() {
    const s = this.s, c = this.c;
    const stat = (k) => `<div class="stat"><span>${t(`stats.${k}`)}</span><div class="bar"><i style="width:${s.stats[k]}%"></i></div><b>${s.stats[k]}</b></div>`;
    const tabs = ["checklist", "bag", "badges"].map((k) => `<button data-tab="${k}" class="${this.tab === k ? "on" : ""}">${t(`myfpt.tabs.${k}`)}</button>`).join("");
    this.el.innerHTML = `<div class="phone">
      <div class="top"><b>${t("myfpt.title")}</b><span>${escape(s.player.name)}</span></div>
      <div class="stats">${stat("hieu_biet")}${stat("ket_noi")}</div>
      <nav>${tabs}</nav>
      <div class="page">${this[this.tab]()}</div>
      <div class="foot">${t("myfpt.close")}</div></div>`;
  }

  checklist() {
    const cur = this.s.currentQuest(this.s.zone);
    const curCk = cur?.checklist;
    return `<ol class="check">${this.c.checklist.map((x) => {
      const done = this.s.checklistDone(x.id);
      const later = !this.c.quests.some((q) => q.checklist === x.id);
      return `<li class="${done ? "done" : ""} ${x.id === curCk ? "current" : ""} ${later ? "later" : ""}">
        <span class="tick">${done ? "✓" : ""}</span>${tx(x.title)}${later ? `<em>${t("myfpt.checklist_soon")}</em>` : ""}</li>`;
    }).join("")}</ol>`;
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
