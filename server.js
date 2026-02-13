// TETRIS BATTLE - Signaling Server
// Deploy free on Railway: railway.app
// Or Render: render.com
// Or paste into glitch.com
//
// Just run: npm install ws && node server.js

const WebSocket = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

const rooms = {}; // roomCode -> { host, guest }

wss.on('connection', ws => {
    ws.on('message', raw => {
        let msg;
        try { msg = JSON.parse(raw); } catch(e) { return; }

        const { type, room, data } = msg;

        if (type === 'host') {
            rooms[room] = { host: ws, guest: null };
            ws.room = room;
            ws.role = 'host';
            ws.send(JSON.stringify({ type: 'waiting' }));
            console.log('Host created room:', room);
        }

        else if (type === 'join') {
            const r = rooms[room];
            if (!r || !r.host) {
                ws.send(JSON.stringify({ type: 'error', msg: 'Room not found' }));
                return;
            }
            r.guest = ws;
            ws.room = room;
            ws.role = 'guest';
            // Tell host a guest arrived
            r.host.send(JSON.stringify({ type: 'guest_joined' }));
            ws.send(JSON.stringify({ type: 'joined' }));
            console.log('Guest joined room:', room);
        }

        // Relay WebRTC signals between host and guest
        else if (type === 'signal') {
            const r = rooms[ws.room];
            if (!r) return;
            const target = ws.role === 'host' ? r.guest : r.host;
            if (target && target.readyState === WebSocket.OPEN) {
                target.send(JSON.stringify({ type: 'signal', data }));
            }
        }

        // Relay game data
        else if (type === 'game') {
            const r = rooms[ws.room];
            if (!r) return;
            const target = ws.role === 'host' ? r.guest : r.host;
            if (target && target.readyState === WebSocket.OPEN) {
                target.send(JSON.stringify({ type: 'game', data }));
            }
        }
    });

    ws.on('close', () => {
        if (!ws.room || !rooms[ws.room]) return;
        const r = rooms[ws.room];
        const other = ws.role === 'host' ? r.guest : r.host;
        if (other && other.readyState === WebSocket.OPEN) {
            other.send(JSON.stringify({ type: 'opponent_left' }));
        }
        delete rooms[ws.room];
        console.log('Room closed:', ws.room);
    });
});

console.log(`Signaling server running on port ${PORT}`);
