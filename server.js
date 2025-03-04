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
  
  // Store client info
  clients.set(ws, {
    id: clientId,
    roomId: null,
    username: `Guest_${clientId.substring(0, 5)}`
  });
  
  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  });
  
  // Handle disconnection
  ws.on('close', () => {
    const client = clients.get(ws);
    console.log(`Client disconnected: ${client?.id || 'unknown'}`);
    
    // Remove from room if in one
    if (client && client.roomId) {
      leaveRoom(ws, client.roomId);
    }
    
    // Remove client
    clients.delete(ws);
  });
  
  // Send initial connection confirmation
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
      broadcastToRoom(client.roomId, {
        type: 'videoCommand',
        eventName: message.eventName,
        currentTime: message.currentTime,
        senderId: client.id
      }, ws); // Exclude sender
      break;
    
    case 'chatMessage':
      // Add timestamp if not present
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
      requestSync(ws, client.roomId);
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
  
  // Update username if provided
  if (username) {
    client.username = username;
  }
  
  // Leave current room if in one
  if (client.roomId && client.roomId !== roomId) {
    leaveRoom(ws, client.roomId);
  }
  
  // Create room if it doesn't exist
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  
  // Add client to room
  const room = rooms.get(roomId);
  room.add(ws);
  
  // Update client's room
  client.roomId = roomId;
  
  console.log(`Client ${client.id} joined room ${roomId} | Current members: ${room.size}`);
  
  // Notify client
  ws.send(JSON.stringify({
    type: 'roomJoined',
    roomId: roomId
  }));
  
  // Notify all clients in the room about the new member
  broadcastToRoom(roomId, {
    type: 'chatMessage',
    isSystem: true,
    text: `${client.username} joined the room`
  });
  
  // Send member count update
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
  
  // Remove client from room
  room.delete(ws);
  
  console.log(`Client ${client.id} left room ${roomId} | Current members: ${room.size}`);
  
  // Delete room if empty
  if (room.size === 0) {
    rooms.delete(roomId);
    console.log(`Room ${roomId} deleted`);
  } else {
    // Notify others in the room
    broadcastToRoom(roomId, {
      type: 'chatMessage',
      isSystem: true,
      text: `${client.username} left the room`
    });
    
    // Send member count update
    broadcastToRoom(roomId, {
      type: 'memberUpdate',
      memberCount: room.size
    });
  }
  
  // Clear client's room reference
  client.roomId = null;
}

// Update username
function updateUsername(ws, username) {
  const client = clients.get(ws);
  if (!client || !username) return;
  
  const oldUsername = client.username;
  client.username = username;
  
  // Notify room of name change if in a room
  if (client.roomId && rooms.has(client.roomId)) {
    broadcastToRoom(client.roomId, {
      type: 'chatMessage',
      isSystem: true,
      text: `${oldUsername} is now known as ${username}`
    });
  }
}

// Request sync state from a room
function requestSync(ws, roomId) {
  if (!roomId || !rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  
  // Find a client to provide the sync state (first one that's not the requester)
  for (const clientWs of room) {
    if (clientWs !== ws) {
      clientWs.send(JSON.stringify({
        type: 'syncRequest',
        requesterId: clients.get(ws).id
      }));
      break;
    }
  }
}

// Broadcast message to all clients in a room
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
  return Math.random().toString(36).substring(2, 10) + 
         Date.now().toString(36);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Video Sync server running on port ${PORT}`);
});
