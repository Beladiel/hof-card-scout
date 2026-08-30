(() => {
  const KEY = "scoutFantasySeasonHQ2026V1";
  const league = window.SCOUT_LEAGUE_CONFIG || {teamName:"Lobstahs",emoji:"🦞",waiverField:"Waiver status",waiverLabel:""};
  const root = document.getElementById("seasonHqApp");
  if (!root) return;

  function initial() {
    return {week:"1",wins:0,losses:0,ties:0,waiver:"",notes:"",updated:""};
  }
  function read() {
    try { return {...initial(), ...(JSON.parse(localStorage.getItem(KEY) || "null") || {})}; }
    catch { return initial(); }
  }
  function write(state) {
    state.updated = new Date().toISOString();
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));

  function render() {
    const s = read();
    root.innerHTML = `
      <div class="season-grid">
        <label>WEEK<input id="seasonWeek" inputmode="numeric" value="${esc(s.week)}" placeholder="1"></label>
        <label>WINS<input id="seasonWins" type="number" min="0" value="${Number(s.wins)||0}"></label>
        <label>LOSSES<input id="seasonLosses" type="number" min="0" value="${Number(s.losses)||0}"></label>
        <label>TIES<input id="seasonTies" type="number" min="0" value="${Number(s.ties)||0}"></label>
        <label>${esc(String(league.waiverField || "Waiver status").toUpperCase())}<input id="seasonWaiver" value="${esc(s.waiver)}" placeholder="Update after waivers"></label>
      </div>
      <label class="season-notes-label">WEEKLY NOTES / NEXT ACTION<textarea id="seasonNotes" rows="3" placeholder="Lineup question, waiver target, trade follow-up, injury watch…">${esc(s.notes)}</textarea></label>
      <div class="season-footer"><strong>${league.emoji} ${esc(league.teamName)}</strong><span>${esc(league.waiverLabel || "")}${s.updated ? ` · Saved ${new Date(s.updated).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}` : ""}</span></div>`;

    const save = () => {
      const next = {
        week:document.getElementById("seasonWeek")?.value || "",
        wins:Number(document.getElementById("seasonWins")?.value || 0),
        losses:Number(document.getElementById("seasonLosses")?.value || 0),
        ties:Number(document.getElementById("seasonTies")?.value || 0),
        waiver:document.getElementById("seasonWaiver")?.value || "",
        notes:document.getElementById("seasonNotes")?.value || "",
        updated:s.updated
      };
      write(next);
      const footer = root.querySelector(".season-footer span");
      if (footer) footer.textContent = `${league.waiverLabel || ""} · Saved just now`;
    };
    root.querySelectorAll("input,textarea").forEach(el => el.addEventListener("change", save));
  }

  const style = document.createElement("style");
  style.textContent = `
    .season-hq-card{margin-bottom:12px}.season-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.season-grid label,.season-notes-label{font-size:8px;font-weight:950;letter-spacing:.08em;color:var(--muted)}
    .season-grid input{margin-top:5px}.season-notes-label{display:block;margin-top:9px}.season-notes-label textarea{width:100%;margin-top:5px;border-radius:12px;border:1px solid #3c675a;background:#fbf6ea;color:var(--ink);padding:10px;font:inherit;font-size:13px;resize:vertical}
    .season-footer{display:flex;justify-content:space-between;gap:10px;margin-top:8px;font-size:9px;color:var(--muted)}.season-footer strong{color:var(--text)}
    @media(max-width:760px){.season-grid{grid-template-columns:repeat(2,1fr)}.season-grid label:last-child{grid-column:1/-1}.season-footer{display:block}.season-footer span{display:block;margin-top:3px}}
  `;
  document.head.appendChild(style);
  render();
})();
