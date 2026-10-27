/* Cloud Function: sobald der Gastgeber ein Duell beendet (games/{gid}/end), wird es auf dem Server ausgewertet. */
'use strict';
const { onValueCreated } = require('firebase-functions/v2/database');
const admin = require('firebase-admin');
const { processGame } = require('./process');

admin.initializeApp();

exports.scoreDuel = onValueCreated({ ref: '/games/{gid}/end', region: 'europe-west1' }, event =>
  processGame(admin.database(), event.params.gid));
