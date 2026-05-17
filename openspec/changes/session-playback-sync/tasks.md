## 1. Server — store and relay video state

- [ ] 1.1 Add a `videoState: VideoPlayer | null` variable in `src/server/main.ts` to hold the latest snapshot
- [ ] 1.2 Update `handleVideoUpdate` to save the incoming payload to `videoState` before broadcasting
- [ ] 1.3 In `setupNewUser`, after emitting `hello`, emit `videoUpdate` with the current `videoState` to the new socket only (if `videoState` is not null)

## 2. Client — master broadcasts playback state

- [ ] 2.1 In `src/client/index.ts`, implement `listenToPlayerEvents` to attach listeners on the `videoEl` for `play`, `pause`, `seeking`, `stalled`, and `waiting` events; each handler should call `socket.emit('videoUpdate', ...)` with the current `PlayerState` and `videoEl.currentTime`
- [ ] 2.2 Add a heartbeat `setInterval` (2 s) in `listenToPlayerEvents` that emits `videoUpdate` with `PlayerState.Playing` and `currentTime` only when `currentUser.isHost` is true and the video is playing
- [ ] 2.3 Gate all emissions so they only fire when `currentUser?.isHost === true`

## 3. Client — follow mode in `HomeCinemaSession`

- [ ] 3.1 Add an `isFollower` boolean parameter to the `HomeCinemaSession` constructor
- [ ] 3.2 In `handleControllerEvent`, return early (no-op) when `isFollower` is true for `play` and `pause` events
- [ ] 3.3 Implement a public `applyVideoState(video: VideoPlayer)` method that: seeks if `|currentTime - video.position| > 2`, calls `this.video.play()` for `PlayerState.Playing`, and calls `this.video.pause()` for `PlayerState.Paused` or `PlayerState.Buffering`/`Stalled`

## 4. Client — wire follow mode in `index.ts`

- [ ] 4.1 Pass `!currentUser.isHost` as the `isFollower` argument when constructing `HomeCinemaSession` in `startImmersiveSession`
- [ ] 4.2 In `listenToServer`, handle the `videoUpdate` server event: if `immersiveSession` is active and `!currentUser?.isHost`, call `immersiveSession.applyVideoState(video)`
- [ ] 4.3 Handle master promotion: on `hello` event, if the received user id matches `currentUser.id` and `isHost: true`, update `currentUser.isHost` so subsequent `videoUpdate` events are now sent (not applied)

## 5. Verification

- [ ] 5.1 Open two browser tabs; tab 1 loads and plays a video — confirm tab 2 starts at the same position and plays/pauses in sync
- [ ] 5.2 Seek in tab 1 (master) — confirm tab 2 seeks within 2 seconds
- [ ] 5.3 Close tab 1 — confirm tab 2 receives `hello` with `isHost: true` and controller play/pause actions now work
- [ ] 5.4 Confirm tab 2 (follower) controller play/pause has no effect while in follow mode
