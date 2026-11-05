# Multiplayer

## Sicherheitsmodell

Genau zwei angemeldete Accounts bilden einen privaten Raum. Der Host erstellt den Raum, die zweite Person tritt per Code oder Link bei. Die zweite Person bestätigt Bereitschaft, dann startet der Host. Eine neue Partie setzt nach Abschluss erneut die Lobby-Bereitschaft voraus.

Der Endpunkt `/api/kaktuslife` validiert die bestehende Supabase-Bearer-Session serverseitig. Namen kommen aus dem Profil. Der Browser kann weder Geldstände noch Zufallsergebnisse setzen. Der Service-Role-Schlüssel bleibt ausschließlich in der vorhandenen Netlify-Umgebung.

Spieltabellen sind für Browserrollen gesperrt. Atomare Datenbankfunktionen stehen nur dem Service-Role-Server zur Verfügung. Eine Revision verhindert das Überschreiben paralleler Änderungen. Anfrage-UUIDs verhindern doppelte Ausführung bei erneut gesendeten Aktionen.

## Synchronisierung und Wiederverbindung

Der Browser gleicht den autoritativen Snapshot in aktiven Tabs etwa alle 2,5 Sekunden ab. Hintergrund-Tabs und Fehler erhöhen das Intervall. Raumnummer und unbestätigte Anfrage-ID bleiben lokal erhalten. Eine unterbrochene Serverantwort kann mit derselben Anfrage-ID erneut angefordert werden.

Verlassen der Oberfläche löscht keinen Raum. Es gibt keine automatische Entscheidung oder Zugübernahme bei Abwesenheit. Die wartende Person kann nach Wiederverbindung weiterspielen.

Eine ungestartete Lobby kann der Host ausdrücklich über einen Bestätigungsdialog schließen. Einladung und weitere Snapshots sind danach ungültig, der Raumlimit-Platz wird frei. Daten und Anfragebelege bleiben erhalten; eine verlorene Erfolgsantwort lässt sich mit derselben UUID wiederholen. Laufende oder abgeschlossene Spiele werden durch diese Funktion niemals geschlossen.

## Integration

Migration und benötigte Umgebungsvariablen sind in `../BACKEND.md` beschrieben. Produktive Anwendung und Veröffentlichung erfordern ausdrückliche Freigabe. Details des tatsächlich verifizierten Standes: [[Fortschritt]], [[Offene Aufgaben]].
