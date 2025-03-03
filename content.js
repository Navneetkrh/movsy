console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let isController = false;
let ignoreEvents = false;
let chatVisible = false;
let username = localStorage.getItem('videoSync_username') || 'Guest_' + Math.floor(Math.random() * 1000);

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
  
  // Listen for sync commands and chat messages
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle video control commands
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
    
    // Handle server connection status updates
    if (message.type === 'serverConnectionStatus') {
      connected = message.connected;
      updateConnectionIndicator(connected);
      console.log('Server connection status:', connected ? 'Connected' : 'Disconnected');
    }
    
    // Handle chat messages
    if (message.type === 'chatMessage') {
      addChatMessage(message.username, message.text, message.isSystem);
    }
  });
  
  // Create the UI immediately
  createEnhancedSyncUI();
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
      roomId: roomId,
      username: username
    }, joinResponse => {
      const error = chrome.runtime.lastError;
      if (error) {
        console.error('❌ Error joining room:', error);
        setTimeout(() => joinRoom(roomId), 5000);
        return;
      }
      
      if (joinResponse && joinResponse.success) {
        console.log('✅ Successfully joined room:', roomId);
        addChatMessage('System', `You joined room ${roomId}`, true);
        
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

// Create enhanced UI with chat
function createEnhancedSyncUI() {
  // Create main container
  const container = document.createElement('div');
  container.id = 'video-sync-container';
  container.className = 'vs-container';
  
  // Create header
  const header = document.createElement('div');
  header.className = 'vs-header';

  const title = document.createElement('h3');
  title.textContent = 'Video Sync';
  
  // Connection indicator
  const connectionIndicator = document.createElement('div');
  connectionIndicator.id = 'connection-indicator';
  connectionIndicator.className = connected ? 'vs-indicator connected' : 'vs-indicator disconnected';
  
  // Expand/collapse button
  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '▼';
  toggleBtn.className = 'vs-btn vs-btn-ghost';
  
  const headerLeft = document.createElement('div');
  headerLeft.className = 'vs-header-left';
  headerLeft.appendChild(connectionIndicator);
  headerLeft.appendChild(title);
  
  header.appendChild(headerLeft);
  header.appendChild(toggleBtn);
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'vs-content';
  
  // Room info
  const roomInfo = document.createElement('div');
  roomInfo.className = 'vs-room-info';
  
  const roomLabel = document.createElement('div');
  roomLabel.textContent = `Room: ${roomId}`;
  roomLabel.className = 'vs-room-label';
  
  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Share Link';
  copyBtn.className = 'vs-btn vs-btn-primary';
  
  roomInfo.appendChild(roomLabel);
  roomInfo.appendChild(copyBtn);
  
  // Username input
  const usernameContainer = document.createElement('div');
  usernameContainer.className = 'vs-form-group';
  
  const usernameLabel = document.createElement('label');
  usernameLabel.textContent = 'Your Name:';
  usernameLabel.className = 'vs-label';
  
  const usernameInput = document.createElement('input');
  usernameInput.type = 'text';
  usernameInput.value = username;
  usernameInput.className = 'vs-input';
  
  usernameContainer.appendChild(usernameLabel);
  usernameContainer.appendChild(usernameInput);
  
  // Chat toggle button
  const chatToggleBtn = document.createElement('button');
  chatToggleBtn.textContent = 'Open Chat';
  chatToggleBtn.className = 'vs-btn vs-btn-success vs-btn-block';
  
  // Chat panel (initially hidden)
  const chatPanel = document.createElement('div');
  chatPanel.id = 'chat-panel';
  chatPanel.className = 'vs-chat-container';
  
  const chatMessages = document.createElement('div');
  chatMessages.id = 'chat-messages';
  chatMessages.className = 'vs-chat-messages';
  
  const chatForm = document.createElement('div');
  chatForm.className = 'vs-chat-form';
  
  const chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.placeholder = 'Type a message...';
  chatInput.className = 'vs-input vs-chat-input';
  
  const sendBtn = document.createElement('button');
  sendBtn.textContent = 'Send';
  sendBtn.className = 'vs-btn vs-btn-primary';
  
  chatForm.appendChild(chatInput);
  chatForm.appendChild(sendBtn);
  
  chatPanel.appendChild(chatMessages);
  chatPanel.appendChild(chatForm);
  
  // Footer
  const footer = document.createElement('div');
  footer.className = 'vs-footer';
  footer.textContent = "Made by Navneet";
  
  // Add all elements to content area
  content.appendChild(roomInfo);
  content.appendChild(usernameContainer);
  content.appendChild(chatToggleBtn);
  content.appendChild(chatPanel);
  
  // Add elements to container
  container.appendChild(header);
  container.appendChild(content);
  container.appendChild(footer);
  
  // Add container to page
  document.body.appendChild(container);
  
  // Make the panel draggable
  makeDraggable(container, header);
  
  // Event handlers
  
  // Copy button
  copyBtn.onclick = () => {
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Share Link';
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy:', err);
      prompt('Copy this sync link:', url);
    });
  };
  
  // Username change
  usernameInput.onchange = () => {
    username = usernameInput.value.trim() || 'Guest';
    localStorage.setItem('videoSync_username', username);
    
    // Notify server about username change
    chrome.runtime.sendMessage({
      type: 'updateUsername',
      username: username,
      roomId: roomId
    });
  };
  
  // Toggle button
  toggleBtn.onclick = () => {
    if (container.style.height === '40px') {
      // Restore previous height
      container.style.height = container.dataset.previousHeight || 'auto';
      toggleBtn.textContent = '▼';
    } else {
      // Minimize
      container.dataset.previousHeight = container.offsetHeight + 'px';
      container.style.height = '40px';
      toggleBtn.textContent = '▲';
    }
  };
  
  // Chat toggle button
  chatToggleBtn.onclick = () => {
    if (chatVisible) {
      chatPanel.style.display = 'none';
      chatToggleBtn.textContent = 'Open Chat';
      chatVisible = false;
    } else {
      chatPanel.style.display = 'flex';
      chatToggleBtn.textContent = 'Close Chat';
      chatVisible = true;
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  };
  
  // Send chat message handlers
  sendBtn.onclick = sendChatMessage;
  chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  };
  
  function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    
    // Send to background script
    chrome.runtime.sendMessage({
      type: 'sendChatMessage',
      roomId: roomId,
      username: username,
      text: message
    });
    
    // Clear input
    chatInput.value = '';
  }
  
  // Store references for later use
  window.videoSync = {
    connectionIndicator,
    chatMessages,
    container
  };
}

// Make element draggable
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    // Get the mouse cursor position at startup
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    // Set the element's new position
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
    
    // Ensure the element stays within viewport bounds
    const rect = element.getBoundingClientRect();
    if (rect.left < 0) element.style.left = '0px';
    if (rect.top < 0) element.style.top = '0px';
    if (rect.right > window.innerWidth) element.style.left = (window.innerWidth - rect.width) + 'px';
    if (rect.bottom > window.innerHeight) element.style.top = (window.innerHeight - rect.height) + 'px';
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

// Update connection indicator
function updateConnectionIndicator(status) {
  if (window.videoSync?.connectionIndicator) {
    window.videoSync.connectionIndicator.className = status ? 'vs-indicator connected' : 'vs-indicator disconnected';
  }
}

// Add chat message to the panel
function addChatMessage(sender, text, isSystem = false) {
  if (!window.videoSync?.chatMessages) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = isSystem ? 'vs-message system' : 'vs-message';
  
  const senderSpan = document.createElement('span');
  senderSpan.className = isSystem ? 'vs-sender system' : 'vs-sender user';
  senderSpan.textContent = isSystem ? sender : sender + ': ';
  
  messageDiv.appendChild(senderSpan);
  messageDiv.appendChild(document.createTextNode(text));
  
  window.videoSync.chatMessages.appendChild(messageDiv);
  window.videoSync.chatMessages.scrollTop = window.videoSync.chatMessages.scrollHeight;
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

// Add debug utility functions
window.videoSyncDebug = {
  checkConnection: () => {
    chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, response => {
      console.log('🔌 Server connection status:', response?.connected ? 'Connected' : 'Disconnected');
    });
  },
  joinRoom: (customRoomId) => {
    const newRoomId = customRoomId || Math.random().toString(36).substring(2, 8);
    window.location.hash = newRoomId;
    joinRoom(newRoomId);
    return `Joining room: ${newRoomId}`;
  }
};
