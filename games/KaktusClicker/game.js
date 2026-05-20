import {
  fetchLeaderboard,
  getGameSession,
  loadCloudSave,
  pickNewerSave,
  pushCloudSave,
} from "/js/game-cloud.js";

const STORAGE_KEY = "kaktus-clicker-save-v1";

const buildings = [
  {
    id: "seedling",
    name: "Mini-Kaktus",
    icon: "K",
    baseCost: 15,
    cps: 0.1,
    description: "Ein kleiner Topf, der langsam nachlegt."
  },
  {
    id: "greenhouse",
    name: "Gewächshaus",
    icon: "G",
    baseCost: 100,
    cps: 1,
    description: "Sammelt Sonnenlicht für saftige Ernten."
  },
  {
    id: "ranch",
    name: "Kaktus-Ranch",
    icon: "R",
    baseCost: 1100,
    cps: 8,
    description: "Reihenweise Stacheln, ordentlich bewacht."
  },
  {
    id: "oasis",
    name: "Oasenpumpe",
    icon: "O",
    baseCost: 12000,
    cps: 47,
    description: "Macht aus trockenem Boden grünes Gold."
  },
  {
    id: "factory",
    name: "Stachelwerk",
    icon: "F",
    baseCost: 130000,
    cps: 260,
    description: "Industrielle Kaktusvermehrung mit Rhythmus."
  }
];

const upgrades = [
  {
    id: "gloves",
    name: "Dicke Handschuhe",
    icon: "H",
    cost: 50,
    description: "Klicks geben doppelt so viel.",
    clickMultiplier: 2,
    productionMultiplier: 1
  },
  {
    id: "watering-can",
    name: "Goldene Giesskanne",
    icon: "W",
    cost: 500,
    description: "Alle Gebäude produzieren 25% mehr.",
    clickMultiplier: 1,
    productionMultiplier: 1.25
  },
  {
    id: "sun-map",
    name: "Sonnenkarte",
    icon: "M",
    cost: 5000,
    description: "Klicks werden nochmal doppelt so stark.",
    clickMultiplier: 2,
    productionMultiplier: 1
  },
  {
    id: "desert-union",
    name: "Wüstenverband",
    icon: "V",
    cost: 50000,
    description: "Alle Gebäude produzieren 50% mehr.",
    clickMultiplier: 1,
    productionMultiplier: 1.5
  }
];

const achievements = [
  { id: "first-click", name: "Erster Stich", test: (state) => state.totalClicks >= 1 },
  { id: "hundred", name: "Kleiner Garten", test: (state) => state.totalEarned >= 100 },
  { id: "thousand", name: "Grüne Welle", test: (state) => state.totalEarned >= 1000 },
  { id: "builder", name: "Wüstenbau", test: (state) => totalBuildings(state) >= 10 },
  { id: "collector", name: "Stachelbaron", test: (state) => state.totalEarned >= 100000 }
];

const initialState = {
  cactus: 0,
  totalEarned: 0,
  totalClicks: 0,
  buildings: Object.fromEntries(buildings.map((building) => [building.id, 0])),
  upgrades: [],
  achievements: [],
  lastSavedAt: Date.now()
};

let state = structuredClone(initialState);
let lastTick = performance.now();
let lastProductionRender = 0;
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
  leaderboardHint: document.querySelector("#leaderboard-hint")
};

function loadLocalState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return structuredClone(initialState);
  }

  try {
    const parsed = JSON.parse(saved);
    return normalizeLoadedState(parsed);
  } catch {
    return structuredClone(initialState);
  }
}

function getIdleSaveLabel() {
  return cloudSync.enabled ? "Cloud aktiv" : "Lokal · Login für Cloud";
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  elements.saveStatus.textContent = label;
  scheduleCloudSave();
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

async function renderLeaderboard(force = false) {
  if (!elements.leaderboardList) {
    return;
  }

  if (leaderboardLoaded && !force) {
    return;
  }

  elements.leaderboardList.innerHTML = `<p class="item-description">Rangliste wird geladen…</p>`;

  const { entries, error } = await fetchLeaderboard(30);

  if (error) {
    elements.leaderboardList.innerHTML = `<p class="item-description">${escapeHtml(error.message)}</p>`;
    return;
  }

  leaderboardLoaded = true;

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
    elements.leaderboardHint.textContent = "Sortiert nach gesamt geernteten Kakteen. Benutzername aus dem Profil hat Vorrang.";
  }
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
  const { productionMultiplier } = getUpgradeMultipliers();
  return buildings.reduce((sum, building) => {
    return sum + state.buildings[building.id] * building.cps * productionMultiplier;
  }, 0);
}

function getUpgradeMultipliers() {
  return state.upgrades.reduce((multipliers, upgradeId) => {
    const upgrade = upgrades.find((item) => item.id === upgradeId);
    if (!upgrade) {
      return multipliers;
    }

    return {
      clickMultiplier: multipliers.clickMultiplier * upgrade.clickMultiplier,
      productionMultiplier: multipliers.productionMultiplier * upgrade.productionMultiplier
    };
  }, { clickMultiplier: 1, productionMultiplier: 1 });
}

function totalBuildings(currentState) {
  return Object.values(currentState.buildings).reduce((sum, amount) => sum + amount, 0);
}

function addCactus(amount) {
  state.cactus += amount;
  state.totalEarned += amount;
}

function clickCactus(event) {
  const earned = getClickPower();
  addCactus(earned);
  state.totalClicks += 1;
  spawnFloat(event.clientX, event.clientY, `+${formatNumber(earned)}`);
  elements.cactusButton.classList.remove("is-popping");
  void elements.cactusButton.offsetWidth;
  elements.cactusButton.classList.add("is-popping");
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
  const { productionMultiplier } = getUpgradeMultipliers();
  elements.buildingList.innerHTML = buildings.map((building) => {
    const cost = getBuildingCost(building);
    const owned = state.buildings[building.id];
    const disabled = state.cactus < cost ? "disabled" : "";
    return `
      <button class="shop-item" type="button" data-building="${building.id}" ${disabled}>
        <span class="item-icon" aria-hidden="true">${building.icon}</span>
        <span>
          <span class="item-name">${building.name}</span>
          <span class="item-description">${building.description}</span>
          <span class="item-meta">${formatNumber(building.cps * productionMultiplier)}/Sek. - Besitz: ${owned}</span>
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
    : `<p class="item-description">Alle Upgrades gekauft. Das Terminal leuchtet zufrieden.</p>`;
}

function renderAchievements() {
  elements.achievementList.innerHTML = achievements.map((achievement) => {
    const unlocked = state.achievements.includes(achievement.id);
    return `
      <div class="achievement ${unlocked ? "is-unlocked" : ""}">
        <span>${achievement.name}</span>
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

function tick(now) {
  const deltaSeconds = (now - lastTick) / 1000;
  lastTick = now;
  const production = getCps() * deltaSeconds;

  if (production > 0) {
    addCactus(production);
    updateAchievements();
    if (now - lastProductionRender > 250) {
  lastProductionRender = now;
  renderStatsOnly();
    }
  }

  requestAnimationFrame(tick);
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
  window.addEventListener("beforeunload", () => saveState("Gespeichert"));
}

async function initGame() {
  const localState = loadLocalState();
  const session = await getGameSession();

  if (session?.user) {
    cloudSync.enabled = true;
    cloudSync.user = session.user;
    const cloud = await loadCloudSave(session.user);
    state = normalizeLoadedState(pickNewerSave(localState, cloud?.state));

    const localTime = Number(localState.lastSavedAt) || 0;
    const cloudTime = Number(cloud?.state?.lastSavedAt) || 0;
    if (!cloud || localTime >= cloudTime) {
      scheduleCloudSave();
    }
  } else {
    state = localState;
  }

  bindEvents();
  updateAchievements();
  render();
  elements.saveStatus.textContent = getIdleSaveLabel();
  requestAnimationFrame(tick);
}

function normalizeLoadedState(loaded) {
  const parsed = {
    ...structuredClone(initialState),
    ...loaded,
    buildings: { ...initialState.buildings, ...loaded.buildings },
    upgrades: Array.isArray(loaded.upgrades) ? loaded.upgrades : [],
    achievements: Array.isArray(loaded.achievements) ? loaded.achievements : []
  };

  parsed.cactus = Number(parsed.cactus) || 0;
  parsed.totalEarned = Number(parsed.totalEarned) || 0;
  parsed.totalClicks = Number(parsed.totalClicks) || 0;
  parsed.lastSavedAt = Number(parsed.lastSavedAt) || Date.now();

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
