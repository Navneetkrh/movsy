const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

// Create HTTP server
const app = express();
const server = http.createServer(app);

// Configure CORS for HTTP endpoints
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Room storage
const rooms = new Map();

// Track connections
let connectionCount = 0;

// HTTP endpoints
app.get('/health', (req, res) => {
  console.log(`✅ Health check from ${req.ip}`);
  res.json({ status: 'healthy', rooms: rooms.size, connections: connectionCount });
});

app.get('/', (req, res) => {
  res.json({ status: 'Video Sync Server', activeRooms: Array.from(rooms.keys()) });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  connectionCount++;
  const clientId = `client-${connectionCount}`;
  console.log(`🟢 New connection: ${clientId}`);
  
  let currentRoom = null;
  
  // Send welcome message
  ws.send(JSON.stringify({ 
    type: 'welcome', 
    message: 'Connected to Video Sync Server',
    clientId 
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📥 Received from ${clientId}:`, data);

      // Handle ping request
      if (data.type === 'ping') {
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now()
        }));
        return;
      }

      // Handle room joining
      if (data.type === 'joinRoom') {
        const roomId = data.roomId;
        
        // Leave previous room if any
        if (currentRoom) {
          const prevRoom = rooms.get(currentRoom);
          if (prevRoom) {
            prevRoom.members.delete(ws);
            console.log(`👋 ${clientId} left room ${currentRoom}`);
            
            // Broadcast member update to room
            broadcastToRoom(currentRoom, {
              type: 'memberUpdate',
              memberCount: prevRoom.members.size
            }, ws);
          }
        }
        
        // Join new room
        currentRoom = roomId;
        if (!rooms.has(roomId)) {
          rooms.set(roomId, { 
            members: new Set(),
            currentTime: 0,
            paused: true,
            messages: [], // Store recent messages
            users: new Map() // Store user info
          });
          console.log(`🏠 Created new room: ${roomId}`);
        }
        
        const room = rooms.get(roomId);
        room.members.add(ws);
        console.log(`🚪 ${clientId} joined room ${roomId}, total members: ${room.members.size}`);
        
        // Send current state to new member
        ws.send(JSON.stringify({
          type: 'roomState',
          currentTime: room.currentTime,
          paused: room.paused,
          memberCount: room.members.size
        }));
        
        // Broadcast to others
        broadcastToRoom(roomId, {
          type: 'memberUpdate',
          memberCount: room.members.size
        }, ws);
        
        // Store username
        if (data.username) {
          room.users.set(clientId, data.username);
        }
        
        // Send welcome message to room
        broadcastToRoom(roomId, {
          type: 'chatMessage',
          username: 'System',
          text: `${data.username || 'A new user'} joined the room`,
          isSystem: true,
          timestamp: Date.now()
        });
        
        // Send recent message history to new user
        if (room.messages && room.messages.length > 0) {
          ws.send(JSON.stringify({
            type: 'chatHistory',
            messages: room.messages.slice(-20) // Send last 20 messages
          }));
        }
      }

      // Handle video events
      if (data.type === 'videoEvent' && currentRoom) {
        const room = rooms.get(currentRoom);
        if (!room) return;
        
        // Update room state
        if (data.currentTime !== undefined) {
          room.currentTime = data.currentTime;
        }
        
        if (data.eventName === 'play') {
          room.paused = false;
        } else if (data.eventName === 'pause') {
          room.paused = true;
        }
        
        console.log(`📺 Video ${data.eventName} at ${data.currentTime?.toFixed(2) || 0} in room ${currentRoom}`);
        
        // Broadcast to others
        broadcastToRoom(currentRoom, {
          type: 'videoCommand',
          eventName: data.eventName,
          currentTime: data.currentTime,
          sender: clientId
        }, ws);
      }
      
      // Handle sync request
      if (data.type === 'requestSync' && currentRoom) {
        const room = rooms.get(currentRoom);
        if (!room) return;
        
        ws.send(JSON.stringify({
          type: 'syncState',
          currentTime: room.currentTime,
          paused: room.paused
        }));
      }
      
      // Handle chat messages
      if (data.type === 'chatMessage') {
        const room = rooms.get(currentRoom);
        if (!room) return;
        
        const messageData = {
          type: 'chatMessage',
          username: data.username || 'Anonymous',
          text: data.text,
          timestamp: Date.now()
        };
        
        // Store recent messages (keep last 50)
        room.messages.push(messageData);
        if (room.messages.length > 50) {
          room.messages.shift();
        }
        
        console.log(`💬 [Room ${currentRoom}] ${data.username}: ${data.text}`);
        
        // Broadcast to all room members
        broadcastToRoom(currentRoom, messageData);
      }
      
      // Handle username updates
      if (data.type === 'updateUsername') {
        const room = rooms.get(currentRoom);
        if (!room) return;
        
        const oldUsername = room.users.get(clientId) || 'Anonymous';
        room.users.set(clientId, data.username);
        
        console.log(`👤 [Room ${currentRoom}] ${oldUsername} changed name to ${data.username}`);
        
        // Notify room about username change
        broadcastToRoom(currentRoom, {
          type: 'chatMessage',
          username: 'System',
          text: `${oldUsername} is now known as ${data.username}`,
          isSystem: true,
          timestamp: Date.now()
        });
      }
      
    } catch (err) {
      console.error(`❌ Error processing message from ${clientId}:`, err);
    }
  });
  
  ws.on('close', () => {
    console.log(`🔴 Connection closed: ${clientId}`);
    connectionCount--;
    
    // Remove from room
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.members.delete(ws);
        console.log(`👋 ${clientId} left room ${currentRoom}, remaining: ${room.members.size}`);
        
        // Delete empty rooms
        if (room.members.size === 0) {
          rooms.delete(currentRoom);
          console.log(`🧹 Deleted empty room ${currentRoom}`);
        } else {
          // Notify remaining members
          broadcastToRoom(currentRoom, {
            type: 'memberUpdate',
            memberCount: room.members.size
          });
          
          const username = room?.users?.get(clientId) || 'A user';
          
          // Notify room members about user leaving
          if (currentRoom && rooms.has(currentRoom) && room.members.size > 0) {
            broadcastToRoom(currentRoom, {
              type: 'chatMessage',
              username: 'System',
              text: `${username} left the room`,
              isSystem: true,
              timestamp: Date.now()
            });
          }
        }
      }
    }
  });
});

// Helper function to broadcast to room
function broadcastToRoom(roomId, data, exclude = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  const message = JSON.stringify(data);
  room.members.forEach(client => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Log room status periodically
setInterval(() => {
  console.log(`\n📊 Server Status: ${new Date().toLocaleTimeString()}`);
  console.log(`Active rooms: ${rooms.size}`);
  console.log(`Active connections: ${connectionCount}`);
  
  rooms.forEach((room, id) => {
    console.log(`Room ${id}: ${room.members.size} members, time: ${room.currentTime.toFixed(2)}s`);
  });
  console.log('------------------------');
}, 30000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
