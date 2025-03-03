console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let isController = false;
let ignoreEvents = false;

// Try to get room ID from URL hash
if (window.location.hash) {
  roomId = window.location.hash.slice(1);
  console.log('Found room ID in URL:', roomId);
  
  // Join the room
  joinRoom(roomId);
}

// Video sync functionality
function setupVideoSync() {
  // Find video element
  const video = findVideoElement();
  if (!video) {
    console.log('No video element found, retrying in 2 seconds');
    setTimeout(setupVideoSync, 2000);
    return;
  }
  
  console.log('Found video element, setting up sync');
  
  // Handle local video events
  video.addEventListener('play', () => {
    if (ignoreEvents) return;
    
    console.log('Video played at:', video.currentTime);
    chrome.runtime.sendMessage({
      type: 'videoEvent',
      eventName: 'play',
      currentTime: video.currentTime
    });
  });
  
  video.addEventListener('pause', () => {
    if (ignoreEvents) return;
    
    console.log('Video paused at:', video.currentTime);
    chrome.runtime.sendMessage({
      type: 'videoEvent',
      eventName: 'pause',
      currentTime: video.currentTime
    });
  });
  
  video.addEventListener('seeked', () => {
    if (ignoreEvents) return;
    
    console.log('Video seeked to:', video.currentTime);
    chrome.runtime.sendMessage({
      type: 'videoEvent',
      eventName: 'seeked',
      currentTime: video.currentTime
    });
  });
  
  // Listen for sync commands
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'videoControl') {
      console.log('Received control command:', message);
      
      // Set flag to ignore our own events
      ignoreEvents = true;
      
      // Execute command
      try {
        if (message.action === 'play') {
          if (Math.abs(video.currentTime - message.time) > 0.5) {
            video.currentTime = message.time;
          }
          video.play().catch(err => {
            console.error('Error playing video:', err);
          });
        } else if (message.action === 'pause') {
          video.currentTime = message.time;
          video.pause();
        } else if (message.action === 'seeked') {
          video.currentTime = message.time;
        }
      } catch (err) {
        console.error('Error executing command:', err);
      }
      
      // Reset flag after a short delay
      setTimeout(() => {
        ignoreEvents = false;
      }, 500);
    }
    
    if (message.type === 'serverConnectionStatus') {
      connected = message.connected;
      // Update UI or state if needed
      console.log('Server connection status:', connected ? 'Connected' : 'Disconnected');
    }
  });
  
  // Create simple UI
  createSyncUI();
}

// Find video element
function findVideoElement() {
  // YouTube specific
  if (window.location.hostname.includes('youtube.com')) {
    return document.querySelector('video.html5-main-video');
  }
  
  // General video element
  return document.querySelector('video');
}

// Join a room with improved reliability
function joinRoom(id) {
  roomId = id;
  console.log('🚪 Joining room:', roomId);
  
  // Check connection status first
  chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, connectionResponse => {
    if (!connectionResponse || !connectionResponse.connected) {
      console.log('⚠️ Server not connected, waiting before joining room...');
      setTimeout(() => joinRoom(roomId), 3000);
      return;
    }
    
    // Now try to join the room
    chrome.runtime.sendMessage({
      type: 'joinRoom',
      roomId: roomId
    }, joinResponse => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('❌ Error joining room:', error);
        setTimeout(() => joinRoom(roomId), 5000);
        return;
      }
      
      if (joinResponse && joinResponse.success) {
        console.log('✅ Successfully joined room:', roomId);
        
        // Request sync after successful join
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'requestSync',
            roomId: roomId
          });
        }, 1000);
      } else {
        console.log('❌ Failed to join room:', joinResponse?.reason || 'unknown reason');
        setTimeout(() => joinRoom(roomId), 5000);
      }
    });
  });
}

// Create simple UI for room sharing
function createSyncUI() {
  // Create container
  const container = document.createElement('div');
  container.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 10px;
    border-radius: 5px;
    z-index: 9999;
    font-family: Arial, sans-serif;
  `;
  
  // Create room info
  const roomInfo = document.createElement('div');
  roomInfo.textContent = roomId ? `Room: ${roomId}` : 'Not in a room';
  container.appendChild(roomInfo);
  
  // Create share button
  const shareBtn = document.createElement('button');
  shareBtn.textContent = 'Share Link';
  shareBtn.style.cssText = `
    background: #4CAF50;
    border: none;
    color: white;
    padding: 5px 10px;
    margin-top: 5px;
    cursor: pointer;
    border-radius: 3px;
  `;
  
  shareBtn.onclick = () => {
    // Generate URL with room ID
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${roomId}`;
    
    // Copy to clipboard
    navigator.clipboard.writeText(url).then(() => {
      alert('Sync link copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      prompt('Copy this sync link:', url);
    });
  };
  
  container.appendChild(shareBtn);
  
  // Add to page
  document.body.appendChild(container);
}

// Add debug utility functions
function checkConnectionStatus() {
  chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, response => {
    console.log('🔌 Server connection status:', response?.connected ? 'Connected' : 'Disconnected');
  });
}

// Add global error handler
window.addEventListener('error', event => {
  console.error('🔥 Global error:', event.error);
});

// Make it easier to manually join a room from console
window.joinSyncRoom = function(customRoomId) {
  const newRoomId = customRoomId || Math.random().toString(36).substring(2, 8);
  window.location.hash = newRoomId;
  joinRoom(newRoomId);
  return `Joining room: ${newRoomId}`;
}

// Start syncing
window.addEventListener('load', () => {
  setTimeout(setupVideoSync, 1000);
});

// If no room ID, generate one
if (!roomId) {
  roomId = Math.random().toString(36).substring(2, 8);
  window.location.hash = roomId;
  console.log('Generated room ID:', roomId);
}
