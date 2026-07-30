// Changelog-Einträge. `ru` trägt die russische Variante von title/items;
// fehlt sie, rendert game.js den deutschen Text als Fallback.
export const FISHING_CHANGELOG = [
    {
        date: "25.05.2026",
        title: "🍀 Glück wirkt jetzt auch auf Mutationen",
        items: [
            "Jedes Level Glück (max 5) erhöht ALLE Mutationen-Wahrscheinlichkeiten um +8 % (sanft).",
            "Beispiele bei Glück Lvl 5: SHINY-Chance steigt von 1 % auf 1,4 %, HAUNTED im Geistermeer von 15 % auf 21 %.",
            "Gilt für Standard-Mutationen (BIG/HUGE/SHINY) UND alle Event-Mutationen.",
            "Macht das Glück-Upgrade jetzt doppelt nützlich: bessere Rarities + häufigere Mutationen.",
            "Theoretisch seltenster Catch (Legendary + SHINY + HAUNTED + ≥99 % kg im Geistermeer): ~1 in 1 Milliarde ohne Glück, ~1 in 110 Millionen mit Glück Lvl 5.",
        ],
        ru: {
            title: "🍀 Удача теперь влияет и на мутации",
            items: [
                "Каждый уровень Удачи (макс 5) повышает ВСЕ вероятности мутаций на +8 % (плавно).",
                "Примеры при Удаче Lv5: шанс SHINY растёт с 1 % до 1,4 %, HAUNTED в Море призраков — с 15 % до 21 %.",
                "Действует на стандартные мутации (BIG/HUGE/SHINY) И на все событийные мутации.",
                "Улучшение Удачи теперь полезно вдвойне: лучшие редкости + более частые мутации.",
                "Теоретически самая редкая поимка (Legendary + SHINY + HAUNTED + ≥99 % кг в Море призраков): ~1 к 1 миллиарду без Удачи, ~1 к 110 миллионам с Удачей Lv5.",
            ],
        },
    },
    {
        date: "25.05.2026",
        title: "🌦🧬 Großes Wetter- & Mutationen-Update",
        items: [
            "5 neue Wetter-Events: 🌌 Abyss (Epic+ ×2 Spawn-Chance + Neon-Partikel), 🌠 Polarlicht (grün-violette Lichtschleier), 🔥 Glutsturm (orange Glut-Funken über aufgewühlter See), 🌑 Blutmond (tiefroter Schleier + Blut-Tropfen), 👻 Geistermeer (cyan Geister-Wisps + dichter Nebel).",
            "Wetter-System läuft jetzt mit gewichteten Wahrscheinlichkeiten — Geistermeer ist mit 1,7 % pro Slot das seltenste Event im Spiel.",
            "Mutationen-System: jeder Fang würfelt unabhängig auf Standard-Mutation (10 %) und Event-Mutation (während Wetter aktiv).",
            "Standard-Pool: BIG ×1,5 · HUGE ×2 · SHINY ×3 (mit Glow).",
            "Event-Mutationen Standard (20 % in-Event, parallel zum Stat-Buff): ☀ SUNNY · 🌧 WET · ⛈ STORMY · 🌫 MISTY · 🌙 NOCTURNAL — alle ×2.",
            "Event-Mutationen Rare (mit Glow): 🌌 ABYSSAL ×4 · 🌠 AURORA ×3 · 🔥 EMBER ×5 · 🌑 CRIMSON ×7 · 👻 HAUNTED ×10.",
            "Mutationen stacken multiplikativ: SHINY HAUNTED Common 10-Coin = 10 × 3 × 10 = 300 Coins. P(SHINY HAUNTED) pro Catch in Geistermeer: 0,15 %.",
            "Catch-Popup zeigt Mutation-Badges mit Glow + Recolor. Event-Mutationen und SHINY pingen alle Spieler im Broadcast.",
            "Inventar: pro Fisch farbige Mutation-Chips mit Multiplier + Fang-Count — auf einen Blick sichtbar wieviele HAUNTED-Karpfen du schon hast.",
            "Wetter-Slots auf 15 min reduziert (vorher 30), aktive Phase auf 2,5 min (vorher 5) — doppelt so viel Wechsel + Abwechslung, gleicher Zeit-Anteil event-aktiv (16,7 %).",
        ],
        ru: {
            title: "🌦🧬 Большое обновление погоды и мутаций",
            items: [
                "5 новых погодных событий: 🌌 Abyss (Epic+ ×2 к шансу спавна + неоновые частицы), 🌠 Северное сияние (зелёно-фиолетовые световые шлейфы), 🔥 Огненная буря (оранжевые угольные искры над взволнованным морем), 🌑 Кровавая луна (глубокий красный шлейф + капли крови), 👻 Море призраков (циановые призрачные wisps + густой туман).",
                "Система погоды теперь работает со взвешенными вероятностями — Море призраков с 1,7 % на слот самое редкое событие в игре.",
                "Система мутаций: каждая поимка независимо бросает на стандартную мутацию (10 %) и событийную мутацию (пока погода активна).",
                "Стандартный пул: BIG ×1,5 · HUGE ×2 · SHINY ×3 (со свечением).",
                "Стандартные событийные мутации (20 % в событии, параллельно стат-бонусу): ☀ SUNNY · 🌧 WET · ⛈ STORMY · 🌫 MISTY · 🌙 NOCTURNAL — все ×2.",
                "Редкие событийные мутации (со свечением): 🌌 ABYSSAL ×4 · 🌠 AURORA ×3 · 🔥 EMBER ×5 · 🌑 CRIMSON ×7 · 👻 HAUNTED ×10.",
                "Мутации стекуются мультипликативно: SHINY HAUNTED Common за 10 монет = 10 × 3 × 10 = 300 монет. P(SHINY HAUNTED) за поимку в Море призраков: 0,15 %.",
                "Попап поимки показывает значки мутаций со свечением + перекраской. Событийные мутации и SHINY пингуют всех игроков в трансляции.",
                "Инвентарь: у каждой рыбы цветные чипы мутаций с множителем + счётчиком поимок — сразу видно, сколько HAUNTED-карпов у тебя уже есть.",
                "Слоты погоды сокращены до 15 мин (было 30), активная фаза до 2,5 мин (было 5) — вдвое больше смен и разнообразия при той же доле активного времени (16,7 %).",
            ],
        },
    },
    {
        date: "25.05.2026",
        title: "⚖ Balance & Tab-Fix: Ausreissen aggressiver, keine Wartespiele mehr",
        items: [
            "Hintergrund-Tab-Fix: Fisch-Spots warten nicht mehr auf dich. Wenn der Tab inaktiv war, werden Spots die längst hätten ablaufen müssen sauber weggeräumt — kein Stapel von 3 Fischen mehr beim Zurückkommen.",
            "Tension-Drain deutlich aggressiver: Common reisst jetzt in 6 s aus (vorher 10 s), Legendary in 2,4 s (vorher 3 s) — ohne Upgrades spürst du den Druck.",
            "Schnur-Upgrade dafür stärker: 12 % statt 11 % Drain-Reduktion pro Level → bei Maxlevel bleiben nur noch 40 % Drain übrig (Common 15 s, Legendary 6 s).",
            "Refill bleibt unverändert (0.36/s, ×2,75 bei Hook Lvl 5) — schnelle Reaktion in der Zone rettet dich weiter.",
        ],
        ru: {
            title: "⚖ Баланс и фикс вкладок: обрывы агрессивнее, никаких ожиданий",
            items: [
                "Фикс фоновой вкладки: места клёва больше не ждут тебя. Если вкладка была неактивна, споты, которые давно должны были исчезнуть, аккуратно убираются — больше никакой пачки из 3 рыб при возврате.",
                "Tension-Drain заметно агрессивнее: Common обрывается за 6 с (было 10 с), Legendary за 2,4 с (было 3 с) — без улучшений давление чувствуется.",
                "Зато улучшение лески сильнее: 12 % вместо 11 % снижения drain за уровень → на максимуме остаётся только 40 % drain (Common 15 с, Legendary 6 с).",
                "Восстановление без изменений (0.36/с, ×2,75 при Крючке Lv5) — быстрая реакция в зоне по-прежнему спасает.",
            ],
        },
    },
    {
        date: "25.05.2026",
        title: "Angel-Redesign V2",
        items: [
            "Komplett überarbeitete Angel-Optik mit klarem Charakter pro Area:",
            "Pond — klassischer Angler: glatte Holzrute, Kork-Griff, Spinning-Reel, J-Hook, Spinner-Köder.",
            "Lake — mystischer Wald: Driftwood-Rute mit Knoten und Ästen, Leder-Wickel, Fly-Reel, Widerhaken-Hook, Feder-Fly mit schwebenden Blättern.",
            "Ocean — industrieller Tiefseejäger: Tactical-Rute mit Bandagen und Notches, Rubber-Grip, boxy Baitcaster, Drilling-Hook, Lead-Jig mit Skirt und Bubbles.",
            "Jedes Upgrade-Level ändert sichtbar Farbe, Details und Glow — vom matten Holz bis zur Maxlevel-Gold-Variante.",
        ],
        ru: {
            title: "Редизайн удочки V2",
            items: [
                "Полностью переработанный вид удочки с чётким характером для каждой области:",
                "Pond — классический рыбак: гладкое деревянное удилище, пробковая рукоять, спиннинговая катушка, J-крючок, приманка-вертушка.",
                "Lake — мистический лес: удилище из driftwood с узлами и ветками, кожаная обмотка, мушиная катушка, крючок с бородкой, перьевая мушка с парящими листьями.",
                "Ocean — промышленный глубоководный охотник: тактическое удилище с бандажами и насечками, резиновая рукоять, кубическая бейткастерная катушка, тройник, свинцовый джиг со юбкой и пузырями.",
                "Каждый уровень улучшения заметно меняет цвет, детали и свечение — от матового дерева до золотого варианта на максимуме.",
            ],
        },
    },
    {
        date: "24.05.2026",
        title: "Neue Angel-UI",
        items: [
            "Neue entspannte Hintergrundmusik im Loop für einen ruhigeren Fishing-Vibe.",
            "Beim Halten im Fang-Minispiel läuft jetzt ein Rollen-Sound, beim Loslassen pausiert er sauber.",
            "Aus „Shop\" wird „Angel\" — du siehst jetzt deine richtige Angel mit allen Teilen oben drauf.",
            "Wechsel zwischen Rute, Schnur, Haken, Köder und Glück über die Tabs unter der Angel.",
            "Jedes Teil bekommt mit jedem Upgrade-Level einen neuen Look — von Holz über Bambus, Karbon, Silber bis Gold; Köder mutiert vom Wurm zum mythischen Köder, Glück vom Bead zum kosmischen Stern.",
            "Detail-Panel rechts zeigt Level-Dots, Beschreibung und einen großen Upgrade-Button.",
        ],
        ru: {
            title: "Новый интерфейс удочки",
            items: [
                "Новая спокойная фоновая музыка в лупе для более расслабленного вайба рыбалки.",
                "При удержании в мини-игре ловли играет звук катушки, при отпускании он аккуратно ставится на паузу.",
                "«Магазин» стал «Удочкой» — теперь ты видишь свою настоящую удочку со всеми деталями сверху.",
                "Переключение между Удилищем, Леской, Крючком, Приманкой и Удачей через табы под удочкой.",
                "Каждая деталь получает новый вид с каждым уровнем — от дерева через бамбук, карбон, серебро до золота; приманка мутирует от червя до мифической, Удача от бусины до космической звезды.",
                "Панель деталей справа показывает точки уровня, описание и большую кнопку улучшения.",
            ],
        },
    },
    {
        date: "24.05.2026",
        title: "Wetter-Performance — Sturm und Nebel optimiert",
        items: [
            "Sturm und Regen: weniger, dafür größere Regentropfen-Ringe statt vielen kleinen — bleibt visuell dramatisch, läuft aber deutlich flüssiger.",
            "Nebel: schlichter weißer Schleier statt animierter Wolken-Textur — kein Lag mehr beim Event-Wechsel.",
        ],
        ru: {
            title: "Производительность погоды — шторм и туман оптимизированы",
            items: [
                "Шторм и дождь: меньше, но крупнее круги от капель вместо множества мелких — визуально так же драматично, но заметно плавнее.",
                "Туман: простая белая вуаль вместо анимированной текстуры облаков — больше никаких лагов при смене события.",
            ],
        },
    },
    {
        date: "24.05.2026",
        title: "Doppelter Index + Performance",
        items: [
            "Doppelt so viele Fische zum Sammeln — Pond, Lake und Ocean haben jeweils neue Arten in allen Raritäten.",
            "Fish Index zeigt jetzt nur die Fische deiner aktuellen Area mit voller Animation — andere Areas zeigen den Fortschritts-Counter und einen Hinweis zum Wechseln.",
            "Performance: deutlich schnelleres Öffnen des Fish-Index, weniger Ruckler beim Anzeigen.",
            "Nebel-Event auf Mobile/iPad: leichteres Rendering, kein Lag mehr beim Event-Wechsel.",
        ],
        ru: {
            title: "Двойной каталог + производительность",
            items: [
                "Вдвое больше рыбы для коллекции — в Pond, Lake и Ocean появились новые виды во всех редкостях.",
                "Каталог рыб теперь показывает с полной анимацией только рыбу твоей текущей области — другие области показывают счётчик прогресса и подсказку о смене.",
                "Производительность: каталог рыб открывается заметно быстрее, меньше подтормаживаний при отображении.",
                "Событие тумана на мобильных/iPad: более лёгкий рендеринг, больше никаких лагов при смене события.",
            ],
        },
    },
    {
        date: "24.05.2026",
        title: "Daily Login-Belohnungen",
        items: [
            "Jeder Tag in Folge bringt eine Belohnung — Coins steigen pro Tag, Tag 7 ist immer der Special.",
            "Woche 1 Tag 7: garantierte Epic-Fischstelle. Woche 2 Tag 7: 2× Epic. Ab Woche 3: garantierte Legendary-Fischstelle.",
            "Längere Streaks skalieren die Coin-Belohnung sanft hoch (12 % pro Woche, gedeckelt) — bleibt aber Beilage, kein Ersatz fürs aktive Spielen.",
            "Streak resettet wenn du einen Tag aussetzt — also lieber täglich kurz reinschauen!",
            "Karl die Schildkröte taucht jetzt maximal einmal pro Stunde auf (vorher alle 30 Min).",
        ],
        ru: {
            title: "Ежедневные награды за вход",
            items: [
                "Каждый день подряд даёт награду — монеты растут за день, день 7 всегда особый.",
                "Неделя 1 день 7: гарантированное Epic-место клёва. Неделя 2 день 7: 2× Epic. С 3-й недели: гарантированное Legendary-место клёва.",
                "Длинные стрики плавно повышают награду в монетах (12 % за неделю, с капом) — но остаются дополнением, не заменой активной игре.",
                "Стрик сбрасывается, если пропустишь день — так что лучше заглядывать ежедневно!",
                "Карл-черепаха теперь появляется максимум раз в час (было раз в 30 мин).",
            ],
        },
    },
    {
        date: "24.05.2026",
        title: "Bella's Schildkröte Karl",
        items: [
            "Karl die Schildkröte taucht zufällig alle ~30 Minuten im Wasser auf (global synchron für alle Spieler).",
            "Tippe ihn an und putze seinen Panzer sauber — wisch den Schmutz mit Finger oder Maus weg.",
            "Sauberer Panzer = Glücksrad mit Belohnungen: Coins von 10 bis 10.000 oder garantierte Epic/Legendary-Fischstellen.",
            "Belohnungen skalieren mit deiner aktuellen Area — Legendary-Spawn gibt's nur im Ocean.",
            "Tolerant: ein paar Dreckkrümel reichen nicht zum Sauber-Sein, aber 85 % genügt — kein Pixel-Perfektion nötig.",
        ],
        ru: {
            title: "Карл — черепаха Беллы",
            items: [
                "Карл-черепаха случайно появляется в воде примерно каждые 30 минут (глобально синхронно для всех игроков).",
                "Тапни по нему и отчисти его панцирь — вытирай грязь пальцем или мышью.",
                "Чистый панцирь = колесо фортуны с наградами: монеты от 10 до 10 000 или гарантированные Epic/Legendary-места клёва.",
                "Награды масштабируются с твоей текущей областью — Legendary-спавн бывает только в Ocean.",
                "Терпимо: пара крошек грязи не помешает, достаточно 85 % — пиксельная точность не нужна.",
            ],
        },
    },
    {
        date: "23.05.2026",
        title: "Entspannteres Tempo + Mobile-Polish",
        items: [
            "Loading-Screen beim Öffnen — kein weißer Flash mehr beim Direkt-Link.",
            "Fischstellen tauchen jetzt entspannt auf — ohne Köder ca. alle 10 s, mit Maxlevel ca. alle 2-3 s.",
            "Sie bleiben 4 s sichtbar (ohne Köder) bis 12 s (Maxlevel).",
            "Upgrade-Texte komplett vereinfacht — weniger Fachchinesisch.",
            "iPhone-Lupe beim Doppeltippen im Fang-Menü wird jetzt zuverlässig unterdrückt.",
            "Performance: Wasser pausiert automatisch wenn das Fang-Fenster offen ist oder der Tab versteckt — spart Akku.",
            "Auf Tablets/Smartphones reduzierte Blur-Effekte für flüssigere Performance.",
        ],
        ru: {
            title: "Более спокойный темп + мобильная полировка",
            items: [
                "Экран загрузки при открытии — больше никакого белого мелькания при прямой ссылке.",
                "Места клёва появляются спокойнее — без приманки примерно каждые 10 с, на максимуме каждые 2-3 с.",
                "Они видны от 4 с (без приманки) до 12 с (максимум).",
                "Тексты улучшений полностью упрощены — меньше технического жаргона.",
                "Лупа iPhone при двойном тапе в меню ловли теперь надёжно подавляется.",
                "Производительность: вода автоматически ставится на паузу, когда открыто окно ловли или скрыта вкладка — экономит батарею.",
                "На планшетах/смартфонах уменьшены blur-эффекты для более плавной работы.",
            ],
        },
    },
    {
        date: "23.05.2026",
        title: "Köder ersetzt Sonar",
        items: [
            "Sonar heisst jetzt Köder — passt thematisch besser.",
            "Mit jedem Level: +1 Fischstelle parallel (max 6) und längere Verweildauer.",
        ],
        ru: {
            title: "Приманка вместо сонара",
            items: [
                "Сонар теперь называется Приманкой — тематически подходит лучше.",
                "С каждым уровнем: +1 место клёва параллельно (макс 6) и более долгое время жизни.",
            ],
        },
    },
    {
        date: "23.05.2026",
        title: "Force-Spawn-Events",
        items: [
            "Admins können jetzt garantierte Epic- oder Legendary-Fischstellen für alle Online-Spieler auftauchen lassen.",
            "Force-Spawn-Spots leuchten lila (Epic) oder gold (Legendary) und bleiben länger sichtbar.",
            "Wer einen Force-Spawn-Spot antippt, kriegt garantiert die entsprechende Rarity — auch im Pond kann man so Legendary fangen.",
        ],
        ru: {
            title: "Force-Spawn события",
            items: [
                "Админы теперь могут создавать гарантированные Epic- или Legendary-места клёва для всех онлайн-игроков.",
                "Force-Spawn споты светятся фиолетовым (Epic) или золотым (Legendary) и остаются видимыми дольше.",
                "Кто тапнет по Force-Spawn споту, гарантированно получит соответствующую редкость — так можно поймать Legendary даже в Pond.",
            ],
        },
    },
    {
        date: "23.05.2026",
        title: "Mehr Spannung beim Fang",
        items: [
            "Neue Schnur-Spannung im Fang-Menü: bleibt der Fisch zu lange ausserhalb der Zone, reisst die Schnur und du verlierst den Catch.",
            "Better Line dämpft das Ausreissen, Better Hook füllt die Schnur-Spannung dafür schneller wieder auf.",
            "Sonar-Upgrade ist deutlich spürbarer: ohne Sonar dauert es lange bis ein Fisch auftaucht, jedes Level beschleunigt das massiv.",
            "Mit voll ausgebautem Sonar (Level 5) können jetzt zwei Fischstellen gleichzeitig auf dem Wasser sein.",
            "Fischstellen verschwinden schneller — wer zu lange wartet, verpasst den Fang.",
        ],
        ru: {
            title: "Больше напряжения при ловле",
            items: [
                "Новое натяжение лески в меню ловли: если рыба слишком долго вне зоны, леска рвётся и поимка теряется.",
                "Better Line смягчает обрывы, Better Hook быстрее восстанавливает натяжение лески.",
                "Улучшение сонара заметно ощутимее: без сонара рыба появляется долго, каждый уровень сильно ускоряет это.",
                "С полностью прокачанным сонаром (уровень 5) на воде теперь могут быть два места клёва одновременно.",
                "Места клёва исчезают быстрее — кто ждёт слишком долго, пропускает поимку.",
            ],
        },
    },
    {
        date: "23.05.2026",
        title: "Launch — V1",
        items: [
            "Drei Areas: Pond, Lake, Ocean — schalte sie über Prestige frei.",
            "Sammle Fische in deinem Fish Index und tracke beste Gewichte.",
            "Coin-Fische ziehen ab und zu durchs Bild — antippen für Bonus-Coins.",
            "Wetter-Events laufen global im 30-Minuten-Takt: Sonnig, Regen, Sturm, Nebel und Nacht ändern Wasser und Buffs für 5 Minuten.",
            "Upgrades für Rute, Schnur, Haken, Köder und Sonar pushen Fang-Chancen und Spawn-Rate.",
            "Cloud-Speicher: log dich ein und dein Fortschritt syncht geräteübergreifend.",
            "Live-Rangliste sortiert nach Prestige und gefangenen Fischen.",
            "Epische und legendäre Fänge werden allen Online-Spielern angekündigt.",
        ],
        ru: {
            title: "Запуск — V1",
            items: [
                "Три области: Pond, Lake, Ocean — открывай их через престиж.",
                "Собирай рыбу в своём каталоге и отслеживай лучшие веса.",
                "Монетные рыбы время от времени проплывают через экран — тапай для бонусных монет.",
                "Погодные события идут глобально каждые 30 минут: Солнечно, Дождь, Шторм, Туман и Ночь меняют воду и бонусы на 5 минут.",
                "Улучшения Удилища, Лески, Крючка, Приманки и Сонара повышают шансы поимки и скорость спавна.",
                "Облачное сохранение: войди, и прогресс синхронизируется между устройствами.",
                "Живая таблица лидеров сортируется по престижу и числу пойманных рыб.",
                "О эпических и легендарных поимках объявляется всем онлайн-игрокам.",
            ],
        },
    },
];
