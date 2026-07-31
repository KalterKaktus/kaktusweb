// Economy V3 (August 2026): Kosten sind unverändert, die CPS späterer Gebäude
// wurden massiv angehoben. Ziel-Amortisation ≈ 120 × 1,5^Index Sekunden —
// vorher explodierte sie exponentiell (Gebäude #30: 337 Jahre, niemand hat je
// mehr als 9 Gebäudetypen besessen). Frühe Gebäude behalten ihre alten Werte,
// wo die alte CPS über der neuen Kurve lag (kein Nerf im Early Game).
export const buildings = [
  { id: "seedling", name: "Mini-Kaktus", icon: "K", baseCost: 15, cps: 0.125, description: "Kleine Produktion für den Anfang." },
  { id: "greenhouse", name: "Gewächshaus", icon: "G", baseCost: 100, cps: 1, description: "Mehr Kakteen aus kontrolliertem Anbau." },
  { id: "ranch", name: "Kaktus-Ranch", icon: "R", baseCost: 1100, cps: 8, description: "Reihenweise Kakteen für den nächsten Schub." },
  { id: "oasis", name: "Oasenpumpe", icon: "O", baseCost: 12000, cps: 47, description: "Stabile Ernte auch im trockenen Boden." },
  { id: "factory", name: "Stachelwerk", icon: "F", baseCost: 130000, cps: 260, description: "Industrielle Produktion für große Zahlen." },
  { id: "harvest-drone", name: "Erntedrohne", icon: "D", baseCost: 1400000, cps: 1540, description: "Automatisiert die schnelle Ernte." },
  { id: "lab", name: "Kaktuslabor", icon: "L", baseCost: 20000000, cps: 14600, description: "Züchtet stärkere Produktionslinien." },
  { id: "server-farm", name: "Wüstenserver", icon: "S", baseCost: 330000000, cps: 161000, description: "Optimiert jeden Produktionszyklus." },
  { id: "orbital-greenhouse", name: "Orbit-Gewächshaus", icon: "O", baseCost: 5100000000, cps: 1.66e6, description: "Kakteenproduktion ohne Tageslimit." },
  { id: "monsoon-rig", name: "Monsun-Rig", icon: "M", baseCost: 75000000000, cps: 1.63e7, description: "Zieht Feuchtigkeit aus jedem Sturm." },
  { id: "canyon-refinery", name: "Canyon-Raffinerie", icon: "C", baseCost: 1000000000000, cps: 1.45e8, description: "Presst jeden Tropfen in Wachstum." },
  { id: "plasma-irrigation", name: "Plasma-Bewässerung", icon: "P", baseCost: 14000000000000, cps: 1.35e9, description: "Lädt Wurzeln mit Neonenergie." },
  { id: "lunar-nursery", name: "Mondgärtnerei", icon: "M", baseCost: 170000000000000, cps: 1.09e10, description: "Pflegt Kakteen unter kaltem Licht." },
  { id: "asteroid-hacienda", name: "Asteroiden-Hacienda", icon: "A", baseCost: 2100000000000000, cps: 8.99e10, description: "Erntet zwischen schwebenden Felsen." },
  { id: "solar-silo", name: "Solarsilo", icon: "S", baseCost: 26000000000000000, cps: 7.42e11, description: "Speichert Glut für endlose Ernten." },
  { id: "quantum-spine", name: "Quantenstachel", icon: "Q", baseCost: 310000000000000000, cps: 5.9e12, description: "Verdoppelt Ernten in Nebenpfaden." },
  { id: "nebula-pipeline", name: "Nebula-Pipeline", icon: "N", baseCost: 3700000000000000000, cps: 4.69e13, description: "Schickt Kaktussaft durch Sternennebel." },
  { id: "rift-garden", name: "Rissgarten", icon: "R", baseCost: 44000000000000000000, cps: 3.72e14, description: "Lässt Dornen aus Parallelräumen wachsen." },
  { id: "prism-foundry", name: "Prisma-Gießerei", icon: "P", baseCost: 520000000000000000000, cps: 2.93e15, description: "Gießt Licht in neue Pflanzenformen." },
  { id: "void-terrace", name: "Void-Terrasse", icon: "V", baseCost: 6200000000000000000000, cps: 2.33e16, description: "Blüht dort, wo sonst nichts lebt." },
  { id: "starloom", name: "Sternwebstuhl", icon: "S", baseCost: 74000000000000000000000, cps: 1.85e17, description: "Webt Ernteketten aus Sternenstaub." },
  { id: "thorn-reactor", name: "Dornenreaktor", icon: "D", baseCost: 890000000000000000000000, cps: 1.49e18, description: "Hält die Wüste dauerhaft kritisch." },
  { id: "chrono-orchard", name: "Chrono-Orchard", icon: "C", baseCost: 1.07e25, cps: 1.19e19, description: "Erntet mehrere Sekunden zugleich." },
  { id: "singularity-nursery", name: "Singularitätsgarten", icon: "S", baseCost: 1.28e26, cps: 9.5e19, description: "Zieht Wachstum in einen grünen Kern." },
  { id: "galaxy-vault", name: "Galaxie-Tresor", icon: "G", baseCost: 1.54e27, cps: 7.62e20, description: "Lagert Ernten über ganze Spiralen." },
  { id: "mythic-desert", name: "Mythische Wüste", icon: "M", baseCost: 1.85e28, cps: 6.11e21, description: "Macht Legenden zu Produktion." },
  { id: "cactus-matrix", name: "Kaktus-Matrix", icon: "X", baseCost: 2.22e29, cps: 4.88e22, description: "Berechnet Wachstum vor dem Klick." },
  { id: "nopal-ark", name: "Nopal-Arche", icon: "N", baseCost: 2.66e30, cps: 3.9e23, description: "Trägt Dornen durch jede Saison." },
  { id: "cosmic-root", name: "Kosmische Wurzel", icon: "K", baseCost: 3.19e31, cps: 3.12e24, description: "Verankert Ernte in tiefem Raum." },
  { id: "endless-bloom", name: "Endlosblüte", icon: "E", baseCost: 3.83e32, cps: 2.5e25, description: "Wächst weiter, wenn Zahlen verschwimmen." },
];

const legacyUpgrades = [
  { id: "gloves", name: "Dicke Handschuhe", icon: "H", cost: 100, description: "Klick-Ertrag x2.", clickMultiplier: 2 },
  { id: "soft-gloves", name: "Weiche Handschuhe", icon: "W", cost: 500, description: "Klick-Ertrag x2.", clickMultiplier: 2 },
  { id: "sun-map", name: "Doppelte Zange", icon: "Z", cost: 10000, description: "Klick-Ertrag x2.", clickMultiplier: 2 },
  { id: "seedling-pots", name: "Stabile Töpfe", icon: "K", cost: 100, description: "Mini-Kaktus Produktion x2.", buildingId: "seedling", buildingMultiplier: 2 },
  { id: "greenhouse-glass", name: "Klares Glas", icon: "G", cost: 1000, description: "Gewächshaus Produktion x2.", buildingId: "greenhouse", buildingMultiplier: 2 },
  { id: "ranch-irrigation", name: "Ranch-Bewässerung", icon: "R", cost: 11000, description: "Kaktus-Ranch Produktion x2.", buildingId: "ranch", buildingMultiplier: 2 },
  { id: "oasis-pressure", name: "Hochdruckpumpe", icon: "O", cost: 120000, description: "Oasenpumpe Produktion x2.", buildingId: "oasis", buildingMultiplier: 2 },
  { id: "factory-lines", name: "Doppelschicht", icon: "F", cost: 1300000, description: "Stachelwerk Produktion x2.", buildingId: "factory", buildingMultiplier: 2 },
  { id: "drone-bay", name: "Drohnenhangar", icon: "D", cost: 14000000, description: "Erntedrohne Produktion x2.", buildingId: "harvest-drone", buildingMultiplier: 2 },
  { id: "lab-culture", name: "Schnellkultur", icon: "L", cost: 200000000, description: "Kaktuslabor Produktion x2.", buildingId: "lab", buildingMultiplier: 2 },
  { id: "server-cluster", name: "Servercluster", icon: "S", cost: 3300000000, description: "Wüstenserver Produktion x2.", buildingId: "server-farm", buildingMultiplier: 2 },
  { id: "orbital-cycle", name: "Orbit-Zyklus", icon: "O", cost: 51000000000, description: "Orbit-Gewächshaus Produktion x2.", buildingId: "orbital-greenhouse", buildingMultiplier: 2 },
];

const newBuildingUpgrades = buildings.slice(9).map((building, index) => ({
  id: `${building.id}-core`,
  name: `${building.name} Kern`,
  icon: building.icon,
  cost: Math.ceil(building.baseCost * (9 + (index % 4))),
  description: `${building.name} Produktion x2.`,
  buildingId: building.id,
  buildingMultiplier: 2,
}));

// Economy V3: Gestaffelte Blüten-Upgrades nach Cookie-Clicker-Muster — jedes
// Gebäude bekommt bei 10/25/50/100 Besitz je ein weiteres x2. Sie erscheinen
// erst, wenn die Schwelle erreicht ist (unlockOwned, siehe renderUpgrades).
// Kosten ≈ 2,5× der Stückkosten an der Schwelle, damit sie beim Freischalten
// immer ein greifbares Sparziel sind. Namen laufen über i18n-Suffixe
// (clicker.upgrade_tier_N), der deutsche String hier ist der Fallback.
const TIER_STEPS = [
  { owned: 10, suffix: "Aufblüte" },
  { owned: 25, suffix: "Vollblüte" },
  { owned: 50, suffix: "Prachtblüte" },
  { owned: 100, suffix: "Wunderblüte" },
];

const tierUpgrades = buildings.flatMap((building) =>
  TIER_STEPS.map(({ owned, suffix }) => ({
    id: `${building.id}-t${owned}`,
    name: `${building.name} ${suffix}`,
    icon: building.icon,
    cost: Math.ceil(building.baseCost * Math.pow(1.15, owned) * 2.5),
    description: `${building.name} Produktion x2.`,
    buildingId: building.id,
    buildingMultiplier: 2,
    tier: owned,
    unlockOwned: owned,
  }))
);

// Klick-Sog: Klicks ernten zusätzlich einen Prozentsatz der Auto-Produktion
// (Basis 1 % in economy.js, diese Upgrades verdoppeln den Satz auf 2 % / 4 %).
const clickScalingUpgrades = [
  { id: "click-surge-1", name: "Klick-Sog", icon: "Z", cost: 1e8, description: "Klicks ernten doppelt so viel Auto-Produktion.", clickCpsMultiplier: 2 },
  { id: "click-surge-2", name: "Klick-Strudel", icon: "Z", cost: 1e12, description: "Klicks ernten nochmal doppelt so viel Auto-Produktion.", clickCpsMultiplier: 2 },
];

// Autoklicker: klicken automatisch, aber NUR solange wirklich gespielt wird
// (Tab sichtbar + Eingabe in den letzten Sekunden, siehe game.js). Zählen als
// Klick-Ertrag und laden den Goldlauf auf, erhöhen aber NICHT totalClicks —
// Klick-Abzeichen und Klick-XP bleiben Handarbeit.
const autoClickUpgrades = [
  { id: "autoclick-1", name: "Fleißige Ameisen", icon: "A", cost: 5e6, description: "+2 Auto-Klicks pro Sekunde beim aktiven Spielen.", autoClicksPerSecond: 2 },
  { id: "autoclick-2", name: "Kolibri-Schwarm", icon: "A", cost: 5e9, description: "+5 Auto-Klicks pro Sekunde beim aktiven Spielen.", autoClicksPerSecond: 5 },
  { id: "autoclick-3", name: "Sandsturm-Finger", icon: "A", cost: 5e13, description: "+13 Auto-Klicks pro Sekunde beim aktiven Spielen.", autoClicksPerSecond: 13 },
];

export const upgrades = [
  ...legacyUpgrades,
  ...newBuildingUpgrades,
  ...tierUpgrades,
  ...clickScalingUpgrades,
  ...autoClickUpgrades,
];

export const achievements = [
  { id: "first-click", name: "Erster Stich", goal: "Ernte deinen ersten Kaktus.", test: (state) => state.totalClicks >= 1 },
  { id: "hundred-clicks", name: "Klickroutine", goal: "Klicke 100 Mal manuell.", test: (state) => state.totalClicks >= 100 },
  { id: "thousand-clicks", name: "Goldfinger", goal: "Klicke 1.000 Mal manuell.", test: (state) => state.totalClicks >= 1000 },
  { id: "five-thousand-clicks", name: "Handarbeit", goal: "Klicke 5.000 Mal manuell.", test: (state) => state.totalClicks >= 5000 },
  { id: "twenty-five-thousand-clicks", name: "Dornenmaschine", goal: "Klicke 25.000 Mal manuell.", test: (state) => state.totalClicks >= 25000 },
  { id: "hundred-thousand-clicks", name: "Klicklegende", goal: "Klicke 100.000 Mal manuell.", test: (state) => state.totalClicks >= 100000 },
  { id: "hundred-earned", name: "Kleiner Garten", goal: "Ernte insgesamt 100 Kakteen.", test: (state) => state.totalEarned >= 100 },
  { id: "thousand-earned", name: "Grüne Welle", goal: "Ernte insgesamt 1.000 Kakteen.", test: (state) => state.totalEarned >= 1000 },
  { id: "million-earned", name: "Millionenernte", goal: "Ernte insgesamt 1 Mio. Kakteen.", test: (state) => state.totalEarned >= 1e6 },
  { id: "billion-earned", name: "Milliardenfeld", goal: "Ernte insgesamt 1 Mrd. Kakteen.", test: (state) => state.totalEarned >= 1e9 },
  { id: "trillion-earned", name: "Billionenblüte", goal: "Ernte insgesamt 1 Bio. Kakteen.", test: (state) => state.totalEarned >= 1e12 },
  { id: "quintillion-earned", name: "Trillionenwüste", goal: "Ernte insgesamt 1 Trio. Kakteen.", test: (state) => state.totalEarned >= 1e18 },
  { id: "quintilliarde-earned", name: "Quintillionengrün", goal: "Ernte insgesamt 1 Quinto. Kakteen.", test: (state) => state.totalEarned >= 1e30 },
  { id: "first-prestige", name: "Erste Nopal-Ernte", goal: "Führe dein erstes Prestige durch.", test: (state) => state.prestige.prestiges >= 1 },
  { id: "ten-nopal", name: "Nopal-Puffer", goal: "Sammle 10 Nopal in dieser Saison.", test: (state) => state.prestige.totalNopalEarned >= 10 },
  { id: "ten-prestiges", name: "Saisonschleife", goal: "Führe 10 Prestiges durch.", test: (state) => state.prestige.prestiges >= 10 },
  { id: "first-frenzy", name: "Goldener Lauf", goal: "Fülle den Klick-Balken einmal.", test: (state) => state.events.frenzies >= 1 },
  { id: "golden-hit", name: "Goldkaktus", goal: "Fange einen Goldkaktus.", test: (state) => state.events.goldenHits >= 1 },
  { id: "golden-hunter", name: "Goldjäger", goal: "Fange 10 Goldkakteen.", test: (state) => state.events.goldenHits >= 10 },
  { id: "red-hit", name: "Rubinkaktus", goal: "Fange einen Rubinkaktus.", test: (state) => state.events.redHits >= 1 },
  // Economy V3: neue Abzeichen für die neuen Systeme. Wie alle: je +0,1x.
  { id: "first-tier", name: "Erste Blüte", goal: "Kaufe ein Blüten-Upgrade.", test: (state) => state.upgrades.some((id) => id.includes("-t")) },
  { id: "hundred-of-one", name: "Monokultur", goal: "Besitze 100 Stück eines Gebäudes.", test: (state) => Object.values(state.buildings).some((n) => n >= 100) },
  { id: "five-hundred-buildings", name: "Wüstenstadt", goal: "Besitze insgesamt 500 Gebäude.", test: (state) => Object.values(state.buildings).reduce((s, n) => s + n, 0) >= 500 },
  { id: "quadrillion-earned", name: "Billiardenblüte", goal: "Ernte insgesamt 1 Brd. Kakteen.", test: (state) => state.totalEarned >= 1e15 },
  { id: "sextillion-earned", name: "Trilliardenmeer", goal: "Ernte insgesamt 1 Trd. Kakteen.", test: (state) => state.totalEarned >= 1e21 },
  { id: "frenzy-25", name: "Dauergold", goal: "Fülle den Klick-Balken 25 Mal.", test: (state) => state.events.frenzies >= 25 },
  { id: "golden-legend", name: "Goldlegende", goal: "Fange 25 Goldkakteen.", test: (state) => state.events.goldenHits >= 25 },
  { id: "red-hunter", name: "Rubinjäger", goal: "Fange 10 Rubinkakteen.", test: (state) => state.events.redHits >= 10 },
  { id: "hundred-nopal", name: "Nopal-Speicher", goal: "Sammle 100 Nopal in dieser Saison.", test: (state) => state.prestige.totalNopalEarned >= 100 },
  { id: "auto-gardener", name: "Automatengarten", goal: "Kaufe einen Autoklicker.", test: (state) => state.upgrades.some((id) => id.startsWith("autoclick-")) },
];

// Changelog-Einträge. `ru` trägt die russische Variante von title/items;
// fehlt sie, rendert game.js den deutschen Text als Fallback.
export const changelogEntries = [
  {
    date: "01.08.2026",
    title: "🌵 Großes Update: Neuer Look + Economy V3",
    items: [
      "Komplett neues Design: handgezeichnete Wüste, gemütlicher Pastell-Look, neuer Kaktus.",
      "Alle 30 Gebäude sind jetzt wirklich erreichbar — spätere Gebäude produzieren massiv mehr.",
      "120 neue Blüten-Upgrades: jedes Gebäude bekommt bei 10/25/50/100 Besitz ein weiteres x2.",
      "Klicks ernten jetzt zusätzlich 1% deiner Auto-Produktion (ausbaubar auf 4%) — Klicken lohnt sich für immer.",
      "Goldlauf: nur noch 250 Klicks, dafür x3 statt x2.",
      "Neue Autoklicker-Upgrades: klicken automatisch mit, solange du aktiv spielst — und laden den Goldlauf auf.",
      "Prestige komplett überarbeitet: erster Nopal schon bei 1 Mio., der Bonus wächst deutlich spürbarer.",
      "Gold- und Rubinkakteen kommen häufiger, geben mehr und sehen jetzt aus wie echte Kakteen.",
      "10 neue Abzeichen, Produktion läuft jetzt auch im Hintergrund-Tab korrekt weiter.",
    ],
    ru: {
      title: "🌵 Большое обновление: новый вид + экономика V3",
      items: [
        "Полностью новый дизайн: нарисованная от руки пустыня, уютный пастельный стиль, новый кактус.",
        "Все 30 зданий теперь реально достижимы — поздние здания производят намного больше.",
        "120 новых улучшений «Цветение»: каждое здание получает ещё x2 при 10/25/50/100 во владении.",
        "Клики теперь дополнительно приносят 1% авто-производства (прокачивается до 4%) — кликать выгодно всегда.",
        "Золотой бег: всего 250 кликов, зато x3 вместо x2.",
        "Новые улучшения-автокликеры: кликают вместе с тобой, пока ты активно играешь — и заряжают Золотой бег.",
        "Престиж полностью переработан: первый нопаль уже при 1 млн, бонус растёт заметно ощутимее.",
        "Золотые и рубиновые кактусы приходят чаще, дают больше и теперь выглядят как настоящие кактусы.",
        "10 новых значков, производство теперь корректно идёт и в фоновой вкладке.",
      ],
    },
  },
  {
    date: "30.07.2026",
    title: "🇷🇺 Russisch verfügbar",
    items: [
      "Das ganze Spiel gibt es jetzt auf Russisch — Gebäude, Upgrades, Abzeichen, Prestige und Rangliste.",
      "Sprache umschalten über die Flaggen oben im Menü. Eingeloggt wird die Wahl im Account gespeichert.",
      "Große Zahlen und Zeiten werden im Format der gewählten Sprache angezeigt.",
      "Rangliste „Letzter Monat“: Name, Level, Abzeichen und Farbe sind jetzt aktuell — Platz und Punktzahl bleiben vom Monatsabschluss.",
    ],
    ru: {
      title: "🇷🇺 Доступен русский язык",
      items: [
        "Вся игра теперь на русском — здания, улучшения, значки, престиж и таблица лидеров.",
        "Язык переключается флагами в меню сверху. Если ты вошёл, выбор сохраняется в аккаунте.",
        "Большие числа и время отображаются в формате выбранного языка.",
        "Таблица «Прошлый месяц»: имя, уровень, значок и цвет теперь актуальные — место и счёт остаются с итогов месяца.",
      ],
    },
  },
  {
    date: "27.05.2026",
    title: "Keyboard-Klick + Spawn-Tuning",
    items: [
      "Leertaste klickt den Kaktus — kein Maus-Klick mehr nötig.",
      "Gold- und Rubinkakteen spawnen häufiger (Goldkaktus 1,5–3,5 min, Rubinkaktus 10–22 min).",
      "Kein Auto-Collect mehr: nur aktives Antippen zählt, dafür kommen die Events deutlich öfter.",
      "Pinke Standard-Blume sitzt oben rechts auf dem Kaktus.",
      "Sound-Effekte spielen jetzt zuverlässig auch wenn die Musik stummgeschaltet ist (Mobile-Fix).",
    ],
    ru: {
      title: "Клик с клавиатуры + настройка спавна",
      items: [
        "Пробел кликает по кактусу — клик мышью больше не нужен.",
        "Золотые и рубиновые кактусы спавнятся чаще (Золотой 1,5–3,5 мин, Рубиновый 10–22 мин).",
        "Больше нет авто-сбора: считается только активный тап, зато события приходят заметно чаще.",
        "Розовый стандартный цветок сидит справа сверху на кактусе.",
        "Звуковые эффекты теперь надёжно играют, даже если музыка выключена (фикс для мобильных).",
      ],
    },
  },
  {
    date: "23.05.2026",
    title: "Belohnungen mit mehr WOW",
    items: [
      "Gold- und Rubinkaktus-Belohnungen werden jetzt viel größer und länger eingeblendet — du siehst genau wie viel du eingesammelt hast.",
      "Live-Hinweis im Spiel, wenn ein Admin einen Gold- oder Rubinkaktus auslöst.",
    ],
    ru: {
      title: "Награды с большим WOW",
      items: [
        "Награды за Золотой и Рубиновый кактус теперь показываются намного крупнее и дольше — ты точно видишь, сколько собрал.",
        "Живое уведомление в игре, когда админ запускает Золотой или Рубиновый кактус.",
      ],
    },
  },
  {
    date: "22.05.2026",
    title: "Audio & Feinschliff",
    items: [
      "Minor bug fixes and UI improvements.",
      "Added SFX and music.",
      "SFX bleiben auch bei stummgeschalteter Musik aktiv.",
      "Gold- und Rubinkakteen reagieren nur auf aktive Spielzeit.",
      "Gold- und Rubinkakteen verschwinden zuverlässig nach kurzer Zeit.",
      "Mobile Webapp-Layout und Touch-Verhalten verbessert.",
    ],
    ru: {
      title: "Аудио и полировка",
      items: [
        "Мелкие исправления багов и улучшения интерфейса.",
        "Добавлены звуковые эффекты и музыка.",
        "Звуковые эффекты остаются активными даже при выключенной музыке.",
        "Золотые и рубиновые кактусы реагируют только на активное время игры.",
        "Золотые и рубиновые кактусы надёжно исчезают через короткое время.",
        "Улучшены мобильная вёрстка веб-приложения и поведение при касании.",
      ],
    },
  },
  {
    date: "22.05.2026",
    title: "Prestige-Update",
    items: [
      "Nopal-Prestige beschleunigt neue Runs innerhalb der laufenden Saison.",
      "Goldlauf, Goldkakteen und seltene Rubinkakteen belohnen aktives Spielen.",
      "Offline-Fortschritt sammelt ab 5 Minuten bis zu 12 Stunden halbe automatische Produktion ein.",
      "Neue Gebäude, neue Upgrades und 20 Abzeichen erweitern den Grind nach oben.",
      "Die Rangliste läuft jetzt monatlich und zeigt den letzten Monatsabschluss.",
      "Große Zahlen werden im deutschen Format mit lesbaren Abkürzungen angezeigt.",
    ],
    ru: {
      title: "Обновление престижа",
      items: [
        "Нопаль-престиж ускоряет новые заходы внутри текущего сезона.",
        "Золотой бег, Золотые кактусы и редкие Рубиновые кактусы награждают активную игру.",
        "Оффлайн-прогресс собирает с 5 минут и до 12 часов половину автоматического производства.",
        "Новые здания, новые улучшения и 20 значков расширяют гринд вверх.",
        "Таблица лидеров теперь идёт ежемесячно и показывает итоги прошлого месяца.",
        "Большие числа отображаются с читаемыми сокращениями.",
      ],
    },
  },
];
