(() => {
  const topFive = document.getElementById("topFive");
  if (!topFive) return;

  function findMineButton(name) {
    const buttons = document.querySelectorAll("#playerBoard [data-mine]");
    for (const btn of buttons) {
      try {
        if (decodeURIComponent(btn.dataset.mine || "") === name) return btn;
      } catch {}
    }
    return null;
  }

  function clickDraft(name, trigger) {
    if (!name || trigger.disabled) return;
    trigger.disabled = true;

    const search = document.getElementById("searchInput");
    const activeFilter = document.querySelector("#positionFilters button.active");
    const allFilter = document.querySelector('#positionFilters button[data-pos="ALL"]');
    const oldQuery = search ? search.value : "";
    const oldPos = activeFilter ? activeFilter.dataset.pos : "ALL";

    if (search && search.value) {
      search.value = "";
      search.dispatchEvent(new Event("input", {bubbles:true}));
    }
    if (allFilter && oldPos !== "ALL") allFilter.click();

    requestAnimationFrame(() => {
      const target = findMineButton(name);
      if (!target) {
        trigger.disabled = false;
        alert(`Scout couldn't locate ${name} on the available-player board. No pick was changed.`);
        return;
      }

      target.click();

      setTimeout(() => {
        if (search && oldQuery) {
          search.value = oldQuery;
          search.dispatchEvent(new Event("input", {bubbles:true}));
        }
        if (oldPos && oldPos !== "ALL") {
          const restore = document.querySelector(`#positionFilters button[data-pos="${oldPos}"]`);
          if (restore) restore.click();
        }
      }, 0);
    });
  }

  function addButtons() {
    topFive.querySelectorAll(".pick-card").forEach(card => {
      if (card.querySelector(".top5-draft-btn")) return;
      const name = card.querySelector(".pick-name")?.textContent?.trim();
      if (!name) return;

      const right = card.lastElementChild;
      if (!right) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "top5-draft-btn";
      btn.textContent = "DRAFT PLAYER";
      btn.setAttribute("aria-label", `Draft ${name} to my team`);
      btn.addEventListener("click", e => {
        e.preventDefault();
        e.stopPropagation();
        clickDraft(name, btn);
      });
      right.appendChild(btn);
    });
  }

  const observer = new MutationObserver(() => addButtons());
  observer.observe(topFive, {childList:true, subtree:true});
  addButtons();
})();
