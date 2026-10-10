# Lucky Lounge

Isolierte Casino-Anwendung unter /games/LuckyLounge/ mit dem vollständigen
[OpenStake-Quellbaum](https://github.com/tanh1c/stake-originals-clone/tree/7f7065832cae8c898494ca7398f23d4a33a05c17)
als Grundlage. Die originalen Oberflächen, Dark-Theme, Spielgrafiken und
Animationen bleiben erhalten; Lucky-Lounge-Branding, DE/RU und eine gemeinsame
Supabase-Wallet ergänzen sie. Plinko, Mines, Crash und Dino sind integriert.
Slots und Case Opening sind vollständig aus Katalog und Navigation entfernt.
Ausschließlich kostenlose virtuelle Chips ohne Ein-/Auszahlungen, Handel,
Echtgeldwert oder Robux-Anbindung.

## Lokal öffnen und bauen

Die Repository-Wurzel mit VS Code Live Server ausliefern:
[Lobby](http://127.0.0.1:5500/games/LuckyLounge/) und
[Plinko](http://127.0.0.1:5500/games/LuckyLounge/plinko/).
Die Lobby ist ohne Login sichtbar; Spielen verwendet das bestehende Website-Login.
ES-Module benötigen HTTP, file:// funktioniert nicht.

Alternativ in games/LuckyLounge/app: pnpm install, dann pnpm dev.
Die Vite-URL lautet http://127.0.0.1:5173/games/LuckyLounge/.
pnpm build erzeugt die statischen Website-Dateien einschließlich der Einstiege
plinko/, mines/, crash/, dino/ und statistics/. Andere Website-Bereiche werden
nicht gebaut oder verändert. Netlify benötigt keinen zusätzlichen Vite-Build;
der SPA-Fallback ist auf die Lounge begrenzt.

## Supabase: manuell, in dieser Reihenfolge

1. 20261009120000_lucky_lounge_v2.sql — laut Besitzer bereits live.
2. 20261009200000_lucky_lounge_originals.sql — Mines, Crash, Dino.
3. 20261009220000_lucky_lounge_decimal_chips.sql — exakte numeric(22,2)-Beträge.
4. 20261009230000_lucky_lounge_plinko_modes.sql — drei Modi, bis 16 Reihen,
   neue RPC casino_play_plinko_mode(uuid,numeric,text), Burst statt 180-ms-Pause.
5. 20261010010000_lucky_lounge_fun_economy.sql — vorheriger Regelstand.
6. 20261010020000_lucky_lounge_hourly_bonus.sql — aktuelle Regeln und Stundenbonus.
7. 20261010030000_lucky_lounge_shared_crash.sql — gemeinsame Crash-Runden.
8. 20261010040000_lucky_lounge_crash_results.sql — 5 Sekunden Ergebnisanzeige,
   danach 10 Sekunden Einsatzzeit. Keine Rücksetzung bestehender Daten.
9. 20261010050000_lucky_lounge_admin_chips.sql — protokollierte Chip-Gutschriften
   im Adminpanel, ausschließlich über die bestehende Netlify-Admin-API.

Die Dateien liegen in supabase/migrations/. Bereits angewendete ältere
Migrationen nicht erneut außerhalb dieser Reihenfolge ausführen. Codex hat
keine produktive Migration ausgeführt. Migration 6 aktiviert den Stundenbonus; Migration 7 die gemeinsamen Crash-Runden.
Der Client prüft snapshot.rules.economy vor einem neuen Plinko-Einsatz und
meldet eine fehlende Migration, bevor Chips gebucht werden.

Bestehende Guthaben werden weder skaliert noch zurückgesetzt. Gespeicherte
Ergebnisse werden nicht rückwirkend ausgezahlt. Aktive Mines-/Dino-Runden
behalten den in ihren Parametern gespeicherten Faktor; fehlt er bei einer alten
Runde, gilt weiterhin 0,99. Bereits bestimmte Crash-Punkte bleiben unverändert.
Alte ganzzahlige Plinko-Requests in der Outbox können weiter aufgelöst werden.

## Gemeinsame Wallet und Stundenbonus

PostgreSQL besitzt Guthaben, Zufall, Einsatzvalidierung und Auszahlungen.
Wallet-Locks serialisieren Aktionen pro Account, auch über mehrere Tabs.
Jeder Request hat eine UUID; eine Wiederholung bucht nicht erneut. Die lokale
Outbox behält bei unklaren Netzwerkfehlern dieselbe UUID. Requests werden im
Tab nacheinander gesendet. BroadcastChannel, Storage-Events und 15-s-Abgleich
übernehmen ausschließlich gleich neue oder neuere Wallet-Revisionen.
Browser können keine Guthabenstände, Gewinnfelder oder Auszahlungen speichern.
Private Tabellen und Helper sind für Browser-Rollen gesperrt; Bans gelten.

Starteinsatz überall 1, Mindesteinsatz 1, Höchsteinsatz 100.000 Chips. Einsätze und Guthaben
können zwei Nachkommastellen haben; Auszahlungen werden auf 0,01 Chips
abgerundet. Der manuell eingesammelte Bonus gibt 50 Chips alle rollenden
60 Minuten, serverseitig nach dem Wallet-Lock geprüft. Request-UUIDs verhindern
Mehrfachbuchungen; auch der alte Daily-RPC nutzt denselben Bonus. Der letzte
belegte Daily-Claim startet beim Umstieg den Countdown. Bonus-Chips zählen
nicht als Spielgewinn oder für Skins.

Legacy-Saves bleiben vollständig archiviert. Runden, Höchstgewinn und gültige
Guthaben wurden übernommen. Historische Einsatz-/Gewinnsummen, die im alten
Save fehlten, werden nicht erfunden. Die Spieleransicht nennt diese Summen
„Gespeicherte Ergebnisse“ und zeigt keine Versions- oder Migrationshinweise.

Das Adminpanel liest Guthaben und Statistiken aus casino_wallets; frühere
game_saves-Werte sind nur ein schreibgeschütztes Archiv. „Chips geben“ akzeptiert
0,01 bis 1.000.000 Chips mit höchstens zwei Nachkommastellen. Netlify prüft den
angemeldeten Admin gegen ADMIN_EMAILS und ruft casino_admin_grant_chips mit
dessen Account-ID auf. Nur service_role darf die RPC ausführen. Wallet-Lock,
Request-UUID und casino_admin_credits schützen gegen doppelte oder verlorene
Buchungen; nach unklaren Fehlern bleibt dieselbe UUID im Sitzungsspeicher.
Gutschriften ändern keine Gewinn-/Einsatzstatistiken, Skins oder Bonus-Fristen.
Offene Lounge-Tabs übernehmen die neue Wallet beim nächsten 15-s-Abgleich.
Live Server stellt die Admin-API nicht bereit; lokal dafür netlify dev mit den
bestehenden Server-Umgebungsvariablen verwenden.

## Plinko: Regeln und Darstellung

| Modus | Reihen | Mitte | Rand |
| --- | --- | --- | --- |
| Einfach | 8 | 0,5× | 5,6× |
| Normal | 12 | 0,3× | 33× |
| Schwer | 16 | 0,2× | 1.000× |

Die originalen symmetrischen OpenStake-Tabellen gelten. Mehr Reihen bedeuten
höhere mögliche Gewinne und mehr Risiko, keine pauschal höhere Gewinnchance.
Die UI zeigt Gewinnfaktoren und Feldchancen, keine theoretischen Erträge.

Der Server erzeugt n unabhängige kryptographische 50/50-Bits aus UUID-Bytes
ohne Version-/Variant-Bits. Feld k hat Wahrscheinlichkeit C(n,k)/2^n.
Bits, Modus, Reihen, Risiko und Faktor werden mit der Buchung gespeichert.
Einsatz und volle Auszahlung werden atomar vor der Animation abgerechnet.
Seitenwechsel oder Schließen können damit keinen bestätigten Gewinn verlieren.
Die Guthabenanzeige zieht den Einsatz sofort ab und blendet jede bestätigte
Auszahlung erst beim Landen der zugehörigen Kugel ein. Parallel fallende Kugeln
und Guthabenabgleiche behalten diese Anzeigeverzögerung; beim Verlassen des
Spiels oder einem Animationsfehler wird das tatsächliche Guthaben angezeigt.

OpenStakes Kollisions-Engine und vorberechnete Startpositionen steuern die
Darstellung: 16 vorhandene Positionen je Feld, insgesamt 624 für 8/12/16 Reihen.
Der Ball landet durch dieselbe Physik im Serverfeld; keine Teleportationen oder
nachträgliche Ergebnisänderungen. Die sichtbare Kontaktfolge muss nicht der
Bitfolge entsprechen, da nur deren Summe das Feld definiert.
Feste 60-Hz-Schritte laufen mit 1,35-fachem Zeittempo und interpoliertem Rendering.
Bis zu 24 aktive oder wartende Kugeln; schnelle Klicks werden mit ihrem Einsatz,
Modus und Skin aufgenommen. Unversendete Einsätze reservieren nur UI-Mittel.
Moduswechsel bleiben während aktiver/wartender Kugeln gesperrt.
Server-Missbrauchsschutz: 60 neue Plinko-Buchungen pro rollender Sekunde;
idempotente Wiederholungen verbrauchen keine weitere Buchung.

Physik-Callbacks verändern keine Chips. Ein abweichendes visuelles Feld wird
als Fehler gemeldet. Das serverseitige RNG ist autoritativ; es gibt kein
zusätzliches Commit/Reveal-Verfahren gegen einen böswilligen Server.
Das Board einschließlich aller Faktoren passt sich an Breite und Höhe an;
auch 17 Gewinnfelder bleiben auf schmalen Geräten innerhalb des Layouts.

## Die übrigen Spiele

Mines: 25 Felder, 1–24 gleichverteilt platzierte Minen (Fisher-Yates mit
kryptographischem Rejection Sampling). Minen bleiben während der Runde privat.
Nach k sicheren Feldern: 0,99 × ∏(25−i)/(25−M−i), i=0…k−1. Die Auszahlung wird
beim Sichern oder nach allen sicheren Feldern atomar gebucht. Kein wirkungsloser
Auto-Tab und kein Eingabefeld für die reine Diamanten-Anzeige.

Dino: originale Phaser-Szene mit laufenden Hindernissen und Sprunganimation.
Der Server entscheidet je Sprung über Erfolg/Verlust: 85/65/45 %.
Nach k Erfolgen: floor(100 × 0,99/p^k)/100. Nach 12 Erfolgen automatische
Auszahlung. Reload setzt eine aktive Runde mit der gespeicherten Stufe fort.

Crash: gemeinsame Runden mit echtem Serverzeit-Verlauf. Nach dem Crash bleibt
das Ergebnis 5 Sekunden stehen; Gewinner bleiben grün, Verlierer werden rot.
Anschließend beginnt ein vollständiges Einsatzfenster von 10 Sekunden.
Migration 8 aktiviert diese gemeinsame Ergebnisphase. Echte Einsätze, Namen und Auszahlungen; keine
simulierten Multiplayer-Bots. Geheimer Punkt = max(1,min(1000,floor(100 × 0,99/(1−U))/100)).
Nach der Einsatzpause wächst der Faktor mit exp(0,1 × Sekunden).
Chance eines Auto-Ziels x: min(1,0,99/x). Auto-Auszahlung gilt
auch bei Gleichstand und nach Tab-Schließen, beim nächsten Wallet-RPC
abgerechnet. Manuelles Sichern muss strikt vor dem Crash beim Server eingehen.
Nur der funktionierende Auto-Cashout bleibt, kein unfertiger Auto-Bet-Tab.

Mines/Dino verwenden casino_game_action(request_id,game,action,round_id,payload).
Crash verwendet casino_crash_state() und idempotente casino_crash_action.
Der Browser fragt den gemeinsamen Zustand einmal pro Sekunde ab und animiert
mit Serverzeit. Online zählt unterschiedliche angemeldete Accounts mit
Heartbeat innerhalb von 15 Sekunden; Einsatzliste und Online-Zahl sind getrennt.
Alle Flüge und Geheimnisse liegen in privaten Tabellen. Eine frühe Auszahlung
verrät niemals den zukünftigen gemeinsamen Crash-Punkt. Beim Fortschalten
werden Auto-Gewinne und Verluste aller Teilnehmer atomar abgerechnet.
Ohne Besucher ist kein Hintergrundjob nötig: Nach längerer Leerlaufzeit
werden keine fiktiven leeren Flüge nachgeneriert; die nächste Anfrage startet
ein gemeinsames Fenster von 10 Sekunden. Persönliche Altrunden laufen mit
ihrem unveränderten Punkt aus; neue persönliche Runden sind gesperrt.
Mobile Crash zeigt zuerst den großen Fluggraphen, darunter die aktuellen
Teilnehmer. Dino nutzt auf schmalen Geräten die vorhandene 600-px-Ansicht.
Mobile Einsatzleisten liegen im Seitenfluss. Im Hochformat stehen sie bei
Crash zwischen Flug und Teilnehmern. Querformat-Telefone ab 560 px zeigen
bei allen vier Spielen eine schmale Einsatzspalte links und die Spielfläche
rechts; das Crash-Feld richtet seine Höhe nach der Einsatzspalte und zeigt
die Teilnehmer direkt darunter. Alle Seiten
lassen sich vertikal scrollen, auch über dem Dino-Canvas. Nur aufgeklappte
Einsatzdialoge überlagern die Seite; Menüöffnen schließt sie. Profilnamen
werden aus dem vorhandenen Account geladen.
Die mobile Navigation erfolgt ausschließlich über das Burger-Menü neben dem
Guthaben. Mines passt das Raster im Querformat an die verfügbare Höhe an;
der kompakte Plinko-Wurfbutton scrollt mit den Einsätzen ohne Überlagerung.
Runden-Versionen schützen parallele Entscheidungen. Abbrechen ist nur vor der
ersten Mines-/Dino-Entscheidung bzw. vor Crash-Start möglich. Erstattungen zählen
nicht als Gewinne. Alte aktive Runden behalten ihre bisherigen Faktoren.

## Skins, Audio und Fehlerrückmeldung

Standard frei; Bronze/Silber/Smaragd/Rubin/Saphir bei
100.000/250.000/500.000/1.000.000/2.500.000 serverseitig erfassten Gewinn-Chips.
Bonus-Chips zählen nicht. Ziele stehen in PlinkoGame/skins.js. Kosmetische Skins haben
keinen Effekt auf Chancen oder Auszahlung. Gesperrte Looks zeigen das Ziel.

Web-Audio-Effekte für Kontakte, Wurf, Landung, Gewinne, Bonus und UI. Sound
und Lautstärke werden gerätebezogen gespeichert; volle Master-Lautstärke mit
Kompressor und begrenzten Stimmen verhindert störende Überlagerung.

Eine beim Spielwechsel stabil bleibende Fehlergrenze fängt auch Fehler beim
Aufräumen der vorherigen Ansicht ab. Eine zusätzliche App-Fehlergrenze
verhindert einen leeren Bildschirm bei Fehlern außerhalb der Spielansicht.
Veraltete Lazy-Imports laden die Seite höchstens einmal neu, ohne Einsätze zu
wiederholen. Der Dino-Effekt zur Farbwahl gibt keinen Phaser-Rückgabewert mehr
an React zurück: dessen fälschlicher Aufruf beim Verlassen verursachte den
reproduzierten Bildschirmfehler. Builds kopieren Assets vor HTML und behalten einen Satz vorheriger
Hash-Dateien für offene Tabs (assets/build-manifest.json).

## Dateien und Prüfung

app/src enthält die angepassten Original-Komponenten; styles/tokens.css ihre
Farben. js/wallet.js und js/audio.js sind die gemeinsamen Adapter.
originalModels.jsx/originalDinoModel.jsx verbinden Spiele mit Server-Runden.
Das DE/RU-System bleibt js/i18n.js mit beiden Website-Dictionaries.

Gezielte Prüfungen: Vite-Build, alle 624 übernommenen Startpositionen gegen
die Kollisions-Engine, genaue Binomialchancen und Rückgaben. Lokales PGlite
prüft Migrations-Reihenfolge/Wiederanwendung, Erhalt vorhandener Beträge und
aktiver Regeln, Cent-Auszahlungen aller Spiele, Mindesteinsatz, Idempotenz,
Request-Konflikte, schnelle Requests, Burst-Guard und gesperrte Tabellen.
Ein kurzer Browser-Test mit der echten Wallet gegen ausschließlich lokale
RPCs prüft drei Plinko-Modi, 18 schnelle Klicks = 18 gebuchte/angezeigte Runden,
mobile Gewinnfelder und vier spielbare Lobby-Karten. Frühere gezielte Checks
prüften Daily, Gameplay/Reload von Mines/Crash/Dino, DE/RU und Modul-Recovery.
Der aktuelle lokale Check prüft zusätzlich den 50-Chip-Bonus, die 60-Minuten-
Sperre, alte Daily-Requests und den Wechsel zwischen den Spielansichten.
Gemeinsames Crash wurde mit zwei getrennten lokalen Accounts geprüft:
gleicher Countdown/Flug, echte Namen/Einsätze, Auto- und manuelles Sichern,
Offline-Abrechnung einschließlich Auto-Gleichstand und Verlust, geheime Punkte
auch nach frühem Cashout, Replay/Konflikte, Storno, geschlossene Einsatzphase,
private Tabellen/Helper und Erhalt persönlicher Altrunden. Build erfolgreich.
Admin-Gutschriften lokal gegen PostgreSQL und die echte Admin-API geprüft:
Cent-Beträge, Rechte, Request-Konflikte, unveränderte Statistiken und Replay
nach verlorener Antwort und Reload. Mobile Admin-Anzeige und DE/RU-Statistik
ohne Versionshinweise im kurzen Browser-Smoke-Test geprüft.
Keine produktiven Supabase-Aktionen, Screenshot-Serien oder Testkampagnen.

## Herkunft

OpenStake deklariert MIT im README; am verwendeten Commit fehlen eine separate
LICENSE-Datei und gesonderte Asset-Lizenzen. Die Herkunft und verfügbare
Lizenzgrundlage stehen in THIRD_PARTY_NOTICES.md; eine unabhängige Rechtekette
für fremde Artwork-Bestandteile ist dadurch nicht nachgewiesen.
Keine Stake-Logos, Tracking-IDs, upstream MP3s, Telegram-Anbindung oder lokalen
Einzahlungs-/Wallet-Reset-Funktionen sind in der aktiven Anwendung enthalten.
