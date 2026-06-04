## Why

Cinema room sessions currently have no playback synchronisation between users — each client plays independently, so guests joining an active session are out of sync with the host. This change establishes a master/follower model so that all viewers watch together in real time.

## What Changes

- The first user to create a session becomes the **master** and retains full playback control (play, pause, seek).
- Guests who join an existing session enter **follow mode**: their player mirrors the master's state automatically.
- The master player broadcasts playback state updates (position, `PlayerState`) to the server, which relays them to all followers.
- Follower clients receive state updates and apply them (seek to position, play/pause) without exposing manual controls.
- When the master disconnects, the next connected user is promoted to master (server already handles host promotion via `makeHost`); that user exits follow mode and gains playback control.

## Capabilities

### New Capabilities
- `playback-sync`: Real-time synchronisation of video playback state between master and follower clients, including position, play/pause, and buffering/stalled state.

### Modified Capabilities

## Impact

- `src/client/index.ts` — wire up player event listeners; send `videoUpdate` to server on state change; listen for `videoUpdate` from server and apply to local player when in follow mode.
- `src/client/cinema-session.ts` — accept a `isFollower` flag; disable controller play/pause/seek actions in follow mode; expose a method to apply an incoming `VideoPlayer` state snapshot.
- `src/common/net-scheme.ts` — `VideoPlayer.position` already exists; no breaking schema changes required.
- `src/server/main.ts` — `handleVideoUpdate` already relays `videoUpdate` to all clients; server needs to send the current `videoState` snapshot to a newly joined user so they can seek to the correct position immediately.
