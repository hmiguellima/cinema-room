## ADDED Requirements

### Requirement: Master player broadcasts playback state
The first user in a session (the host, `isHost: true`) SHALL be the master player. The master SHALL emit a `videoUpdate` event to the server whenever playback state changes (play, pause, seek, stall, buffer) and on a periodic heartbeat of no more than 2 seconds, carrying the current `PlayerState` and `position`.

#### Scenario: State change triggers broadcast
- **WHEN** the master's video element emits a `play`, `pause`, `seeking`, `stalled`, or `waiting` event
- **THEN** the client SHALL send a `videoUpdate` message to the server with the current `PlayerState` and `currentTime`

#### Scenario: Heartbeat broadcast during playback
- **WHEN** the master is playing and 2 seconds have elapsed since the last `videoUpdate` was sent
- **THEN** the client SHALL send a `videoUpdate` with `PlayerState.Playing` and the current `currentTime`

### Requirement: Follower player mirrors master state
A guest user (`isHost: false`) SHALL enter follow mode on joining. In follow mode the client SHALL apply every received `videoUpdate` to the local video element: matching play/pause state and seeking when the position drift exceeds 2 seconds.

#### Scenario: Follower receives play update
- **WHEN** a follower receives a `videoUpdate` with `state: PlayerState.Playing`
- **THEN** the follower SHALL call `video.play()` if the video is currently paused

#### Scenario: Follower receives pause update
- **WHEN** a follower receives a `videoUpdate` with `state: PlayerState.Paused`
- **THEN** the follower SHALL call `video.pause()` if the video is currently playing

#### Scenario: Follower corrects position drift
- **WHEN** a follower receives a `videoUpdate` and `|video.currentTime - update.position| > 2`
- **THEN** the follower SHALL seek to `update.position`

#### Scenario: Follower within drift tolerance
- **WHEN** a follower receives a `videoUpdate` and `|video.currentTime - update.position| <= 2`
- **THEN** the follower SHALL NOT seek, allowing natural playback to continue

### Requirement: Follower controls are disabled
In follow mode the user's controller inputs for play, pause, and seek SHALL have no effect on local playback. The immersive session SHALL expose no interactive playback controls to a follower.

#### Scenario: Follower presses play/pause button
- **WHEN** a follower user triggers the play or pause controller action inside `HomeCinemaSession`
- **THEN** the action SHALL be ignored and playback state SHALL remain unchanged

### Requirement: New joiner receives current state immediately
When a new user joins an existing session the server SHALL send the most recent `VideoPlayer` snapshot to that user's socket so they can synchronise before the next heartbeat.

#### Scenario: Guest joins mid-session
- **WHEN** a new socket connects and the server has a stored `videoState` snapshot
- **THEN** the server SHALL emit `videoUpdate` with the current snapshot to that socket before or alongside `hello`

#### Scenario: First user joins empty session
- **WHEN** the first user connects and no `videoState` snapshot exists
- **THEN** the server SHALL NOT emit a `videoUpdate` to that socket

### Requirement: Master promotion restores playback control
When the current master disconnects, the server promotes the next user to host via `hello` with `isHost: true`. That client SHALL exit follow mode and gain full playback control.

#### Scenario: Master disconnects, follower is promoted
- **WHEN** the client receives a `hello` event with `isHost: true` for the current user's id
- **THEN** the client SHALL exit follow mode and re-enable controller play/pause actions

### Requirement: Master updates server state on every broadcast
The server SHALL store the most recently received `videoUpdate` payload so it can be delivered to future joiners.

#### Scenario: Server stores latest video state
- **WHEN** the server receives a `videoUpdate` from the master
- **THEN** the server SHALL update its in-memory `videoState` variable with the new payload and relay it to all other connected clients
