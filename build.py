"""Baut die Website nach docs/ (GitHub Pages veröffentlicht diesen Ordner)
und die Muskeldaten für die Server-Auswertung nach functions/muscles.js.

    python3 build.py

Ablauf: Alle Skripte aus src/ werden in fester Reihenfolge zu einem <script> zusammengefügt,
CSS und Skript in src/index.html eingesetzt, public/ wird unverändert kopiert,
sw.js bekommt die Dateiliste und einen Cache-Namen aus dem Inhalts-Hash.
"""
import hashlib, json, os, shutil

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'docs')
SITE = 'https://anatomyduel.com/'

# Reihenfolge ist wichtig: spätere Dateien nutzen, was vorher definiert wurde.
SCRIPTS = [
    'data/muscles.js',      # Muskeldaten aus dem Skript
    'data/figures.js',      # Zuordnung Muskel -> Abbildung
    'core/text.js',         # Textwerkzeuge
    'core/speech.js',       # Vorlesen
    'core/ui.js',           # Icons, Hilfsfunktionen, Kopfzeile
    'learn/questions.js',   # Fragen erzeugen und darstellen
    'learn/quiz.js',        # Lernmodus
    'app/shell.js',         # Startseite, Einstellungen, Design
    'online/firebase.js',   # Firebase laden, Räume
    'online/auth.js',       # Anmelden, Registrieren
    'online/social.js',     # Profile, Freunde, Statistik
    'online/lobby.js',      # Wer ist online, Einladungen, Lobby-Seite
    'online/record.js',     # Spielprotokoll für die Server-Auswertung
    'online/round.js',      # Rundenablauf (Duell und Gruppe)
    'online/duel.js',       # Duell 1 gegen 1
    'online/group.js',      # Gruppen-Lobby
    'online/people.js',     # Freunde, Rangliste, Profilseite
    'main.js',              # Start
]


def read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return f.read()


def write(path, text):
    full = os.path.join(OUT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8') as f:
        f.write(text)


def build():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    shutil.copytree(os.path.join(ROOT, 'public'), OUT)

    js = '\n'.join(read('src/' + p) for p in SCRIPTS)
    html = (read('src/index.html')
            .replace('{{SITE}}', SITE)
            .replace('{{CSS}}', read('src/styles.css'))
            .replace('{{JS}}', js))
    write('index.html', html)

    assets = sorted(os.path.relpath(os.path.join(d, f), OUT).replace(os.sep, '/')
                    for d, _, fs in os.walk(OUT) for f in fs
                    if not f.startswith('.') and f not in ('CNAME', 'og.png', 'maskable-512.png'))
    files = ['./'] + [a for a in assets if a != 'index.html'] + ['index.html']
    digest = hashlib.sha1(html.encode()).hexdigest()[:8]
    write('sw.js', read('src/sw.js')
          .replace('{{CACHE}}', 'anatomyduel-' + digest)
          .replace('{{FILES}}', json.dumps(files)))

    write('robots.txt', f'User-agent: *\nAllow: /\nSitemap: {SITE}sitemap.xml\n')
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n'
          f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>{SITE}</loc>'
          '<changefreq>weekly</changefreq><priority>1.0</priority></url></urlset>\n')
    # Der Server braucht dieselben Muskeldaten, um die richtigen Antworten zu bestimmen
    with open(os.path.join(ROOT, 'functions', 'muscles.js'), 'w', encoding='utf-8') as f:
        f.write("'use strict';\n// Automatisch erzeugt aus src/data/muscles.js – nicht von Hand ändern\n"
                + read('src/data/muscles.js') + '\nmodule.exports = { M };\n')
    print(f'docs/ gebaut · {len(js) // 1024} KB Skript · Cache anatomyduel-{digest}')


if __name__ == '__main__':
    build()
