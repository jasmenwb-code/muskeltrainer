#!/usr/bin/env bash
# Veröffentlicht die Server-Auswertung (Cloud Function) und die Datenbank-Regeln.
# Gedacht für die Google Cloud Shell (dort ist man schon angemeldet):
#   git clone https://github.com/jasmenwb-code/muskeltrainer.git && cd muskeltrainer && bash deploy-server.sh
set -euo pipefail
cd "$(dirname "$0")"
PROJECT=muskeltrainer-cfb7e
echo "▶ Pakete für die Server-Funktion installieren …"
(cd functions && npm install --omit=dev --no-audit --no-fund)
if ! npx -y firebase-tools@13 projects:list >/dev/null 2>&1; then
  echo "▶ Bitte bei Firebase anmelden (Link öffnen, Code hier einfügen):"
  npx -y firebase-tools@13 login --no-localhost
fi
echo "▶ Funktion und Regeln veröffentlichen (beim ersten Mal 3–5 Minuten) …"
npx -y firebase-tools@13 deploy --only functions,database --project "$PROJECT" --force
echo "✓ Fertig: Duelle werden jetzt auf dem Server gewertet."
