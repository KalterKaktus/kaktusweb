# KaktusLife

Eigenständiges Brettspiel für genau zwei Menschen unter `/games/KaktusLife/`. Native ES-Module, eigene SVG-Brettwelt, DE/RU, synthetisierte Töne und eine gemeinsame Regelimplementierung für Online-Spiel und lokale Übung. Kein Frontend-Build erforderlich.

## Lokal ansehen

Vom Repository-Stamm:

```sh
node games/KaktusLife/tools/preview.mjs
```

Öffne `http://127.0.0.1:4178/games/KaktusLife/`. Unter „Gemeinsam an einem Gerät“ spielen zwei Menschen abwechselnd mit lokalem automatischem Spielstand. Der statische Vorschauserver stellt keinen Online-Spielserver bereit.

## Online-Integration

Die bestehende Site-Anmeldung wird übernommen. Serverautorität liegt in `netlify/functions/kaktuslife.mjs`, atomare Persistenz in der vorbereiteten Supabase-Migration. Browser haben keine direkten Spieltabellenrechte.

Die produktive Migration wurde am 2026-11-05 auf dem bestehenden Supabase-Projekt angewendet und geprüft (`20261105214557_kaktuslife`). Die Veröffentlichung erfolgt gesammelt über PR2 und Netlify. Aktueller Deploy- und Abnahmestatus: [brain/Fortschritt.md](brain/Fortschritt.md). Vorgehen, API und Umgebungsvariablen: [BACKEND.md](BACKEND.md).

## Tests

Ohne zusätzliche Pakete vom Repository-Stamm:

```sh
node --test games/KaktusLife/tests/*.test.mjs
node games/KaktusLife/tests/balance.mjs 10000
```

Für lokale PostgreSQL- und Browserintegration zuerst im Spielordner `pnpm install --frozen-lockfile`. Die gepinnten Pakete sind reine Entwicklungsabhängigkeiten und werden von der Website nicht geladen.

```sh
pnpm test:sql
pnpm test:integration
pnpm test:browser
pnpm test:ui
```

Der Browsertest verwendet unter Windows installiertes Chrome, andernfalls Playwright Chromium. Optional `KAKTUSLIFE_BROWSER_EXECUTABLE` setzen. Das Testsystem nutzt eine lokale PGlite/PostgreSQL-Instanz, die tatsächliche Migration und Netlify-Funktion, künstliche Accounts und isolierte Auth-Antworten. Es kontaktiert keine produktiven Dienste. Im beschleunigten Fixture werden ausschließlich Test-Anfragezeitstempel zurückgesetzt, damit die produktive Schreibbegrenzung vollständige Schnelltests nicht absichtlich stoppt. Die Begrenzung selbst wird im SQL-Test überprüft.

`test:ui` prüft zusätzlich die produktive Navigation bei 320/390/1440 px, normale Touch-Animationen, das Schließen ungestarteter Lobbys und die besondere Spielfigur für `snor`. Screenshots entstehen in `test-results/` oder `KAKTUSLIFE_QA_OUTPUT`. Sie sind nicht versioniert.

## Projektgedächtnis

Der bestehende Obsidian-Vault liegt unter `brain/`. Einstieg: [brain/Start.md](brain/Start.md), aktueller Integrations- und Prüfstand: [brain/Fortschritt.md](brain/Fortschritt.md). Regeln und Zahlen: `shared/catalog.mjs`, `shared/engine.mjs`, [shared/RULES.md](shared/RULES.md).

Nach Textänderungen `node games/KaktusLife/tests/sync-translations.mjs` ausführen, beide Site-Dictionaries versionieren und die Cache-Version in `js/i18n.js` erhöhen. Das Skript erhält andere Spiele und Sprachen.

Alle Grafiken, Symbole, Kartentexte und Klänge wurden für KaktusLife erstellt. Es werden keine Originalassets oder Texte eines anderen Brettspiels verwendet.
