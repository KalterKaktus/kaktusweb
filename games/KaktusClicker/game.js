import {
  fetchLeaderboard,
  getGameSession,
  getGameProfile,
  getWeeklyLeaderboardPeriod,
  loadCloudSave,
  pushCloudSave,
  signOutGameSession,
} from "/js/game-cloud.js";

const STORAGE_KEY = "kaktus-clicker-save-v1";

const buildings = [
  {
    id: "seedling",
    name: "Mini-Kaktus",
    icon: "K",
    baseCost: 15,
    cps: 0.1,
    description: "Kleine Produktion für den Anfang."
  },
  {
    id: "greenhouse",
    name: "Gewächshaus",
    icon: "G",
    baseCost: 100,
    cps: 1,
    description: "Mehr Kakteen aus kontrolliertem Anbau."
  },
  {
    id: "ranch",
    name: "Kaktus-Ranch",
    icon: "R",
    baseCost: 1100,
    cps: 8,
    description: "Reihenweise Kakteen für den nächsten Schub."
  },
  {
    id: "oasis",
    name: "Oasenpumpe",
    icon: "O",
    baseCost: 12000,
    cps: 47,
    description: "Stabile Ernte auch im trockenen Boden."
  },
  {
    id: "factory",
    name: "Stachelwerk",
    icon: "F",
    baseCost: 130000,
    cps: 260,
    description: "Industrielle Produktion für große Zahlen."
  },
  {
    id: "harvest-drone",
    name: "Erntedrohne",
    icon: "D",
    baseCost: 1400000,
    cps: 1400,
    description: "Automatisiert die schnelle Ernte."
  },
  {
    id: "lab",
    name: "Kaktuslabor",
    icon: "L",
    baseCost: 20000000,
    cps: 7800,
    description: "Züchtet stärkere Produktionslinien."
  },
  {
    id: "server-farm",
    name: "Wüstenserver",
    icon: "S",
    baseCost: 330000000,
    cps: 44000,
    description: "Optimiert jeden Produktionszyklus."
  },
  {
    id: "orbital-greenhouse",
    name: "Orbit-Gewächshaus",
    icon: "O",
    baseCost: 5100000000,
    cps: 260000,
    description: "Kakteenproduktion ohne Tageslimit."
  }
];

const upgrades = [
  {
    id: "gloves",
    name: "Dicke Handschuhe",
    icon: "H",
    cost: 100,
    description: "Klick-Ertrag x2.",
    clickMultiplier: 2
  },
  {
    id: "soft-gloves",
    name: "Weiche Handschuhe",
    icon: "W",
    cost: 500,
    description: "Klick-Ertrag x2.",
    clickMultiplier: 2
  },
  {
    id: "sun-map",
    name: "Doppelte Zange",
    icon: "Z",
    cost: 10000,
    description: "Klick-Ertrag x2.",
    clickMultiplier: 2
  },
  {
    id: "seedling-pots",
    name: "Stabile Töpfe",
    icon: "K",
    cost: 100,
    description: "Mini-Kaktus Produktion x2.",
    buildingId: "seedling",
    buildingMultiplier: 2
  },
  {
    id: "greenhouse-glass",
    name: "Klares Glas",
    icon: "G",
    cost: 1000,
    description: "Gewächshaus Produktion x2.",
    buildingId: "greenhouse",
    buildingMultiplier: 2
  },
  {
    id: "ranch-irrigation",
    name: "Ranch-Bewässerung",
    icon: "R",
    cost: 11000,
    description: "Kaktus-Ranch Produktion x2.",
    buildingId: "ranch",
    buildingMultiplier: 2
  },
  {
    id: "oasis-pressure",
    name: "Hochdruckpumpe",
    icon: "O",
    cost: 120000,
    description: "Oasenpumpe Produktion x2.",
    buildingId: "oasis",
    buildingMultiplier: 2
  },
  {
    id: "factory-lines",
    name: "Doppelschicht",
    icon: "F",
    cost: 1300000,
    description: "Stachelwerk Produktion x2.",
    buildingId: "factory",
    buildingMultiplier: 2
  },
  {
    id: "drone-bay",
    name: "Drohnenhangar",
    icon: "D",
    cost: 14000000,
    description: "Erntedrohne Produktion x2.",
    buildingId: "harvest-drone",
    buildingMultiplier: 2
  },
  {
    id: "lab-culture",
    name: "Schnellkultur",
    icon: "L",
    cost: 200000000,
    description: "Kaktuslabor Produktion x2.",
    buildingId: "lab",
    buildingMultiplier: 2
  },
  {
    id: "server-cluster",
    name: "Servercluster",
    icon: "S",
    cost: 3300000000,
    description: "Wüstenserver Produktion x2.",
    buildingId: "server-farm",
    buildingMultiplier: 2
  },
  {
    id: "orbital-cycle",
    name: "Orbit-Zyklus",
    icon: "O",
    cost: 51000000000,
    description: "Orbit-Gewächshaus Produktion x2.",
    buildingId: "orbital-greenhouse",
    buildingMultiplier: 2
  }
];

const achievements = [
  { id: "first-click", name: "Erster Stich", goal: "Ernte deinen ersten Kaktus.", test: (state) => state.totalClicks >= 1 },
  { id: "hundred-clicks", name: "Klickroutine", goal: "Klicke 100 Mal auf den Kaktus.", test: (state) => state.totalClicks >= 100 },
  { id: "thousand-clicks", name: "Hornhaut", goal: "Klicke 1.000 Mal auf den Kaktus.", test: (state) => state.totalClicks >= 1000 },
  { id: "hundred", name: "Kleiner Garten", goal: "Sammle insgesamt 100 Kakteen.", test: (state) => state.totalEarned >= 100 },
  { id: "thousand", name: "Grüne Welle", goal: "Sammle insgesamt 1.000 Kakteen.", test: (state) => state.totalEarned >= 1000 },
  { id: "ten-thousand", name: "Stachelvorrat", goal: "Sammle insgesamt 10.000 Kakteen.", test: (state) => state.totalEarned >= 10000 },
  { id: "builder", name: "Wüstenbau", goal: "Kaufe 10 Gebäude.", test: (state) => totalBuildings(state) >= 10 },
  { id: "production-crew", name: "Produktionscrew", goal: "Kaufe 50 Gebäude.", test: (state) => totalBuildings(state) >= 50 },
  { id: "first-upgrade", name: "Besser ernten", goal: "Kaufe dein erstes Upgrade.", test: (state) => state.upgrades.length >= 1 },
  { id: "upgrade-stack", name: "Upgrade-Stapel", goal: "Kaufe 5 Upgrades.", test: (state) => state.upgrades.length >= 5 },
  { id: "collector", name: "Stachelbaron", goal: "Sammle insgesamt 100.000 Kakteen.", test: (state) => state.totalEarned >= 100000 },
  { id: "million", name: "Millionenernte", goal: "Sammle insgesamt 1 Mio. Kakteen.", test: (state) => state.totalEarned >= 1000000 },
  { id: "ten-million", name: "Wüstenmaschine", goal: "Sammle insgesamt 10 Mio. Kakteen.", test: (state) => state.totalEarned >= 10000000 },
  { id: "hundred-million", name: "Kaktusmogul", goal: "Sammle insgesamt 100 Mio. Kakteen.", test: (state) => state.totalEarned >= 100000000 },
  { id: "billion", name: "Orbit-Ernte", goal: "Sammle insgesamt 1 Mrd. Kakteen.", test: (state) => state.totalEarned >= 1000000000 }
];

const initialState = {
  cactus: 0,
  totalEarned: 0,
  totalClicks: 0,
  buildings: Object.fromEntries(buildings.map((building) => [building.id, 0])),
  upgrades: [],
  achievements: [],
  weeklyLeaderboard: createWeeklyLeaderboard(),
  lastSavedAt: Date.now()
};

let state = structuredClone(initialState);
let cloudSync = { enabled: false, user: null };
let cloudSaveTimer = null;
let leaderboardLoaded = false;

const elements = {
  cactusCount: document.querySelector("#cactus-count"),
  cactusRate: document.querySelector("#cactus-rate"),
  clickPower: document.querySelector("#click-power"),
  cactusButton: document.querySelector("#cactus-button"),
  buildingList: document.querySelector("#building-list"),
  upgradeList: document.querySelector("#upgrade-list"),
  totalEarned: document.querySelector("#total-earned"),
  totalClicks: document.querySelector("#total-clicks"),
  totalBuildings: document.querySelector("#total-buildings"),
  totalUpgrades: document.querySelector("#total-upgrades"),
  achievementList: document.querySelector("#achievement-list"),
  saveStatus: document.querySelector("#save-status"),
  saveButton: document.querySelector("#save-button"),
  resetButton: document.querySelector("#reset-button"),
  tabs: document.querySelectorAll(".tab"),
  panels: document.querySelectorAll(".tab-panel"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  leaderboardHint: document.querySelector("#leaderboard-hint"),
  leaderboardReset: document.querySelector("#leaderboard-reset"),
  leaderboardLastWinner: document.querySelector("#leaderboard-last-winner")
};

function createWeeklyLeaderboard() {
  return {
    periodId: getWeeklyLeaderboardPeriod().id,
    score: 0
  };
}

function ensureWeeklyLeaderboard(currentState = state) {
  const period = getWeeklyLeaderboardPeriod();
  const weekly = currentState.weeklyLeaderboard;

  if (weekly?.periodId !== period.id) {
    if (weekly?.periodId && weekly.score > 0) {
      currentState.previousWeeklyLeaderboard = {
        periodId: weekly.periodId,
        score: Number(weekly.score) || 0
      };
    }

    currentState.weeklyLeaderboard = {
      periodId: period.id,
      score: 0
    };
    leaderboardLoaded = false;
  }

  currentState.weeklyLeaderboard.score = Math.max(0, Number(currentState.weeklyLeaderboard.score) || 0);
  return period;
}

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    const parsed = JSON.parse(saved);
    return normalizeLoadedState(parsed);
  } catch {
    return null;
  }
}

function getIdleSaveLabel() {
  return cloudSync.enabled ? "Speicherstatus: Cloud aktiv" : "Speicherstatus: Lokal gespeichert";
}

function scheduleCloudSave() {
  if (!cloudSync.enabled || !cloudSync.user) {
    return;
  }

  window.clearTimeout(cloudSaveTimer);
  cloudSaveTimer = window.setTimeout(async () => {
    const result = await pushCloudSave(cloudSync.user, state);
    if (result?.error) {
      elements.saveStatus.textContent = "Cloud-Fehler";
      return;
    }

    elements.saveStatus.textContent = "Cloud gespeichert";
    window.setTimeout(() => {
      elements.saveStatus.textContent = getIdleSaveLabel();
    }, 1300);
  }, 900);
}

function saveState(label = "Gespeichert") {
  state.lastSavedAt = Date.now();
  elements.saveStatus.textContent = label;

  if (cloudSync.enabled) {
    scheduleCloudSave();
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  window.setTimeout(() => {
    if (elements.saveStatus.textContent === label) {
      elements.saveStatus.textContent = getIdleSaveLabel();
    }
  }, 1300);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showGameModal(title, message, buttonLabel = "Okay") {
  const existing = document.querySelector(".game-modal-backdrop");
  existing?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "game-modal-backdrop";
  backdrop.innerHTML = `
    <section class="game-modal" role="dialog" aria-modal="true" aria-labelledby="game-modal-title">
      <h2 id="game-modal-title">${escapeHtml(title)}</h2>
      <p>${escapeHtml(message)}</p>
      <button class="icon-button game-modal-button" type="button">${escapeHtml(buttonLabel)}</button>
    </section>
  `;

  backdrop.querySelector("button")?.addEventListener("click", () => backdrop.remove());
  document.body.append(backdrop);
}

async function renderLeaderboard(force = false) {
  if (!elements.leaderboardList) {
    return;
  }

  if (leaderboardLoaded && !force) {
    return;
  }

  elements.leaderboardList.innerHTML = `<p class="item-description">Rangliste wird geladen…</p>`;

  if (elements.leaderboardLastWinner) {
    elements.leaderboardLastWinner.textContent = "Top-Spieler der letzten Woche wird geladen...";
  }

  const { entries, previousWinner, error } = await fetchLeaderboard(30);

  if (error) {
    elements.leaderboardList.innerHTML = `<p class="item-description">${escapeHtml(error.message)}</p>`;
    if (elements.leaderboardLastWinner) {
      elements.leaderboardLastWinner.textContent = "Top-Spieler der letzten Woche gerade nicht verfügbar.";
    }
    return;
  }

  leaderboardLoaded = true;
  renderPreviousWinner(previousWinner);

  if (!entries.length) {
    elements.leaderboardList.innerHTML = `<p class="item-description">Noch keine Einträge. Sei der Erste.</p>`;
    if (elements.leaderboardHint) {
      elements.leaderboardHint.textContent = cloudSync.enabled
        ? "Tipp: Lege unter Profil einen Benutzernamen fest — der erscheint in der Rangliste."
        : "Melde dich an, um deinen Score zu speichern und in der Rangliste zu erscheinen.";
    }
    return;
  }

  elements.leaderboardList.innerHTML = entries.map((entry) => `
    <div class="leaderboard-row ${entry.rank <= 3 ? "is-top" : ""}">
      <span class="leaderboard-rank">#${entry.rank}</span>
      <span class="leaderboard-name">${escapeHtml(entry.name)}</span>
      <span class="leaderboard-score">${escapeHtml(formatNumber(entry.totalEarned))}</span>
    </div>
  `).join("");

  if (elements.leaderboardHint) {
    elements.leaderboardHint.textContent = "Sortiert nach Kakteen, die in der laufenden Woche geerntet wurden.";
  }
}

function renderPreviousWinner(previousWinner) {
  if (!elements.leaderboardLastWinner) {
    return;
  }

  elements.leaderboardLastWinner.innerHTML = previousWinner
    ? `Letzte Woche ganz oben: <strong>${escapeHtml(previousWinner.name)}</strong> mit ${escapeHtml(formatNumber(previousWinner.score))} Kakteen.`
    : "Top-Spieler der letzten Woche: Noch kein Ergebnis gespeichert.";
}

function formatNumber(value) {
  if (value >= 1000000) {
    return Intl.NumberFormat("de-DE", { maximumFractionDigits: 2, notation: "compact" }).format(value);
  }

  if (value >= 1000) {
    return Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(Math.floor(value));
  }

  return Intl.NumberFormat("de-DE", { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value);
}

function getBuildingCost(building) {
  return Math.ceil(building.baseCost * Math.pow(1.15, state.buildings[building.id]));
}

function getClickPower() {
  return getUpgradeMultipliers().clickMultiplier;
}

function getCps() {
  const { productionMultiplier, buildingMultipliers } = getUpgradeMultipliers();
  return buildings.reduce((sum, building) => {
    const buildingMultiplier = buildingMultipliers[building.id] || 1;
    return sum + state.buildings[building.id] * building.cps * buildingMultiplier * productionMultiplier;
  }, 0);
}

function getUpgradeMultipliers() {
  return state.upgrades.reduce((multipliers, upgradeId) => {
    const upgrade = upgrades.find((item) => item.id === upgradeId);
    if (!upgrade) {
      return multipliers;
    }

    if (upgrade.buildingId) {
      multipliers.buildingMultipliers[upgrade.buildingId] =
        (multipliers.buildingMultipliers[upgrade.buildingId] || 1) * (upgrade.buildingMultiplier || 1);
    }

    multipliers.clickMultiplier *= upgrade.clickMultiplier || 1;
    multipliers.productionMultiplier *= upgrade.productionMultiplier || 1;
    return multipliers;
  }, { clickMultiplier: 1, productionMultiplier: 1, buildingMultipliers: {} });
}

function totalBuildings(currentState) {
  return Object.values(currentState.buildings).reduce((sum, amount) => sum + amount, 0);
}

function addCactus(amount) {
  ensureWeeklyLeaderboard();
  state.cactus += amount;
  state.totalEarned += amount;
  state.weeklyLeaderboard.score += amount;
}

function formatLeaderboardCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}T ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

function updateLeaderboardResetCountdown() {
  if (!elements.leaderboardReset) {
    return;
  }

  const previousPeriodId = state.weeklyLeaderboard?.periodId;
  const period = ensureWeeklyLeaderboard();
  elements.leaderboardReset.textContent =
    `Reset Sonntag 23:00 · noch ${formatLeaderboardCountdown(period.nextResetAt.getTime() - Date.now())}`;

  if (previousPeriodId && previousPeriodId !== period.id) {
    saveState("Wochenrangliste resettet");
    if (document.querySelector("#leaderboard-panel")?.classList.contains("is-active")) {
      renderLeaderboard(true);
    }
  }
}

function clickCactus(event) {
  const earned = getClickPower();
  addCactus(earned);
  state.totalClicks += 1;
  spawnFloat(event.clientX, event.clientY, `+${formatNumber(earned)}`);
  updateAchievements();
  render();
}

function spawnFloat(x, y, text) {
  const pop = document.createElement("span");
  pop.className = "float-pop";
  pop.textContent = text;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.append(pop);
  pop.addEventListener("animationend", () => pop.remove(), { once: true });
}

function buyBuilding(id) {
  const building = buildings.find((item) => item.id === id);
  const cost = getBuildingCost(building);
  if (state.cactus < cost) {
    return;
  }

  state.cactus -= cost;
  state.buildings[id] += 1;
  updateAchievements();
  render();
}

function buyUpgrade(id) {
  const upgrade = upgrades.find((item) => item.id === id);
  if (!upgrade || state.upgrades.includes(id) || state.cactus < upgrade.cost) {
    return;
  }

  state.cactus -= upgrade.cost;
  state.upgrades.push(id);
  updateAchievements();
  render();
}

function updateAchievements() {
  for (const achievement of achievements) {
    if (!state.achievements.includes(achievement.id) && achievement.test(state)) {
      state.achievements.push(achievement.id);
      elements.saveStatus.textContent = `Abzeichen: ${achievement.name}`;
    }
  }
}

function renderShop() {
  const { productionMultiplier, buildingMultipliers } = getUpgradeMultipliers();
  elements.buildingList.innerHTML = buildings.map((building) => {
    const cost = getBuildingCost(building);
    const owned = state.buildings[building.id];
    const buildingCps = building.cps * (buildingMultipliers[building.id] || 1) * productionMultiplier;
    const disabled = state.cactus < cost ? "disabled" : "";
    return `
      <button class="shop-item" type="button" data-building="${building.id}" ${disabled}>
        <span class="item-icon" aria-hidden="true">${building.icon}</span>
        <span>
          <span class="item-name">${building.name}</span>
          <span class="item-description">${building.description}</span>
          <span class="item-meta">${formatNumber(buildingCps)}/Sek. - Besitz: ${owned}</span>
        </span>
        <span class="item-price">${formatNumber(cost)}</span>
      </button>
    `;
  }).join("");
}

function renderUpgrades() {
  const visibleUpgrades = upgrades.filter((upgrade) => !state.upgrades.includes(upgrade.id));

  elements.upgradeList.innerHTML = visibleUpgrades.length
    ? visibleUpgrades.map((upgrade) => {
      const disabled = state.cactus < upgrade.cost ? "disabled" : "";
      return `
        <button class="shop-item" type="button" data-upgrade="${upgrade.id}" ${disabled}>
          <span class="item-icon" aria-hidden="true">${upgrade.icon}</span>
          <span>
            <span class="item-name">${upgrade.name}</span>
            <span class="item-description">${upgrade.description}</span>
          </span>
          <span class="item-price">${formatNumber(upgrade.cost)}</span>
        </button>
      `;
    }).join("")
    : `<p class="item-description">Alle Upgrades gekauft. Deine Produktion läuft auf Anschlag.</p>`;
}

function renderAchievements() {
  elements.achievementList.innerHTML = achievements.map((achievement) => {
    const unlocked = state.achievements.includes(achievement.id);
    return `
      <div class="achievement ${unlocked ? "is-unlocked" : ""}">
        <span class="achievement-copy">
          <strong>${achievement.name}</strong>
          <small>${achievement.goal}</small>
        </span>
        <span>${unlocked ? "Freigeschaltet" : "Offen"}</span>
      </div>
    `;
  }).join("");
}

function renderStatsOnly() {
  elements.cactusCount.textContent = formatNumber(state.cactus);
  elements.cactusRate.textContent = formatNumber(getCps());
  elements.clickPower.textContent = formatNumber(getClickPower());
  elements.totalEarned.textContent = formatNumber(state.totalEarned);
  elements.totalClicks.textContent = formatNumber(state.totalClicks);
  elements.totalBuildings.textContent = formatNumber(totalBuildings(state));
  elements.totalUpgrades.textContent = formatNumber(state.upgrades.length);
}

function render() {
  renderStatsOnly();
  renderShop();
  renderUpgrades();
  renderAchievements();
}

function payProductionSecond() {
  const production = getCps();

  if (production > 0) {
    addCactus(production);
    updateAchievements();
    render();
  }
}

function bindEvents() {
  elements.cactusButton.addEventListener("click", clickCactus);
  elements.saveButton.addEventListener("click", () => saveState("Manuell gespeichert"));

  elements.buildingList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-building]");
    if (button) {
      buyBuilding(button.dataset.building);
    }
  });

  elements.upgradeList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-upgrade]");
    if (button) {
      buyUpgrade(button.dataset.upgrade);
    }
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      elements.tabs.forEach((item) => item.classList.toggle("is-active", item === tab));
      elements.panels.forEach((panel) => {
        panel.classList.toggle("is-active", panel.id === `${tab.dataset.tab}-panel`);
      });

      if (tab.dataset.tab === "leaderboard") {
        renderLeaderboard(true);
      }
    });
  });

  elements.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm("Willst du deinen KaktusClicker-Spielstand wirklich löschen?");
    if (!confirmed) {
      return;
    }

    state = structuredClone(initialState);
    saveState("Zurückgesetzt");
    render();
    leaderboardLoaded = false;
  });

  window.setInterval(() => saveState("Automatisch gespeichert"), 15000);
  window.setInterval(payProductionSecond, 1000);
  window.setInterval(updateLeaderboardResetCountdown, 1000);
  window.addEventListener("kk-admin-reload", () => {
    window.clearTimeout(cloudSaveTimer);
    cloudSync = { enabled: false, user: null };
  });
  window.addEventListener("beforeunload", () => saveState("Gespeichert"));
}

async function initGame() {
  const session = await getGameSession();

  if (session?.user) {
    cloudSync.enabled = true;
    cloudSync.user = session.user;
    const profile = await getGameProfile(session.user);
    if (profile?.is_banned) {
      await signOutGameSession();
      showGameModal("Account gesperrt", "Dein Account wurde gesperrt.");
      elements.saveStatus.textContent = "Account gesperrt";
      return;
    }

    const cloud = await loadCloudSave(session.user);
    state = cloud?.state
      ? normalizeLoadedState(cloud.state)
      : structuredClone(initialState);
    scheduleCloudSave();
  } else {
    state = loadLocalState() || structuredClone(initialState);
  }

  bindEvents();
  ensureWeeklyLeaderboard();
  updateAchievements();
  render();
  updateLeaderboardResetCountdown();
  elements.saveStatus.textContent = getIdleSaveLabel();
}

function normalizeLoadedState(loaded) {
  const parsed = {
    ...structuredClone(initialState),
    ...loaded,
    buildings: { ...initialState.buildings, ...loaded.buildings },
    upgrades: Array.isArray(loaded.upgrades) ? loaded.upgrades : [],
    achievements: Array.isArray(loaded.achievements) ? loaded.achievements : [],
    weeklyLeaderboard: {
      ...createWeeklyLeaderboard(),
      ...loaded.weeklyLeaderboard
    },
    previousWeeklyLeaderboard: loaded.previousWeeklyLeaderboard
  };

  parsed.cactus = Number(parsed.cactus) || 0;
  parsed.totalEarned = Number(parsed.totalEarned) || 0;
  parsed.totalClicks = Number(parsed.totalClicks) || 0;
  parsed.lastSavedAt = Number(parsed.lastSavedAt) || Date.now();
  ensureWeeklyLeaderboard(parsed);

  for (const building of buildings) {
    parsed.buildings[building.id] = Math.max(0, Math.floor(Number(parsed.buildings[building.id]) || 0));
  }

  parsed.upgrades = parsed.upgrades.filter((id, index, list) => {
    return upgrades.some((upgrade) => upgrade.id === id) && list.indexOf(id) === index;
  });
  parsed.achievements = parsed.achievements.filter((id, index, list) => {
    return achievements.some((achievement) => achievement.id === id) && list.indexOf(id) === index;
  });

  return parsed;
}

initGame();
