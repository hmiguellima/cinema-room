## Context

The app uses Socket.IO for real-time communication. The server already has `videoUpdate` relay logic and host promotion via `makeHost`/`hello`. The client uses Shaka Player (`shaka-player`) on top of an `HTMLVideoElement`. `HomeCinemaSession` controls playback via the video element and controller events.

Currently `listenToPlayerEvents()` and `startImmersiveSession()`'s TODO comments mark where sync logic must live. `VideoPlayer` in `net-scheme.ts` already carries `state`, `position`, and `playout` — the schema is sufficient.

## Goals / Non-Goals

**Goals:**
- Master broadcasts playback state (position, `PlayerState`) periodically and on every state change event.
- Followers receive state and apply it: seek + play/pause, with light drift correction (re-seek if delta > threshold).
- Newly joined followers receive the current state snapshot immediately so they can jump to the right position.
- Master loses controls when it becomes a follower; a newly promoted master gains controls.

**Non-Goals:**
- Frame-accurate sync (sub-100ms accuracy is not required).
- Audio-level sync or adaptive bitrate coordination.
- Handling more than 2 users (server already caps at `MAX_USERS = 2`).
- UI indicators for sync status or latency.

## Decisions

### 1. Broadcast strategy: periodic heartbeat + event-driven updates

Master sends a `videoUpdate` every **2 seconds** (heartbeat) plus immediately on `play`, `pause`, `seeking`, `stalled`, `waiting`, and `timeupdate` (rate-limited to 1 Hz). Follower re-syncs on every received update.

**Alternatives considered:**
- Event-only: cheaper but followers drift silently if events are missed or the connection hiccups. The heartbeat guarantees catch-up.
- Sub-second heartbeat: higher fidelity but unnecessary for a casual cinema room; 2 s is imperceptible.

### 2. Drift correction threshold: 2 seconds

If `|follower.currentTime - master.position| > 2`, the follower seeks. Below that threshold it lets the player drift naturally to avoid disruptive seeks during normal playback.

**Alternatives considered:**
- Always seek: eliminates drift completely but causes constant micro-seeks that interrupt buffered playback.
- Higher threshold (5 s): too loose; guests could be visibly out of sync.

### 3. Follow mode controlled by `isHost` flag from server

`index.ts` already receives the `User` object with `isHost`. Master/follower identity maps directly to this flag. When `hello` fires with `isHost: true` the client is master; with `isHost: false` it is a follower. On `makeHost` / re-`hello` the client transitions.

**Alternatives considered:**
- Separate `role` field: adds schema complexity for no gain since `isHost` already carries this signal.

### 4. Server stores last known `VideoPlayer` state and sends it to new joiners

`setupNewUser` emits `hello` to the new socket. We extend it to also emit a `videoUpdate` with the current `videoState` snapshot (if any) so the follower can seek immediately.

**Alternatives considered:**
- Client requests current state via a separate `getState` event: adds a round trip and requires a request/response pattern that isn't established in this codebase.

### 5. `HomeCinemaSession` receives an `isFollower` parameter; exposes `applyVideoState()`

Rather than duplicating video control logic in `index.ts`, the session class owns the apply-state logic. `handleControllerEvent` becomes a no-op in follower mode. A new public `applyVideoState(video: VideoPlayer)` method handles seeking and play/pause.

## Risks / Trade-offs

- **Seek spam on reconnect** → Mitigated by drift threshold; only seeks when delta > 2 s.
- **Master pauses, follower has already buffered ahead** → After applying pause the follower also seeks to master's position, so on resume they're aligned.
- **Socket.IO message loss** → Heartbeat every 2 s means maximum 2 s of drift before self-correction; acceptable.
- **Shaka Player `seek` during `stalled`/`waiting` state** → Seeking while buffering is safe in Shaka; it re-schedules the buffer window from the new position.

## Migration Plan

No database or persistent state. Deployment is a standard build + server restart. Rollback is reverting the commit and restarting.

## Open Questions

- Should the follower mute its audio when it seeks to resync, to avoid audio artifacts? (Likely yes — mute briefly during seek, then restore.)
