const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store rooms and connected clients
const rooms = new Map();
const clients = new Map();
// Store playback state for each room: { currentTime, isPlaying, lastUpdated }
const roomPlaybackState = new Map();

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: rooms.size,
    connections: clients.size
  });
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  const clientId = generateId();
  console.log(`Client connected: ${clientId}`);
  
  clients.set(ws, {
    id: clientId,
    roomId: null,
    username: `Guest_${clientId.substring(0, 5)}`
  });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  ws.on('close', () => {
    const client = clients.get(ws);
    console.log(`Client disconnected: ${client?.id || 'unknown'}`);
    if (client && client.roomId) {
      leaveRoom(ws, client.roomId);
    }
    clients.delete(ws);
  });
  
  ws.send(JSON.stringify({
    type: 'connected',
    clientId: clientId
  }));
});

// Handle incoming messages
function handleMessage(ws, message) {
  const client = clients.get(ws);
  if (!client) return;
  
  console.log(`Received message type: ${message.type} from client: ${client.id}`);
  
  switch (message.type) {
    case 'joinRoom':
      joinRoom(ws, message.roomId, message.username);
      break;
    case 'leaveRoom':
      leaveRoom(ws, client.roomId);
      break;
    case 'updateUsername':
      updateUsername(ws, message.username);
      break;
    case 'videoEvent':
      // Update playback state for the room
      if (client.roomId) {
        const currentState = roomPlaybackState.get(client.roomId) || {};
        roomPlaybackState.set(client.roomId, {
          currentTime: message.currentTime,
          isPlaying: message.eventName === 'play',
          lastUpdated: Date.now()
        });
      }
      broadcastToRoom(client.roomId, {
        type: 'videoCommand',
        eventName: message.eventName,
        currentTime: message.currentTime,
        senderId: client.id
      }, ws);
      break;
    case 'chatMessage':
      if (!message.timestamp) {
        message.timestamp = Date.now();
      }
      broadcastToRoom(client.roomId, {
        type: 'chatMessage',
        username: client.username,
        text: message.text,
        timestamp: message.timestamp
      });
      break;
    case 'requestSync':
      // Instead of asking another client, send stored state if available
      if (client.roomId && roomPlaybackState.has(client.roomId)) {
        const state = roomPlaybackState.get(client.roomId);
        ws.send(JSON.stringify({
          type: 'syncState',
          roomId: client.roomId,
          currentTime: state.currentTime,
          isPlaying: state.isPlaying
        }));
      } else {
        // Fallback: ask another client if available
        for (const otherWs of rooms.get(client.roomId) || []) {
          if (otherWs !== ws) {
            otherWs.send(JSON.stringify({
              type: 'syncRequest',
              requesterId: client.id
            }));
            break;
          }
        }
      }
      break;
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;
  }
}

// Join a room
function joinRoom(ws, roomId, username) {
  const client = clients.get(ws);
  if (!client) return;
  
  if (username) {
    client.username = username;
  }
  
  if (client.roomId && client.roomId !== roomId) {
    leaveRoom(ws, client.roomId);
  }
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  const room = rooms.get(roomId);
  room.add(ws);
  client.roomId = roomId;
  
  console.log(`Client ${client.id} joined room ${roomId} | Members: ${room.size}`);
  
  ws.send(JSON.stringify({
    type: 'roomJoined',
    roomId: roomId
  }));
  
  broadcastToRoom(roomId, {
    type: 'chatMessage',
    isSystem: true,
    text: `${client.username} joined the room`
  });
  
  broadcastToRoom(roomId, {
    type: 'memberUpdate',
    memberCount: room.size
  });
}

// Leave a room
function leaveRoom(ws, roomId) {
  if (!roomId || !rooms.has(roomId)) return;
  
  const client = clients.get(ws);
  if (!client) return;
  
  const room = rooms.get(roomId);
  room.delete(ws);
  
  console.log(`Client ${client.id} left room ${roomId} | Members: ${room.size}`);
  
  if (room.size === 0) {
    rooms.delete(roomId);
    roomPlaybackState.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  } else {
    broadcastToRoom(roomId, {
      type: 'chatMessage',
      isSystem: true,
      text: `${client.username} left the room`
    });
    broadcastToRoom(roomId, {
      type: 'memberUpdate',
      memberCount: room.size
    });
  }
  
  client.roomId = null;
}

// Update username
function updateUsername(ws, username) {
  const client = clients.get(ws);
  if (!client || !username) return;
  
  const oldUsername = client.username;
  client.username = username;
  
  if (client.roomId && rooms.has(client.roomId)) {
    broadcastToRoom(client.roomId, {
      type: 'chatMessage',
      isSystem: true,
      text: `${oldUsername} is now known as ${username}`
    });
  }
}

// Broadcast a message to all clients in a room
function broadcastToRoom(roomId, message, exclude = null) {
  if (!roomId || !rooms.has(roomId)) return;
  const room = rooms.get(roomId);
  room.forEach((clientWs) => {
    if (clientWs !== exclude && clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify(message));
    }
  });
}

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Video Sync server running on port ${PORT}`);
});
