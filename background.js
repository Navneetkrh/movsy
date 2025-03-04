console.log("🚀 Background script loaded");

// Global state
let serverConnection = null;
let currentRoomId = null;
let connectionStatus = false;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let username = '';

// Server URL (can be overridden in options)
let serverUrl = 'ws://localhost:3000';

// Store recent chat messages per room
const chatHistory = new Map();

// Initialize on extension load
function initialize() {
  console.log('Video Sync background script initializing...');
  
  // Load saved settings
  chrome.storage.sync.get(['serverUrl', 'username'], (items) => {
    if (items.serverUrl) {
      serverUrl = items.serverUrl;
    }
    
    if (items.username) {
      username = items.username;
    }
    
    // Connect to server
    connectToServer();
  });
}

// Connect to WebSocket server
function connectToServer() {
  if (serverConnection) {
    serverConnection.close();
  }
  
  try {
    console.log(`Connecting to server: ${serverUrl}`);
    serverConnection = new WebSocket(serverUrl);
    
    // Connection opened
    serverConnection.onopen = () => {
      console.log('✅ Connected to video sync server');
      connectionStatus = true;
      reconnectAttempts = 0;
      
      // Broadcast connection status
      broadcastConnectionStatus(true);
      
      // Rejoin room if previously in one
      if (currentRoomId) {
        joinRoom(currentRoomId);
      }
    };
    
    // Listen for messages
    serverConnection.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('📥 Received message:', message);
      
      handleServerMessage(message);
    };
    
    // Connection closed
    serverConnection.onclose = (event) => {
      console.log(`❌ Connection closed: ${event.code} ${event.reason}`);
      connectionStatus = false;
      serverConnection = null;
      
      // Broadcast disconnected status
      broadcastConnectionStatus(false);
      
      // Schedule reconnect
      scheduleReconnect();
    };
    
    // Connection error
    serverConnection.onerror = (error) => {
      console.error('Connection error:', error);
      connectionStatus = false;
      
      // Broadcast disconnected status
      broadcastConnectionStatus(false);
    };
    
  } catch (err) {
    console.error('Failed to connect to server:', err);
    connectionStatus = false;
    
    // Schedule reconnect
    scheduleReconnect();
  }
}

// Schedule reconnect with exponential backoff
function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
  console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts++;
    connectToServer();
  }, delay);
}

// Handle messages from the server
function handleServerMessage(message) {
  // Forward relevant messages to content scripts
  if (message.type === 'videoCommand') {
    // Send command to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'videoControl',
          action: message.eventName,
          time: message.currentTime
        });
      }
    });
  }
  
  // Handle room state
  if (message.type === 'roomState') {
    console.log('📊 Room state update:', message);
  }
  
  // Handle chat messages
  if (message.type === 'chatMessage') {
    // Store message in chat history
    if (currentRoomId) {
      if (!chatHistory.has(currentRoomId)) {
        chatHistory.set(currentRoomId, []);
      }
      
      const roomMessages = chatHistory.get(currentRoomId);
      roomMessages.push({
        username: message.username,
        text: message.text,
        isSystem: message.isSystem,
        timestamp: message.timestamp || Date.now()
      });
      
      // Limit history size
      if (roomMessages.length > 50) {
        roomMessages.shift();
      }
    }
    
    // Forward to content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      }
    });
  }
  
  // Handle member updates
  if (message.type === 'memberUpdate') {
    chrome.runtime.sendMessage({ 
      type: 'memberUpdate',
      memberCount: message.memberCount
    }).catch(() => {
      // Popup might not be open, ignore
    });
  }
}

// Join a room
function joinRoom(roomId) {
  if (!serverConnection || serverConnection.readyState !== WebSocket.OPEN) {
    console.log('Cannot join room: Not connected to server');
    return false;
  }
  
  console.log(`Joining room: ${roomId}`);
  currentRoomId = roomId;
  
  // Send join room command
  serverConnection.send(JSON.stringify({
    type: 'joinRoom',
    roomId: roomId,
    username: username || 'Guest'
  }));
  
  return true;
}

// Request sync state from server
function requestSync() {
  if (!serverConnection || serverConnection.readyState !== WebSocket.OPEN || !currentRoomId) {
    console.log('Cannot request sync: Not connected or no room');
    return false;
  }
  
  serverConnection.send(JSON.stringify({
    type: 'requestSync',
    roomId: currentRoomId
  }));
  
  return true;
}

// Broadcast connection status to all tabs and popup
function broadcastConnectionStatus(connected) {
  // Send to all tabs
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        type: 'serverConnectionStatus',
        connected: connected 
      }).catch(() => {
        // Ignore errors from tabs that don't have content script
      });
    });
  });
  
  // Notify popup if open
  chrome.runtime.sendMessage({ 
    type: 'connectionStatus',
    connected: connected 
  }).catch(() => {
    // Popup might not be open, ignore
  });
}

// Send video event to server
function sendVideoEvent(eventName, currentTime) {
  if (!serverConnection || serverConnection.readyState !== WebSocket.OPEN || !currentRoomId) {
    console.log('Cannot send event: Not connected or no room');
    return false;
  }
  
  serverConnection.send(JSON.stringify({
    type: 'videoEvent',
    eventName: eventName,
    currentTime: currentTime,
    roomId: currentRoomId
  }));
  
  return true;
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  // Get connection status
  if (message.type === 'getConnectionStatus') {
    sendResponse({ connected: connectionStatus });
    return true;
  }
  
  // Get current room
  if (message.type === 'getCurrentRoom') {
    sendResponse({ roomId: currentRoomId });
    return true;
  }
  
  // Join room
  if (message.type === 'joinRoom') {
    const success = joinRoom(message.roomId);
    
    if (message.username) {
      username = message.username;
    }
    
    sendResponse({ 
      success: success,
      reason: success ? 'joined' : 'failed to join, not connected'
    });
    return true;
  }
  
  // Create room (same as joining a new room)
  if (message.type === 'createRoom') {
    const success = joinRoom(message.roomId);
    
    sendResponse({ 
      success: success,
      roomId: message.roomId,
      reason: success ? 'created' : 'failed to create, not connected'
    });
    return true;
  }
  
  // Leave room
  if (message.type === 'leaveRoom') {
    currentRoomId = null;
    sendResponse({ success: true });
    return true;
  }
  
  // Video event
  if (message.type === 'videoEvent') {
    const success = sendVideoEvent(message.eventName, message.currentTime);
    sendResponse({ success: success });
    return true;
  }
  
  // Request sync
  if (message.type === 'requestSync') {
    const success = requestSync();
    sendResponse({ success: success });
    return true;
  }
  
  // Force reconnect
  if (message.type === 'reconnect') {
    connectToServer();
    sendResponse({ success: true });
    return true;
  }
  
  // Update server URL
  if (message.type === 'updateServerUrl') {
    serverUrl = message.url;
    
    // Save to storage
    chrome.storage.sync.set({ serverUrl: serverUrl });
    
    // Reconnect with new URL
    connectToServer();
    
    sendResponse({ success: true });
    return true;
  }
  
  // Update username
  if (message.type === 'updateUsername') {
    username = message.username;
    
    // Save to storage
    chrome.storage.sync.set({ username: username });
    
    // Send update to server if connected and in a room
    if (serverConnection && serverConnection.readyState === WebSocket.OPEN && currentRoomId) {
      serverConnection.send(JSON.stringify({
        type: 'updateUsername',
        username: username,
        roomId: currentRoomId
      }));
    }
    
    sendResponse({ success: true });
    return true;
  }
  
  // Get chat history
  if (message.type === 'getChatHistory') {
    const roomId = message.roomId || currentRoomId;
    const messages = chatHistory.get(roomId) || [];
    sendResponse({ messages });
    return true;
  }
  
  // Send chat message
  if (message.type === 'sendChatMessage') {
    if (!serverConnection || serverConnection.readyState !== WebSocket.OPEN) {
      sendResponse({ success: false, reason: 'not_connected' });
      return true;
    }
    
    const chatMessage = {
      type: 'chatMessage',
      roomId: message.roomId || currentRoomId,
      username: message.username || username,
      text: message.text,
      timestamp: Date.now()
    };
    
    try {
      serverConnection.send(JSON.stringify(chatMessage));
      sendResponse({ success: true });
      
      // Also store locally
      if (!chatHistory.has(chatMessage.roomId)) {
        chatHistory.set(chatMessage.roomId, []);
      }
      chatHistory.get(chatMessage.roomId).push({
        ...chatMessage,
        isLocal: true
      });
    } catch (err) {
      console.error('Error sending chat message:', err);
      sendResponse({ success: false, error: err.message });
    }
    
    return true;
  }
});

// Initialize on load
initialize();
