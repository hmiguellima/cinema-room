import path from 'path';
import express from 'express';
import http from 'http';
import { Server, Socket} from 'socket.io';
import { ServerToClientEvents, ClientToServerEvents, User, VideoPlayer } from '../common/net-scheme';

import https from 'https';
import fs from 'fs';

function findSeat(): number {
    for (let i = 0; i < MAX_USERS; i++) {
        if (!seatMap[i]) {
            return i + 1;
        };
    }
    return 0;
}

function handleDisconnect(user: User) {
    seatMap[user.seat - 1] = 0;
    users = users.filter(u => u.id !== user.id);

    if (users.length === 0) {
        return;
    }

    // Broadcast user left
    io.emit('bye', user.id);
    if (user.isHost) {
        const newHost = users[0];
        newHost.isHost = true;
        // broadcast new host id to all sockets
        io.emit('hello', newHost);
        console.log('host disconnected', user.id, 'new host', newHost.id);
    } else {
        console.log('guest disconnected', user.id);
    }
}

function handleUserUpdate(updatedUser: User) {
    const existingUser = users.find(u => u.id === updatedUser.id);

    if (existingUser) {
        if (updatedUser.leftHand) {
            existingUser.leftHand = updatedUser.leftHand;
        }
        if (updatedUser.rightHand) {
            existingUser.rightHand = updatedUser.rightHand;
        }
        existingUser.head = updatedUser.head;
        io.emit('userUpdate', existingUser);
    } else {
        console.warn('update from non existing user', updatedUser.id);
    }
}

function handleVideoUpdate(updatedVideo: VideoPlayer) {
    io.emit('videoUpdate', updatedVideo);
}

function setupNewUser(socket: Socket<ClientToServerEvents, ServerToClientEvents, {}, {}>) {
    if (users.length < MAX_USERS) {
        const user: User = {
            id: uid++,
            isHost: users.length === 0,
            seat: findSeat(),
        };
        users.push(user);

        socket.on('disconnect', handleDisconnect.bind(undefined, user));
        socket.on('userUpdate', handleUserUpdate);
        socket.on('videoUpdate', handleVideoUpdate);
    
        socket.broadcast.emit('joined', user);
        socket.emit('hello', user);

        console.log('a user connected', user.id);
    } else {
        // socket.emit('roomFull');
    }
}

let uid = 1;

let users: Array<User> = [];
const seatMap: Array<number> = [];

const MAX_USERS = 2;
const PORT = process.env.PORT || 3000;
const HTML_FOLDER = '../../dist';
const INDEX = path.join(__dirname, HTML_FOLDER, 'index.html');

// define routes and socket
const app = express();

const isHttps = Boolean(process.env.HTTPS);

let server;
if (isHttps) {
  const httpsOption = {
    key: fs.readFileSync("./certs/clients_dev_peacocktv_com.key"),
    cert: fs.readFileSync(`./certs/clients_dev_peacocktv_com.pem`),
  };

  console.log("Is https: ", Boolean(isHttps));
  server = https.createServer(httpsOption, app);
  server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
  });
} else {
  server = http.createServer(app);
  server.listen(PORT, () => {
    console.log(`listening on *:${PORT}`);
  });
}

// define routes and socket
app.get("/", function (req, res) {
  res.sendFile(INDEX);
});

const staticAssetsHandler = express.static(path.join(__dirname, HTML_FOLDER));
app.use('/', staticAssetsHandler);

const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, {}>(server);

io.on('connection', setupNewUser);
