# CollabDraw — Frontend

Angular frontend for CollabDraw, a real-time collaborative whiteboard with CRDT-based conflict-free sync — draw together with anyone, live, with zero data loss even under lag or reconnects.

**[Live demo →](https://collab-draw-frontend-lake.vercel.app/)**

![CollabDraw demo](./demo.gif)

**Backend repo:** [CollabDraw.Backend](https://github.com/your-username/CollabDraw.Backend) <!-- update with your actual link -->

## What it does

- Create or join a room by ID and draw together instantly, in real time
- Every stroke syncs to all connected users via WebSockets, merged conflict-free using CRDTs (Yjs) — no "last write wins" data loss
- Drawings persist across sessions; late joiners see full room history
- Live cursor presence — see who's drawing and where, in real time
- Undo/redo, adjustable pen size and color, dark mode

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Angular (standalone components) |
| Styling | Tailwind CSS |
| Real-time sync | Yjs (CRDT), `@microsoft/signalr` client |
| Hosting | Vercel |

## How the sync works, client-side

Each browser tab keeps its own local Yjs document representing the canvas. Drawing produces a small binary Yjs update, sent to the backend over SignalR and broadcast to every other client in the room. Incoming updates get applied to the local Yjs doc, which merges them automatically — the canvas re-renders from the doc's current state, not from raw event replay, so ordering and timing never cause desync.

## Running locally

```bash
npm install
ng serve
```

Open `http://localhost:4200`. Requires the [backend](https://github.com/your-username/CollabDraw.Backend) running locally too — see `src/environments/environment.development.ts` for the expected local SignalR URL.

## Deployment

Deployed on Vercel. Build command `ng build`, output directory `dist/CollabDraw.Frontend/browser`. `vercel.json` includes a rewrite rule so client-side routes (e.g. `/room/:id`) resolve correctly instead of 404ing on direct load/refresh. The production SignalR URL is set via `src/environments/environment.ts`.
