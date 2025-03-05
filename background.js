let socket = null;
let serverUrl = 'ws://movsy-production.up.railway.app';
let currentRoom = null;
let connected = false;
let reconnectTimer = null;
let chatHistory = new Map();
let messageQueue = new Map();

function initialize() {
  console.log('Video Sync initializing...');
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) serverUrl = result.serverUrl;
    connectToServer();
  });
}

function connectToServer() {
  if (socket?.readyState === WebSocket.CONNECTING) return;
  
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  try {
    socket = new WebSocket(serverUrl);
    
    socket.onopen = () => {
      connected = true;
      broadcastConnectionStatus(true);
      if (currentRoom) {
        socket.send(JSON.stringify({
          type: 'joinRoom',
          roomId: currentRoom
        }));
      }
    };
    
    socket.onclose = () => {
      connected = false;
      broadcastConnectionStatus(false);
      reconnectTimer = setTimeout(connectToServer, 5000);
    };
    
    socket.onerror = () => {
      connected = false;
      broadcastConnectionStatus(false);
    };
    
    socket.onmessage = (event) => {
      try {
        handleServerMessage(JSON.parse(event.data));
      } catch (err) {
        console.error('Error handling message:', err);
      }
    };
  } catch (err) {
    console.error('Connection error:', err);
    reconnectTimer = setTimeout(connectToServer, 5000);
  }
}

function handleServerMessage(message) {
  console.log('Received server message:', message.type);
  
  switch (message.type) {
    case 'connected':
    case 'roomJoined':
      if (message.roomId) currentRoom = message.roomId;
      break;
      
    case 'videoCommand':
      if (currentRoom) {
        broadcastToTabs({
          type: 'videoControl',
          action: message.eventName === 'seeked' ? 'seek' : message.eventName,
          time: message.currentTime
        });
      }
      break;
      
    case 'chatMessage':
      // Store in chat history
      if (!message.roomId) message.roomId = currentRoom;
      if (message.roomId) {
        if (!chatHistory.has(message.roomId)) {
          chatHistory.set(message.roomId, []);
        }
        
        // Add timestamp if missing
        if (!message.timestamp) {
          message.timestamp = Date.now();
        }
        
        const messages = chatHistory.get(message.roomId);
        messages.push(message);
        
        // Limit history size
        if (messages.length > 100) messages.shift();
        
        // Forward to all tabs
        broadcastToTabs({
          type: 'chatMessage',
          ...message
        });
        
        // Store in local storage
        chrome.storage.local.set({
          [`chat_${message.roomId}`]: messages
        });
      }
      break;
  }
}

function broadcastToTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });
  });
}

function broadcastConnectionStatus(isConnected) {
  broadcastToTabs({
    type: 'serverConnectionStatus',
    connected: isConnected
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message.type);
  
  switch (message.type) {
    case 'getConnectionStatus':
      sendResponse({ connected });
      break;
      
    case 'getCurrentRoom':
      sendResponse({ roomId: currentRoom });
      break;
      
    case 'createRoom':
    case 'joinRoom':
      if (!connected) {
        sendResponse({ success: false, reason: 'Not connected' });
        return true;
      }
      currentRoom = message.roomId;
      socket?.send(JSON.stringify({
        type: 'joinRoom',
        roomId: message.roomId,
        username: message.username
      }));
      sendResponse({ success: true });
      break;
      
    case 'videoEvent':
      if (!currentRoom || !connected) return true;
      socket?.send(JSON.stringify({
        type: 'videoEvent',
        roomId: currentRoom,
        eventName: message.eventName,
        currentTime: message.currentTime
      }));
      break;
      
    case 'getChatHistory':
      const roomId = message.roomId || currentRoom;
      if (!roomId) {
        sendResponse({ messages: [] });
        return true;
      }
      
      // First check memory
      let messages = chatHistory.get(roomId) || [];
      
      // If empty, try loading from storage
      if (messages.length === 0) {
        chrome.storage.local.get([`chat_${roomId}`], (result) => {
          if (result[`chat_${roomId}`]) {
            messages = result[`chat_${roomId}`];
            chatHistory.set(roomId, messages);
          }
          sendResponse({ messages });
        });
        return true;
      }
      
      sendResponse({ messages });
      break;
      
    case 'sendChatMessage':
      if (!currentRoom || !connected) {
        // Queue message for later if disconnected
        if (!messageQueue.has(currentRoom)) {
          messageQueue.set(currentRoom, []);
        }
        messageQueue.get(currentRoom).push(message);
        sendResponse({ success: false, reason: 'Not connected', queued: true });
        return true;
      }
      
      const chatMessage = {
        type: 'chatMessage',
        roomId: message.roomId || currentRoom,
        username: message.username,
        text: message.text,
        timestamp: Date.now()
      };
      
      try {
        // Send to server
        socket.send(JSON.stringify(chatMessage));
        
        // Store locally
        if (!chatHistory.has(chatMessage.roomId)) {
          chatHistory.set(chatMessage.roomId, []);
        }
        chatHistory.get(chatMessage.roomId).push(chatMessage);
        
        // Store in local storage
        chrome.storage.local.set({
          [`chat_${chatMessage.roomId}`]: chatHistory.get(chatMessage.roomId)
        });
        
        sendResponse({ success: true });
      } catch (err) {
        console.error('Failed to send chat message:', err);
        sendResponse({ success: false, error: err.message });
      }
      break;
  }
  
  return true;
});

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive' && socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'ping' }));
  }
});

initialize();
