// Basic background service worker for Video Sync extension

// Global variables
let socket = null;
let serverUrl = 'ws://localhost:3000';
let currentRoom = null;
let connected = false;
let reconnectTimer = null;
let chatHistory = new Map(); // Store chat messages by roomId

// Initialize when service worker starts
function initialize() {
  console.log('Video Sync background script initializing...');
  
  // Get server URL from storage
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrl = result.serverUrl;
      console.log('Using server URL from storage:', serverUrl);
    }
    
    // Connect to server
    connectToServer();
  });
}

// Connect to WebSocket server
function connectToServer() {
  if (socket && socket.readyState === WebSocket.CONNECTING) {
    console.log('Already connecting to server');
    return;
  }
  
  // Clear any reconnect timer
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  console.log('Connecting to server:', serverUrl);
  
  try {
    socket = new WebSocket(serverUrl);
    
    // Socket event handlers
    socket.onopen = () => {
      console.log('Connected to server');
      connected = true;
      
      // Notify any active tabs
      broadcastConnectionStatus(true);
      
      // Rejoin room if we were in one
      if (currentRoom) {
        console.log('Rejoining room:', currentRoom);
        socket.send(JSON.stringify({
          type: 'joinRoom',
          roomId: currentRoom
        }));
      }
      
      // Start ping to keep connection alive
      startPing();
    };
    
    socket.onclose = (event) => {
      console.log('Disconnected from server:', event.code, event.reason);
      connected = false;
      
      // Notify any active tabs
      broadcastConnectionStatus(false);
      
      // Try to reconnect after a delay
      reconnectTimer = setTimeout(connectToServer, 5000);
    };
    
    socket.onerror = (error) => {
      console.error('Socket error');
      connected = false;
      
      // Notify any active tabs
      broadcastConnectionStatus(false);
    };
    
    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (err) {
        console.error('Error parsing server message');
      }
    };
  } catch (err) {
    console.error('Error creating WebSocket');
    
    // Schedule reconnect
    reconnectTimer = setTimeout(connectToServer, 5000);
  }
}

// Handle messages from server
function handleServerMessage(message) {
  console.log('Server message:', message.type);
  
  switch (message.type) {
    case 'connected':
      console.log('Server acknowledged connection');
      break;
      
    case 'roomJoined':
      currentRoom = message.roomId;
      console.log('Joined room:', currentRoom);
      break;
      
    case 'videoCommand':
      // Forward to content scripts
      if (currentRoom) {
        // Translate event names to actions
        const action = message.eventName === 'seeked' ? 'seek' : message.eventName;
        
        broadcastToTabs({
          type: 'videoControl',
          action: action,
          time: message.currentTime
        });
      }
      break;
      
    case 'chatMessage':
      // Store in chat history
      if (currentRoom) {
        if (!chatHistory.has(currentRoom)) {
          chatHistory.set(currentRoom, []);
        }
        chatHistory.get(currentRoom).push(message);
        
        // Forward to tabs
        broadcastToTabs(message);
      }
      break;
      
    case 'memberUpdate':
      // Forward to tabs
      if (currentRoom) {
        broadcastToTabs(message);
      }
      break;
      
    case 'syncState':
      // Respond to requestPlaybackStatus
      broadcastToTabs({
        type: 'syncResponse',
        currentTime: message.currentTime,
        isPlaying: message.isPlaying
      });
      break;
      
    case 'pong':
      // Server responded to ping, connection is alive
      console.log('Received pong from server');
      break;
  }
}

// Broadcast message to all tabs
function broadcastToTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      try {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs that can't receive messages
        });
      } catch (err) {
        // Ignore errors for tabs that can't receive messages
      }
    }
  });
}

// Broadcast connection status to all tabs
function broadcastConnectionStatus(isConnected) {
  broadcastToTabs({
    type: 'serverConnectionStatus',
    connected: isConnected
  });
}

// Keep connection alive with ping
function startPing() {
  // Send ping every 30 seconds
  setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
}

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);
  
  // Handle different message types
  switch (message.type) {
    case 'getConnectionStatus':
      sendResponse({ connected });
      break;
      
    case 'getCurrentRoom':
      sendResponse({ roomId: currentRoom });
      break;
      
    case 'updateServerUrl':
      serverUrl = message.url;
      chrome.storage.sync.set({ serverUrl });
      
      // Reconnect with new URL
      if (socket) {
        socket.close();
      }
      connectToServer();
      break;
      
    case 'createRoom':
    case 'joinRoom':
      if (!connected) {
        sendResponse({ success: false, reason: 'Not connected to server' });
        return true;
      }
      
      currentRoom = message.roomId;
      
      // Send join message to server
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'joinRoom',
          roomId: message.roomId,
          username: message.username
        }));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, reason: 'Socket not open' });
      }
      break;
      
    case 'videoEvent':
      if (!currentRoom || !connected) {
        return true;
      }
      
      // Send video event to server
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'videoEvent',
          roomId: currentRoom,
          eventName: message.eventName,
          currentTime: message.currentTime
        }));
      }
      break;
      
    case 'sendChatMessage':
      if (!currentRoom || !connected) {
        sendResponse({ success: false, reason: 'Not connected or no room' });
        return true;
      }
      
      const chatMessage = {
        type: 'chatMessage',
        roomId: message.roomId,
        username: message.username,
        text: message.text,
        timestamp: Date.now()
      };
      
      // Store in chat history
      if (!chatHistory.has(message.roomId)) {
        chatHistory.set(message.roomId, []);
      }
      chatHistory.get(message.roomId).push(chatMessage);
      
      // Send to server
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(chatMessage));
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, reason: 'Socket not open' });
      }
      break;
      
    case 'getChatHistory':
      const roomMessages = chatHistory.get(message.roomId) || [];
      sendResponse({ messages: roomMessages });
      break;
      
    case 'updateUsername':
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'updateUsername',
          username: message.username,
          roomId: message.roomId
        }));
      }
      break;
      
    case 'requestSync':
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'requestSync',
          roomId: message.roomId
        }));
      }
      break;
      
    case 'requestPlaybackStatus':
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'requestSync',
          roomId: message.roomId
        }));
        // Wait for response from server before responding
        // This is handled in the socket.onmessage event
        // For now, respond with no data
        sendResponse({});
      } else {
        sendResponse({});
      }
      break;
  }
  
  return true; // Keep the message channel open for async responses
});

// Create an alarm for keeping the service worker alive
chrome.alarms.create('keepAlive', {
  periodInMinutes: 1
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('Keep-alive ping');
  }
});

// Start the background script
initialize();
