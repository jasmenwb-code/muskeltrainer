/* Cloud Functions:
   - scoreDuel: sobald der Gastgeber ein Duell beendet (games/{gid}/end), wird es auf dem Server ausgewertet.
   - matchRanked: sobald sich jemand für Ranked anstellt (queue/{uid}), sucht der Server einen Gegner. */
'use strict';
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const { processGame } = require('./process');
const { matchQueue } = require('./matchmaking');

admin.initializeApp();
const opts = ref => ({ ref, region: 'europe-west1' });

exports.scoreDuel = onValueCreated(opts('/games/{gid}/end'), event => processGame(admin.database(), event.params.gid));
exports.matchRanked = onValueCreated(opts('/queue/{uid}'), () => matchQueue(admin.database()));
