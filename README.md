# Anatomy Duel

Lern-App für 84 Muskeln (Ursprung, Ansatz, Funktion, Innervation) mit kurzen Multiple-Choice-Fragen, Abbildungen aus dem Skript, Live-Duell und Gruppen-Lobby mit bis zu 8 Spielern.

**Website:** https://anatomyduel.com/ – Lernen geht ohne Konto und offline (zum Startbildschirm hinzufügen). Online-Spiele laufen über Firebase (Anmeldung mit E-Mail und Passwort, Realtime Database).

## Aufbau

```
src/                     Quellcode (reines JavaScript, kein Framework)
  index.html             HTML-Gerüst; build.py setzt CSS und Skript ein
  styles.css             gesamtes Design (hell/dunkel)
  sw.js                  Service Worker für Offline-Nutzung (Vorlage)
  data/muscles.js        Muskeldaten aus dem Lernskript
  data/figures.js        Zuordnung Muskel → Abbildung
  core/                  Textwerkzeuge, Vorlesen, UI-Bausteine
  learn/                 Fragengenerator und Lernmodus
  app/shell.js           Startseite, Einstellungen, Kopfzeile
  online/                Firebase, Konto, Profile/Freunde, Lobby, Spielprotokoll, Duell, Gruppe, Rangliste
  main.js                Start
public/                  Dateien, die unverändert veröffentlicht werden (Bilder, Icons, Firebase-Konfiguration, CNAME)
functions/               Server-Auswertung der Duelle (Firebase Cloud Function)
deploy-server.sh         veröffentlicht Server-Funktion und Datenbank-Regeln
docs/                    fertige Website (von build.py erzeugt, nicht von Hand ändern)
tests/                   automatische Tests
database.rules.json      Sicherheitsregeln der Firebase-Datenbank
build.py                 baut docs/
```

Die Skripte werden in der Reihenfolge aus `build.py` zu einer Datei zusammengefügt; spätere Dateien nutzen, was vorher definiert wurde.

## Ändern und veröffentlichen

```bash
python3 build.py              # baut docs/
cd tests && npm install && npm test   # prüft Lernmodus, Fragen, Duell, Gruppe, Profil, Server-Auswertung
git add -A && git commit -m "…" && git push   # GitHub Pages veröffentlicht docs/
```

## Server-Auswertung

Duelle werden auf dem Server gewertet, damit niemand Siege oder Punkte fälschen kann:

1. Während des Duells protokolliert die Website in `games/{id}` Fragen, Rundenstart und jede Antwort mit **Server-Zeitstempel**. Die Regeln in `database.rules.json` erlauben jedem nur seine eigenen Einträge und jeden nur einmal.
2. Nach dem Ende rechnet die Cloud Function in `functions/` alles nach: Sind die Fragen echt? Welche Antwort ist laut Muskeldaten richtig? Wie viele Sekunden lagen laut Server dazwischen?
3. Nur der Server schreibt Statistik, Ranglistenpunkte und Bilanzen (`users/*/stats`, `score`, `h2h`). Die Website zeigt danach „Gewertet: …“.

**Ranked** läuft komplett über den Server:

- Gegnersuche: Suchende tragen sich in `queue/{uid}` ein; die Funktion `matchRanked` paart die zwei, die am längsten warten, und legt das Spiel selbst an (`ranked: true` kann nur der Server setzen).
- Wertung nach Glicko wie bei chess.com (`functions/glicko.js`): Start 1000 mit großer Unsicherheit, große Sprünge in den ersten Spielen, ruhiger mit mehr Spielen, beweglicher nach längerer Pause. „?“ = vorläufig unter 10 Ranked-Spielen.
- Gegen Punkte-Schieben zählen höchstens 3 Ranked-Spiele pro Paar und Tag.

Gruppenspiele zählen nicht für die Rangliste und laufen ohne Protokoll.

Veröffentlichen von Funktion und Regeln (braucht den Firebase-Tarif *Blaze*): in der Google Cloud Shell

```bash
git clone https://github.com/jasmenwb-code/muskeltrainer.git && cd muskeltrainer && bash deploy-server.sh
```

> **Übergang:** Solange GitHub Pages noch aus dem Hauptordner veröffentlicht, liegt dort eine Kopie von `docs/`. Nach der Umstellung (Settings → Pages → Branch `main`, Ordner `/docs`) können `index.html`, `sw.js`, `robots.txt`, `sitemap.xml`, `CNAME`, `.nojekyll`, `firebase-config.js`, `manifest.webmanifest`, `icons/` und `img/` im Hauptordner gelöscht werden.
