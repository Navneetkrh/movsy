console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let ignoreEvents = false;
let chatVisible = true;
let username = localStorage.getItem('videoSync_username') || 'Guest_' + Math.floor(Math.random() * 1000);
let messageHistory = [];

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
      messageHistory.push(message);
      if (chatVisible) {
        addChatMessage(message);
      }
    }
    
    // Handle member updates
    if (message.type === 'memberUpdate') {
      updateMemberCount(message.memberCount);
    }
  });
  
  // Create the UI immediately
  createUI();
}

// Find video element
function findVideoElement() {
  // YouTube specific
  if (window.location.hostname.includes('youtube.com')) {
    return document.querySelector('video.html5-main-video');
  }
  
  // Netflix specific
  if (window.location.hostname.includes('netflix.com')) {
    return document.querySelector('video.VideoPlayer');
  }
  
  // Disney+ specific
  if (window.location.hostname.includes('disneyplus.com')) {
    return document.querySelector('video.btm-media-client-element');
  }
  
  // Prime Video specific
  if (window.location.hostname.includes('primevideo.com') || 
      window.location.hostname.includes('amazon.com')) {
    return document.querySelector('video.webPlayerElement');
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
        addSystemMessage(`You joined room ${roomId}`);
        
        // Update UI with room ID
        const roomIdElement = document.getElementById('vs-room-id');
        if (roomIdElement) {
          roomIdElement.textContent = roomId;
        }
      } else {
        console.log('❌ Failed to join room:', joinResponse?.reason || 'unknown reason');
        setTimeout(() => joinRoom(roomId), 5000);
      }
    });
  });
}

// Create simple UI (reduced version without dependencies)
function createUI() {
  // Create main container
  const container = document.createElement('div');
  container.className = 'vs-overlay';
  container.id = 'video-sync-container';
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.width = '320px';
  container.style.zIndex = '9999';
  container.style.background = 'rgba(255, 255, 255, 0.9)';
  container.style.borderRadius = '12px';
  container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
  container.style.fontFamily = 'Arial, sans-serif';
  container.style.color = '#333';
  container.style.overflow = 'hidden';
  
  // Create header
  const header = document.createElement('div');
  header.style.padding = '10px 15px';
  header.style.background = 'linear-gradient(135deg, #c4b5fd 0%, #ffcba4 100%)';
  header.style.color = 'white';
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.cursor = 'move';
  
  // Title in header
  const title = document.createElement('div');
  title.innerHTML = '✨ Video Sync';
  title.style.fontWeight = 'bold';
  
  // Collapse button
  const collapseBtn = document.createElement('button');
  collapseBtn.innerHTML = '▼';
  collapseBtn.style.background = 'transparent';
  collapseBtn.style.border = 'none';
  collapseBtn.style.color = 'white';
  collapseBtn.style.cursor = 'pointer';
  collapseBtn.style.fontSize = '12px';
  
  header.appendChild(title);
  header.appendChild(collapseBtn);
  
  // Content area
  const content = document.createElement('div');
  content.style.padding = '15px';
  
  // Status section
  const status = document.createElement('div');
  status.style.display = 'flex';
  status.style.alignItems = 'center';
  status.style.marginBottom = '10px';
  status.style.padding = '8px 10px';
  status.style.background = 'rgba(255, 255, 255, 0.5)';
  status.style.borderRadius = '8px';
  status.style.fontSize = '13px';
  
  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'vs-connection-indicator';
  statusIndicator.style.width = '8px';
  statusIndicator.style.height = '8px';
  statusIndicator.style.borderRadius = '50%';
  statusIndicator.style.marginRight = '8px';
  statusIndicator.style.background = connected ? '#34d399' : '#f87171';
  
  const statusText = document.createElement('div');
  statusText.id = 'vs-connection-status';
  statusText.textContent = connected ? 'Connected' : 'Disconnected';
  
  status.appendChild(statusIndicator);
  status.appendChild(statusText);
  
  // Room info
  const roomInfo = document.createElement('div');
  roomInfo.style.textAlign = 'center';
  roomInfo.style.marginBottom = '15px';
  roomInfo.style.padding = '10px';
  roomInfo.style.background = 'rgba(255, 255, 255, 0.6)';
  roomInfo.style.borderRadius = '8px';
  
  const roomIdDisplay = document.createElement('div');
  roomIdDisplay.id = 'vs-room-id';
  roomIdDisplay.textContent = roomId || 'No active room';
  roomIdDisplay.style.fontWeight = 'bold';
  roomIdDisplay.style.marginBottom = '5px';
  roomIdDisplay.style.color = '#8b5cf6';
  
  const memberCountDisplay = document.createElement('div');
  memberCountDisplay.id = 'vs-member-count';
  memberCountDisplay.innerHTML = '👥 <span>0</span> participants';
  memberCountDisplay.style.fontSize = '12px';
  
  roomInfo.appendChild(roomIdDisplay);
  roomInfo.appendChild(memberCountDisplay);
  
  // Chat area
  const chatArea = document.createElement('div');
  chatArea.style.display = 'flex';
  chatArea.style.flexDirection = 'column';
  
  const chatMessages = document.createElement('div');
  chatMessages.id = 'vs-chat-messages';
  chatMessages.style.height = '150px';
  chatMessages.style.overflowY = 'auto';
  chatMessages.style.padding = '10px';
  chatMessages.style.background = 'white';
  chatMessages.style.borderRadius = '8px';
  chatMessages.style.marginBottom = '10px';
  chatMessages.style.fontSize = '13px';
  
  const chatForm = document.createElement('div');
  chatForm.style.display = 'flex';
  chatForm.style.gap = '8px';
  
  const chatInput = document.createElement('input');
  chatInput.id = 'vs-chat-input';
  chatInput.type = 'text';
  chatInput.placeholder = 'Type a message...';
  chatInput.style.flex = '1';
  chatInput.style.padding = '8px 12px';
  chatInput.style.borderRadius = '20px';
  chatInput.style.border = '1px solid #e5e7eb';
  
  const sendButton = document.createElement('button');
  sendButton.textContent = 'Send';
  sendButton.style.padding = '8px 12px';
  sendButton.style.background = '#8b5cf6';
  sendButton.style.color = 'white';
  sendButton.style.border = 'none';
  sendButton.style.borderRadius = '20px';
  sendButton.style.cursor = 'pointer';
  sendButton.style.fontWeight = 'bold';
  
  chatForm.appendChild(chatInput);
  chatForm.appendChild(sendButton);
  
  chatArea.appendChild(chatMessages);
  chatArea.appendChild(chatForm);
  
  // Assemble UI
  content.appendChild(status);
  content.appendChild(roomInfo);
  content.appendChild(chatArea);
  
  container.appendChild(header);
  container.appendChild(content);
  
  // Add to page
  document.body.appendChild(container);
  
  // Make draggable (simplified)
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  
  header.addEventListener('mousedown', (e) => {
    isDragging = true;
    dragOffsetX = e.clientX - container.getBoundingClientRect().left;
    dragOffsetY = e.clientY - container.getBoundingClientRect().top;
    
    // Add visual feedback
    container.style.opacity = '0.8';
  });
  
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const newLeft = e.clientX - dragOffsetX;
      const newTop = e.clientY - dragOffsetY;
      
      // Constrain to viewport
      const maxX = window.innerWidth - container.offsetWidth;
      const maxY = window.innerHeight - container.offsetHeight;
      
      container.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
      container.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
    }
  });
  
  document.addEventListener('mouseup', () => {
    isDragging = false;
    container.style.opacity = '1';
  });
  
  // Toggle collapse
  collapseBtn.addEventListener('click', () => {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      collapseBtn.innerHTML = '▼';
    } else {
      content.style.display = 'none';
      collapseBtn.innerHTML = '▲';
    }
  });
  
  // Send chat message
  function sendChatMessage() {
    const message = chatInput.value.trim();
    if (!message || !roomId) return;
    
    chrome.runtime.sendMessage({
      type: 'sendChatMessage',
      roomId: roomId,
      username: username,
      text: message
    });
    
    chatInput.value = '';
  }
  
  sendButton.onclick = sendChatMessage;
  
  chatInput.onkeypress = (e) => {
    if (e.key === 'Enter') {
      sendChatMessage();
    }
  };
  
  // Set the chat to be visible by default
  chatVisible = true;
}

// Add chat message to UI
function addChatMessage(message) {
  const chatMessages = document.getElementById('vs-chat-messages');
  if (!chatMessages) return;
  
  const msgEl = document.createElement('div');
  
  if (message.isSystem) {
    msgEl.className = 'vs-message system';
    msgEl.textContent = message.text;
  } else {
    // Is this a sent or received message?
    const isSent = message.username === username;
    msgEl.className = `vs-message ${isSent ? 'sent' : 'received'}`;
    
    // Add sender name
    const sender = document.createElement('span');
    sender.className = 'vs-sender';
    sender.textContent = message.username || 'Anonymous';
    
    // Add message text
    const text = document.createElement('span');
    text.textContent = message.text;
    
    // Add timestamp
    if (message.timestamp) {
      const time = document.createElement('span');
      time.className = 'vs-timestamp';
      time.textContent = formatTime(message.timestamp);
      msgEl.appendChild(time);
    }
    
    msgEl.appendChild(sender);
    msgEl.appendChild(document.createElement('br'));
    msgEl.appendChild(text);
  }
  
  chatMessages.appendChild(msgEl);
  scrollChatToBottom();
}

// Add a system message
function addSystemMessage(text) {
  addChatMessage({
    isSystem: true,
    text: text
  });
}

// Format timestamp
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Render all messages in chat history
function renderChatHistory() {
  const chatMessages = document.getElementById('vs-chat-messages');
  if (!chatMessages) return;
  
  // Clear messages
  chatMessages.innerHTML = '';
  
  // Add all messages
  messageHistory.forEach(msg => addChatMessage(msg));
}

// Scroll chat to bottom
function scrollChatToBottom() {
  const chatMessages = document.getElementById('vs-chat-messages');
  if (chatMessages) {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// Update connection indicator
function updateConnectionIndicator(isConnected) {
  const indicator = document.getElementById('vs-connection-indicator');
  const statusText = document.getElementById('vs-connection-status');
  
  if (!indicator || !statusText) return;
  
  if (isConnected) {
    indicator.style.background = '#34d399';
    statusText.textContent = 'Connected to sync server';
  } else {
    indicator.style.background = '#f87171';
    statusText.textContent = 'Disconnected from sync server';
  }
}

// Update member count
function updateMemberCount(count) {
  const memberCountEl = document.getElementById('vs-member-count');
  if (memberCountEl) {
    memberCountEl.querySelector('span').textContent = count || '1';
  }
}

// Initialize video sync
setupVideoSync();