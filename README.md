# Commander's Edge

A life counter and table companion for Magic: The Gathering Commander pods. It
runs as a mobile web app (installable as a PWA) and works fully offline. With an
optional Base44 backend, each player can also track the game on their own phone.

## Modes

| Mode | Where | Needs a backend? |
| --- | --- | --- |
| **Life counter table**: 2–6 players around one phone | `/Table` | No |
| **Linked game**: everyone on their own phone, plus a shared scoreboard | `/Lobby` → Create linked game | For syncing between phones |
| **Horde Commander**: co-op against a self-running horde deck | `/Lobby` → Horde Commander | For syncing between phones |
| **1v1 remote duel**: Archidekt deck, live board, chat, voice | `/DuelLobby` | Yes |
| **Game history and leaderboard** | `/Stats` | No |

### The table

- Seats face their players around the phone (top, left and right edges). On a
  desktop or in landscape they switch to an upright grid. You can choose either
  under **Menu → Settings → Seat orientation**.
- Tap the left or right half of a seat to lose or gain 1 life. Hold to repeat;
  after about a second it steps by 5. Taps in quick succession merge into one
  change and one undo step.
- Each seat tracks commander damage per opponent (21 is lethal, and it lowers
  life unless you switch that off), poison (10 is lethal), energy, experience,
  rad, storm, treasure and commander tax.
- Turn order, a per-turn clock, a random first-player spinner, monarch,
  initiative and concede.
- Type a commander's name (Scryfall autocomplete) and the seat uses its art as
  the background.
- Undo works across every game action. The game saves to the device on every
  change, so a refresh or a locked phone doesn't lose it.
- When one player is left, a victory screen appears and the game is saved to
  history. Undoing a mistaken win removes that entry again.
- Also: card lookup (shows a card to the table), dice and a coin, and the
  screen stays on while a table is open.

## Live site

Every push to `main` deploys to GitHub Pages through
`.github/workflows/pages.yml`: https://ammnch.github.io/Commanders-Edge/

To turn it on once: repo **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest: table rules, local DB, Archidekt parsing
npm run lint
npm run build
```

### Offline vs. online

The app picks its backend in `src/api/backend.js`:

- **Offline (default):** with no Base44 app configured, data lives in
  `localStorage`. Linked games still sync between tabs of the same browser
  (BroadcastChannel), which is handy for testing. Archidekt and Scryfall are
  called directly from the browser.
- **Online (Base44):** set the variables below and linked, Horde and duel games
  sync between phones in real time. AI card search (by description or photo) is
  only available here.

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=https://your-app.base44.app
```

Add `?local=1` to any URL to force offline mode on a device, and `?local=0` to
go back to online.

The Base44 entities used are `GameSession`, `DuelGame`, `HordeDeck` and
`WebRTCSignal`. The backend function is `base44/functions/fetchArchidektDeck`.

### Layout

```
src/
  api/backend.js          # chooses Base44 or local storage; patchDoc() read-modify-write
  lib/table.js            # pure table rules engine (reducer, win detection, stats)
  lib/localDb.js          # offline entity store with cross-tab events
  lib/archidekt.js        # deck import/parsing in the browser (mirrors the backend function)
  lib/seats.js            # seat layouts for 2–6 players
  components/table/       # table UI: seats, setup, menu, victory screen
  pages/                  # Lobby, Table, Stats, PlayerView, Scoreboard, Horde, Duel
public/sw.js              # offline service worker (production builds only)
```
