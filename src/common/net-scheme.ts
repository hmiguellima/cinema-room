export interface ServerToClientEvents {
    joined: (user: User) => void;
    roomFull: () => void;
    hello: (user: User) => void;
    bye: (uid: number) => void;
    makeHost: () => void;
    userUpdate: (user: User) => void;
    videoUpdate:(video: VideoPlayer) => void;
}

export interface ClientToServerEvents {
    userUpdate: (user: User) => void;
    videoUpdate: (video: VideoPlayer) => void;
}

export type Quarternion = {
    x: number;
    y: number;
    z: number;
    w: number;
}

export type PhysicalObject = {
    x: number;
    y: number;
    z: number;
    rotation: Quarternion;
}

export type User = {
    id: number;
    isHost: boolean;
    head?: PhysicalObject;
    leftHand?: PhysicalObject;
    rightHand?: PhysicalObject;
    seat: number;
}

export enum PlayerState {
    Unloaded,
    Loading,
    Playing,
    Paused,
    Seeking,
    Buffering
}

export type StereoLayout = 'mono' | 'stereo-left-right' | 'stereo-top-bottom';

export type FPS = 24 | 30;

export type PlayoutData = {
    name: string;
    streamUri: string;
    drmUri?: string;
    fps: FPS;
    layout: StereoLayout;
    default?: boolean;
};

export type VideoPlayer = {
    state: PlayerState;
    audioVolume?: number;
    position?: number;
    playout?: PlayoutData;
}
