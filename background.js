console.log("🚀 Background script loaded");

// Global state
let serverConnection = null;
let currentRoomId = null;
let connectionStatus = false;
let reconnectAttempts = 0;
let reconnectTimeout = null;
let username = '';

// Server URL (can be overridden via options)
let serverUrl = 'ws://localhost:3000';

// Store recent chat messages per room
const chatHistory = new Map();

// Store room playback states (from server)
const roomPlaybackStates = {};

// Initialize on extension load
function initialize() {
  console.log('Video Sync background script initializing...');
  chrome.storage.sync.get(['serverUrl', 'username'], (items) => {
    if (items.serverUrl) {
      serverUrl = items.serverUrl;
    }
    if (items.username) {
      username = items.username;
    }
    connectToServer();
  });
}

// Connect to the WebSocket server
function connectToServer() {
  if (serverConnection) {
    serverConnection.close();
  }
  try {
    console.log(`Connecting to server: ${serverUrl}`);
    serverConnection = new WebSocket(serverUrl);
    serverConnection.onopen = () => {
      console.log('✅ Connected to video sync server');
      connectionStatus = true;
      reconnectAttempts = 0;
      broadcastConnectionStatus(true);
      if (currentRoomId) {
        joinRoom(currentRoomId);
      }
    };
    serverConnection.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('📥 Received message:', message);
      handleServerMessage(message);
    };
    serverConnection.onclose = (event) => {
      console.log(`❌ Connection closed: ${event.code} ${event.reason}`);
      connectionStatus = false;
      serverConnection = null;
      broadcastConnectionStatus(false);
      scheduleReconnect();
    };
    serverConnection.onerror = (error) => {
      console.error('Connection error:', error);
      connectionStatus = false;
      broadcastConnectionStatus(false);
    };
  } catch (err) {
    console.error('Failed to connect to server:', err);
    connectionStatus = false;
    scheduleReconnect();
  }
}

// Schedule reconnect with exponential backoff
function scheduleReconnect() {
  if (reconnectTimeout) clearTimeout(reconnectTimeout);
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
  console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts + 1})`);
  reconnectTimeout = setTimeout(() => {
    reconnectAttempts++;
    connectToServer();
  }, delay);
}

// Handle messages from the server, including updating room playback state
function handleServerMessage(message) {
  if (message.type === 'videoCommand') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'videoControl',
          action: message.eventName,
          time: message.currentTime
        });
      }
    });
    // Update local playback state for the room
    if (currentRoomId) {
      roomPlaybackStates[currentRoomId] = {
        currentTime: message.currentTime,
        isPlaying: message.eventName === 'play',
        lastUpdated: Date.now()
      };
    }
  }
  if (message.type === 'roomState') {
    console.log('📊 Room state update:', message);
  }
  if (message.type === 'chatMessage') {
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
      if (roomMessages.length > 50) roomMessages.shift();
    }
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, message);
      }
    });
  }
  if (message.type === 'memberUpdate') {
    chrome.runtime.sendMessage({
      type: 'memberUpdate',
      memberCount: message.memberCount
    }).catch(() => {});
  }
  // If the server sends an explicit sync state, update local state.
  if (message.type === 'syncState') {
    if (message.roomId) {
      roomPlaybackStates[message.roomId] = {
        currentTime: message.currentTime,
        isPlaying: message.isPlaying,
        lastUpdated: Date.now()
      };
      // Forward the sync state to the content script
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'syncResponse',
            currentTime: message.currentTime,
            isPlaying: message.isPlaying
          });
        }
      });
    }
  }
}

// Join a room by sending a message to the server
function joinRoom(roomId) {
  if (!serverConnection || serverConnection.readyState !== WebSocket.OPEN) {
    console.log('Cannot join room: Not connected to server');
    return false;
  }
  console.log(`Joining room: ${roomId}`);
  currentRoomId = roomId;
  serverConnection.send(JSON.stringify({
    type: 'joinRoom',
    roomId: roomId,
    username: username || 'Guest'
  }));
  return true;
}

// Request sync state from the server
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
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        type: 'serverConnectionStatus',
        connected: connected 
      }).catch(() => {});
    });
  });
  chrome.runtime.sendMessage({ 
    type: 'connectionStatus',
    connected: connected 
  }).catch(() => {});
}

// Send video event to the server
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

// Listen for messages from other extension parts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  if (message.type === 'getConnectionStatus') {
    sendResponse({ connected: connectionStatus });
    return true;
  }
  if (message.type === 'getCurrentRoom') {
    sendResponse({ roomId: currentRoomId });
    return true;
  }
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
  if (message.type === 'createRoom') {
    const success = joinRoom(message.roomId);
    sendResponse({ 
      success: success,
      roomId: message.roomId,
      reason: success ? 'created' : 'failed to create, not connected'
    });
    return true;
  }
  if (message.type === 'leaveRoom') {
    currentRoomId = null;
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'videoEvent') {
    const success = sendVideoEvent(message.eventName, message.currentTime);
    sendResponse({ success: success });
    if (!currentRoomId) return true;
    if (!roomPlaybackStates[currentRoomId]) {
      roomPlaybackStates[currentRoomId] = {};
    }
    roomPlaybackStates[currentRoomId].currentTime = message.currentTime;
    roomPlaybackStates[currentRoomId].lastUpdated = Date.now();
    roomPlaybackStates[currentRoomId].isPlaying = (message.eventName === 'play');
    return true;
  }
  if (message.type === 'requestSync') {
    const success = requestSync();
    sendResponse({ success: success });
    return true;
  }
  if (message.type === 'reconnect') {
    connectToServer();
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'updateServerUrl') {
    serverUrl = message.url;
    chrome.storage.sync.set({ serverUrl: serverUrl });
    connectToServer();
    sendResponse({ success: true });
    return true;
  }
  if (message.type === 'updateUsername') {
    username = message.username;
    chrome.storage.sync.set({ username: username });
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
  if (message.type === 'getChatHistory') {
    const roomId = message.roomId || currentRoomId;
    const messages = chatHistory.get(roomId) || [];
    sendResponse({ messages });
    return true;
  }
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
  if (message.type === 'requestPlaybackStatus') {
    // Return the stored playback state from the server (if available)
    const roomId = message.roomId || getCurrentRoomId();
    const playbackState = roomPlaybackStates[roomId];
    if (playbackState) {
      const isFresh = (Date.now() - playbackState.lastUpdated) < 10 * 60 * 1000;
      if (isFresh) {
        let adjustedTime = playbackState.currentTime;
        if (playbackState.isPlaying) {
          const secondsSinceUpdate = (Date.now() - playbackState.lastUpdated) / 1000;
          adjustedTime += secondsSinceUpdate;
        }
        sendResponse({
          currentTime: adjustedTime,
          isPlaying: playbackState.isPlaying
        });
        return true;
      }
    }
    sendResponse({
      success: false,
      reason: 'No recent playback information available'
    });
    return true;
  }
  return true;
});

// Helper function to get current room ID
function getCurrentRoomId() {
  return currentRoomId;
}

// Keep-alive alarm to prevent background suspension
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    if (serverConnection && serverConnection.readyState === WebSocket.OPEN) {
      serverConnection.send(JSON.stringify({ type: 'ping' }));
    }
  }
});

// Initialize the background script
initialize();
