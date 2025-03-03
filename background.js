console.log("🚀 Background script loaded");

// Global WebSocket connection
let ws = null;
let connectionAttempts = 0;
let currentRoomId = null;
const MAX_RECONNECT_ATTEMPTS = 5;
const SERVER_URL = 'ws://localhost:3000';

// Track connection state
let isConnected = false;

function connectToServer(url = SERVER_URL) {
  if (connectionAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error('Max reconnection attempts reached');
    return;
  }
  
  try {
    console.log('Connecting to server:', url);
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('✅ Connected to server');
      isConnected = true;
      connectionAttempts = 0;
      
      // If we have a room ID, join it immediately
      if (currentRoomId) {
        console.log('🔄 Rejoining room after reconnection:', currentRoomId);
        sendToServer({
          type: 'joinRoom',
          roomId: currentRoomId
        });
      }
      
      // Notify all tabs about connection
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'serverConnectionStatus',
            connected: true 
          }).catch(() => {});
        });
      });
    };
    
    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received from server:', data);
        
        // Handle specific messages from server
        if (data.type === 'videoCommand') {
          // Forward to active tabs
          chrome.tabs.query({active: true}, tabs => {
            tabs.forEach(tab => {
              chrome.tabs.sendMessage(tab.id, {
                type: 'videoControl',
                action: data.eventName,
                time: data.currentTime
              }).catch(() => {});
            });
          });
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };
    
    ws.onclose = () => {
      console.log('🔌 Connection closed, attempting to reconnect...');
      isConnected = false;
      connectionAttempts++;
      
      // Notify tabs about disconnection
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, { 
            type: 'serverConnectionStatus',
            connected: false 
          }).catch(() => {});
        });
      });
      
      // Try to reconnect after delay
      setTimeout(() => {
        connectToServer(url);
      }, 5000);
    };
    
    ws.onerror = error => {
      console.error('WebSocket error:', error);
    };
    
  } catch (err) {
    console.error('Failed to connect:', err);
    connectionAttempts++;
    
    setTimeout(() => {
      connectToServer(url);
    }, 5000);
  }
}

// Make the sendToServer function more robust
function sendToServer(data) {
  if (!ws) {
    console.error('❌ WebSocket not initialized');
    return false;
  }
  
  if (ws.readyState !== WebSocket.OPEN) {
    console.error('❌ WebSocket not connected (state:', ws.readyState, ')');
    return false;
  }
  
  try {
    console.log('📤 Sending to server:', data);
    ws.send(JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('❌ Error sending message:', err);
    return false;
  }
}

// Improve message handling for reliability
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message.type);
  
  if (message.type === 'getConnectionStatus') {
    // Return connection status immediately
    sendResponse({ connected: isConnected });
    return true;
  }
  
  if (message.type === 'joinRoom') {
    currentRoomId = message.roomId;
    console.log('🚪 Trying to join room:', currentRoomId);
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendToServer({
        type: 'joinRoom',
        roomId: message.roomId
      });
      console.log('✅ Join request sent to server');
      sendResponse({ success: true });
    } else {
      console.log('⚠️ WebSocket not ready, reconnecting...');
      connectToServer();
      sendResponse({ success: false, reason: 'reconnecting' });
    }
    return true;
  }
  
  if (message.type === 'videoEvent') {
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendToServer({
        type: 'videoEvent',
        eventName: message.eventName,
        currentTime: message.currentTime
      });
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, reason: 'not_connected' });
    }
  }
  
  return true; // Keep the message channel open for async response
});

// Connect when extension is installed or updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
  connectToServer();
});

// Set up a ping interval to keep connection alive
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    sendToServer({ type: 'ping' });
  }
}, 30000);
