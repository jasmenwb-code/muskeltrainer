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
  online/                Firebase, Konto, Profile/Freunde, Lobby, Duell, Gruppe, Rangliste
  main.js                Start
public/                  Dateien, die unverändert veröffentlicht werden (Bilder, Icons, Firebase-Konfiguration, CNAME)
docs/                    fertige Website (von build.py erzeugt, nicht von Hand ändern)
tests/                   automatische Tests
database.rules.json      Sicherheitsregeln der Firebase-Datenbank
build.py                 baut docs/
```

Die Skripte werden in der Reihenfolge aus `build.py` zu einer Datei zusammengefügt; spätere Dateien nutzen, was vorher definiert wurde.

## Ändern und veröffentlichen

```bash
python3 build.py              # baut docs/
cd tests && npm install && npm test   # prüft Lernmodus, Fragen, Duell, Gruppe, Profil
git add -A && git commit -m "…" && git push   # GitHub Pages veröffentlicht docs/
```

Die Firebase-Regeln aus `database.rules.json` werden in der Firebase-Konsole unter *Realtime Database → Regeln* eingefügt.

> **Übergang:** Solange GitHub Pages noch aus dem Hauptordner veröffentlicht, liegt dort eine Kopie von `docs/`. Nach der Umstellung (Settings → Pages → Branch `main`, Ordner `/docs`) können `index.html`, `sw.js`, `robots.txt`, `sitemap.xml`, `CNAME`, `.nojekyll`, `firebase-config.js`, `manifest.webmanifest`, `icons/` und `img/` im Hauptordner gelöscht werden.
