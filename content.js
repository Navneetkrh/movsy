console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let isController = false;
let ignoreEvents = false;
let chatVisible = false;
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
  createEnhancedUI();
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
        
        // Request sync after successful join
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'requestSync',
            roomId: roomId
          });
          
          // Request chat history
          chrome.runtime.sendMessage({
            type: 'getChatHistory',
            roomId: roomId
          }, response => {
            if (response && response.messages) {
              messageHistory = response.messages;
              if (chatVisible) {
                renderChatHistory();
              }
            }
          });
        }, 1000);
      } else {
        console.log('❌ Failed to join room:', joinResponse?.reason || 'unknown reason');
        setTimeout(() => joinRoom(roomId), 5000);
      }
    });
  });
}

// Create an enhanced UI with chat
function createEnhancedUI() {
  // Add styles to the page
  const style = document.createElement('style');
  style.textContent = `
    .vs-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 320px;
      background: rgba(28, 28, 30, 0.92);
      color: white;
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      z-index: 9999;
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      transition: all 0.3s ease;
      overflow: hidden;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    
    .vs-container.collapsed {
      height: 40px !important;
    }
    
    .vs-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: linear-gradient(135deg, #34d399 0%, #06b6d4 100%);
      cursor: move;
      height: 40px;
      box-sizing: border-box;
    }
    
    .vs-title {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
    }
    
    .vs-controls {
      display: flex;
      gap: 8px;
    }
    
    .vs-btn {
      background: none;
      border: none;
      color: white;
      padding: 0;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 20px;
      width: 20px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .vs-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.2);
    }
    
    .vs-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px;
      overflow: hidden;
      min-height: 120px;
    }
    
    .vs-section {
      margin-bottom: 16px;
    }
    
    .vs-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .vs-section-title {
      font-size: 13px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.7);
    }
    
    .vs-status {
      display: flex;
      align-items: center;
      padding: 10px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 13px;
    }
    
    .vs-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
    }
    
    .vs-indicator.connected {
      background: linear-gradient(145deg, #34d399, #10b981);
      box-shadow: 0 0 6px rgba(52, 211, 153, 0.7);
    }
    
    .vs-indicator.disconnected {
      background: linear-gradient(145deg, #f87171, #ef4444);
      box-shadow: 0 0 6px rgba(239, 68, 68, 0.7);
    }
    
    .vs-label {
      display: block;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 6px;
    }
    
    .vs-input {
      width: 100%;
      padding: 8px 10px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: white;
      font-family: inherit;
      font-size: 13px;
      margin-bottom: 10px;
    }
    
    .vs-input:focus {
      outline: none;
      border-color: rgba(52, 211, 153, 0.5);
      box-shadow: 0 0 0 2px rgba(52, 211, 153, 0.25);
    }
    
    .vs-room-id {
      font-weight: 600;
      color: #34d399;
      font-size: 14px;
      background: rgba(52, 211, 153, 0.1);
      padding: 6px 10px;
      border-radius: 6px;
      text-align: center;
      margin-bottom: 12px;
      user-select: all;
    }
    
    .vs-tabs {
      display: flex;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
    }
    
    .vs-tab {
      flex: 1;
      padding: 8px;
      text-align: center;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      color: rgba(255, 255, 255, 0.7);
    }
    
    .vs-tab.active {
      background: rgba(52, 211, 153, 0.15);
      color: #34d399;
      font-weight: 500;
    }
    
    .vs-tab:hover:not(.active) {
      background: rgba(255, 255, 255, 0.1);
    }
    
    .vs-tab-content {
      display: none;
      flex: 1;
      overflow: hidden;
    }
    
    .vs-tab-content.active {
      display: flex;
      flex-direction: column;
    }
    
    /* Chat specific styles */
    .vs-chat-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 200px;
    }
    
    .vs-chat-messages {
      flex: 1;
      overflow-y: auto;
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 6px;
      font-size: 13px;
    }
    
    .vs-message {
      padding: 8px 10px;
      border-radius: 8px;
      max-width: 85%;
      word-break: break-word;
      position: relative;
      line-height: 1.3;
    }
    
    .vs-message.system {
      background: rgba(0, 113, 227, 0.1);
      color: rgba(255, 255, 255, 0.7);
      border-left: 2px solid rgba(0, 113, 227, 0.5);
      align-self: center;
      width: 100%;
      text-align: center;
      font-style: italic;
    }
    
    .vs-message.received {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 0 8px 8px 8px;
      align-self: flex-start;
    }
    
    .vs-message.sent {
      background: rgba(52, 211, 153, 0.2);
      border-radius: 8px 0 8px 8px;
      align-self: flex-end;
    }
    
    .vs-sender {
      font-weight: 600;
      margin-right: 5px;
      font-size: 12px;
      color: #34d399;
    }
    
    .vs-sender.system {
      color: #0071e3;
    }
    
    .vs-timestamp {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.5);
      position: absolute;
      bottom: 2px;
      right: 6px;
    }
    
    .vs-form {
      display: flex;
      gap: 8px;
    }
    
    .vs-chat-input {
      flex: 1;
      padding: 8px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      color: white;
      font-family: inherit;
      font-size: 13px;
    }
    
    .vs-chat-input:focus {
      outline: none;
      border-color: rgba(52, 211, 153, 0.5);
    }
    
    .vs-send-btn {
      background: linear-gradient(135deg, #34d399, #06b6d4);
      color: white;
      border: none;
      border-radius: 20px;
      width: 60px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .vs-send-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
    }
    
    /* Credit */
    .vs-credit {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      text-align: center;
      padding: 8px;
      background: rgba(0, 0, 0, 0.2);
    }
    
    .vs-credit a {
      color: rgba(52, 211, 153, 0.8);
      text-decoration: none;
    }
    
    /* Scrollbar styles */
    .vs-chat-messages::-webkit-scrollbar {
      width: 6px;
    }
    
    .vs-chat-messages::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
    }
    
    .vs-chat-messages::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
    }
    
    .vs-chat-messages::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }
    
    /* User info styles */
    .vs-user-info {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    
    .vs-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: linear-gradient(135deg, #0071e3, #0099ff);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 14px;
    }
    
    .vs-username-input {
      flex: 1;
      border-radius: 20px;
    }
    
    /* Member count */
    .vs-member-count {
      background: rgba(255, 255, 255, 0.1);
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      display: flex;
      align-items: center;
      gap: 4px;
    }
  `;
  
  document.head.appendChild(style);
  
  // Create main container
  const container = document.createElement('div');
  container.className = 'vs-container';
  container.id = 'video-sync-container';
  container.style.height = '330px';
  
  // Create header for dragging
  const header = document.createElement('div');
  header.className = 'vs-header';
  
  const title = document.createElement('div');
  title.className = 'vs-title';
  title.innerHTML = '<span style="margin-right: 8px;">✨</span> Video Sync';
  
  const controls = document.createElement('div');
  controls.className = 'vs-controls';
  
  const collapseBtn = document.createElement('button');
  collapseBtn.className = 'vs-btn';
  collapseBtn.innerHTML = '▼';
  collapseBtn.title = 'Collapse';
  
  controls.appendChild(collapseBtn);
  header.appendChild(title);
  header.appendChild(controls);
  
  // Create content area
  const content = document.createElement('div');
  content.className = 'vs-content';
  
  // Status section
  const statusSection = document.createElement('div');
  statusSection.className = 'vs-section';
  
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'vs-status';
  
  const indicator = document.createElement('div');
  indicator.id = 'vs-connection-indicator';
  indicator.className = 'vs-indicator ' + (connected ? 'connected' : 'disconnected');
  
  const statusText = document.createElement('span');
  statusText.id = 'vs-connection-status';
  statusText.textContent = connected ? 'Connected' : 'Disconnected';
  
  statusIndicator.appendChild(indicator);
  statusIndicator.appendChild(statusText);
  statusSection.appendChild(statusIndicator);
  
  // Room info
  const roomIdContainer = document.createElement('div');
  roomIdContainer.className = 'vs-room-id';
  roomIdContainer.id = 'vs-room-id';
  roomIdContainer.textContent = roomId || 'No active room';
  statusSection.appendChild(roomIdContainer);
  
  // Tabs
  const tabs = document.createElement('div');
  tabs.className = 'vs-tabs';
  
  const chatTab = document.createElement('div');
  chatTab.className = 'vs-tab active';
  chatTab.textContent = 'Chat';
  chatTab.dataset.tab = 'chat';
  
  const controlsTab = document.createElement('div');
  controlsTab.className = 'vs-tab';
  controlsTab.textContent = 'Controls';
  controlsTab.dataset.tab = 'controls';
  
  tabs.appendChild(chatTab);
  tabs.appendChild(controlsTab);
  
  // Tab content
  const chatContent = document.createElement('div');
  chatContent.className = 'vs-tab-content active';
  chatContent.dataset.tab = 'chat';
  
  const controlsContent = document.createElement('div');
  controlsContent.className = 'vs-tab-content';
  controlsContent.dataset.tab = 'controls';
  
  // Chat interface
  const chatContainer = document.createElement('div');
  chatContainer.className = 'vs-chat-container';
  
  // User info in chat
  const userInfo = document.createElement('div');
  userInfo.className = 'vs-user-info';
  
  const avatar = document.createElement('div');
  avatar.className = 'vs-avatar';
  avatar.id = 'vs-avatar';
  avatar.textContent = username.charAt(0).toUpperCase();
  
  const usernameInput = document.createElement('input');
  usernameInput.className = 'vs-input vs-username-input';
  usernameInput.id = 'vs-username';
  usernameInput.value = username;
  usernameInput.placeholder = 'Your name';
  
  userInfo.appendChild(avatar);
  userInfo.appendChild(usernameInput);
  
  // Room info with member count
  const roomInfo = document.createElement('div');
  roomInfo.className = 'vs-section-header';
  
  const roomTitle = document.createElement('div');
  roomTitle.className = 'vs-section-title';
  roomTitle.textContent = 'Chat Room';
  
  const memberCount = document.createElement('div');
  memberCount.className = 'vs-member-count';
  memberCount.innerHTML = '<span>👥</span> <span id="vs-member-count">-</span>';
  
  roomInfo.appendChild(roomTitle);
  roomInfo.appendChild(memberCount);
  
  // Chat messages
  const chatMessages = document.createElement('div');
  chatMessages.className = 'vs-chat-messages';
  chatMessages.id = 'vs-chat-messages';
  
  // Chat form
  const chatForm = document.createElement('div');
  chatForm.className = 'vs-form';
  
  const chatInput = document.createElement('input');
  chatInput.className = 'vs-chat-input';
  chatInput.id = 'vs-chat-input';
  chatInput.placeholder = 'Type a message...';
  
  const sendBtn = document.createElement('button');
  sendBtn.className = 'vs-send-btn';
  sendBtn.textContent = 'Send';
  
  chatForm.appendChild(chatInput);
  chatForm.appendChild(sendBtn);
  
  // Build chat interface
  chatContainer.appendChild(roomInfo);
  chatContainer.appendChild(userInfo);
  chatContainer.appendChild(chatMessages);
  chatContainer.appendChild(chatForm);
  chatContent.appendChild(chatContainer);
  
  // Controls interface
  const controlsContainer = document.createElement('div');
  controlsContainer.innerHTML = '<div class="vs-section-title" style="margin-bottom: 12px;">Video Controls</div>';
  controlsContainer.innerHTML += '<p style="font-size: 13px; color: rgba(255, 255, 255, 0.6); margin-bottom: 16px;">Any play, pause or seek actions you perform will be synchronized with everyone in your room.</p>';
  
  // Add playback controls
  const controlsInfo = document.createElement('div');
  controlsInfo.className = 'vs-status';
  controlsInfo.style.justifyContent = 'center';
  controlsInfo.innerHTML = 'Sync is active and working';
  controlsContainer.appendChild(controlsInfo);
  
  controlsContent.appendChild(controlsContainer);
  
  // Credit
  const credit = document.createElement('div');
  credit.className = 'vs-credit';
  credit.innerHTML = 'Made by Navneet';
  
  // Assemble UI
  content.appendChild(statusSection);
  content.appendChild(tabs);
  content.appendChild(chatContent);
  content.appendChild(controlsContent);
  
  container.appendChild(header);
  container.appendChild(content);
  container.appendChild(credit);
  
  // Add UI to page
  document.body.appendChild(container);
  
  // Make container draggable
  makeDraggable(container, header);
  
  // Event handlers
  
  // Toggle collapse
  collapseBtn.onclick = () => {
    if (container.classList.contains('collapsed')) {
      container.classList.remove('collapsed');
      collapseBtn.innerHTML = '▼';
    } else {
      container.classList.add('collapsed');
      collapseBtn.innerHTML = '▲';
    }
  };
  
  // Tab switching
  tabs.querySelectorAll('.vs-tab').forEach(tab => {
    tab.onclick = () => {
      // Remove active class from all tabs
      tabs.querySelectorAll('.vs-tab').forEach(t => t.classList.remove('active'));
      
      // Hide all tab contents
      document.querySelectorAll('.vs-tab-content').forEach(c => c.classList.remove('active'));
      
      // Activate clicked tab
      tab.classList.add('active');
      document.querySelector(`.vs-tab-content[data-tab="${tab.dataset.tab}"]`).classList.add('active');
      
      // Handle chat tab visibility
      if (tab.dataset.tab === 'chat') {
        chatVisible = true;
        renderChatHistory(); // Render any messages received while tab was inactive
      } else {
        chatVisible = false;
      }
    };
  });
  
  // Update username
  usernameInput.onchange = () => {
    const newUsername = usernameInput.value.trim();
    if (!newUsername) {
      usernameInput.value = username;
      return;
    }
    
    username = newUsername;
    localStorage.setItem('videoSync_username', username);
    
    // Update avatar
    avatar.textContent = username.charAt(0).toUpperCase();
    
    // Notify server
    if (roomId) {
      chrome.runtime.sendMessage({
        type: 'updateUsername',
        username: username,
        roomId: roomId
      });
    }
  };
  
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
  
  sendBtn.onclick = sendChatMessage;
  
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
    indicator.className = 'vs-indicator connected';
    statusText.textContent = 'Connected to sync server';
  } else {
    indicator.className = 'vs-indicator disconnected';
    statusText.textContent = 'Disconnected from sync server';
  }
}

// Update member count
function updateMemberCount(count) {
  const memberCountEl = document.getElementById('vs-member-count');
  if (memberCountEl) {
    memberCountEl.textContent = count || '1';
  }
}

// Make element draggable with improved positioning
function makeDraggable(element, handle) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  let isDragging = false;
  
  handle.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    
    // Get the initial mouse cursor position
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    isDragging = true;
    
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
    
    // Add dragging class for visual feedback
    element.classList.add('dragging');
  }
  
  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    
    if (!isDragging) return;
    
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    
    // Set the element's new position with boundaries
    const newTop = (element.offsetTop - pos2);
    const newLeft = (element.offsetLeft - pos1);
    
    // Keep element within viewport
    const maxX = window.innerWidth - element.offsetWidth;
    const maxY = window.innerHeight - element.offsetHeight;
    
    element.style.top = Math.min(Math.max(0, newTop), maxY) + "px";
    element.style.left = Math.min(Math.max(0, newLeft), maxX) + "px";
    
    // Remove transform to use absolute positioning
    element.style.transform = 'none';
  }
  
  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
    isDragging = false;
    
    // Remove dragging class
    element.classList.remove('dragging');
  }
}

// Initialize video sync
setupVideoSync();