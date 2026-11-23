ANOMALY CORRIDOR — PROJECT PACKAGE
==================================

STRUCTURE
  index.html, style.css, main.js, lang.js, audio.js, scares.js,
  anomalies.js, character.js        — the game
  LICENSES.txt                      — copyright + third-party licenses (ship it!)
  libs/                             — three.js + examples (see libs/README.txt)
  textures/                         — optional PBR textures
  door.mp3                          — put the door sound here (optional)

HOW TO RUN
  Do not open index.html by double-click (file://): browsers block fetch().
  Run a local server in this folder, for example:
      python -m http.server 8000
  then open http://localhost:8000
  Quality override: ?q=high | ?q=medium | ?q=low

LICENSING CHECKLIST BEFORE SELLING
  [ ] Edit the copyright line in LICENSES.txt (section 1) and in index.html /
      lang.js (credits.game) with your real name or studio name and year.
  [ ] Check the license of "Door Opening Slowly 1" (YodGuard) allows commercial
      use in games; keep proof. If unsure, remove door.mp3 — the game falls
      back to its own synthesized door sound and you delete the credits line.
  [ ] Keep libs/LICENSE-three.js.txt and the license header inside three.min.js.
  [ ] If you add textures, music, fonts or images, add each to LICENSES.txt.
  [ ] Make the game title/art your own (do not copy another game's name, logo,
      art or text). Anomaly-spotting corridor games already exist, so give the
      game its own identity and story.
  [ ] Store receipts / license screenshots for every purchased or downloaded asset.

NOTE: This is general information, not legal advice.
