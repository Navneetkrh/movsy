document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - Tabs
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  // DOM elements - Room
  const connectionStatus = document.getElementById('connection-status');
  const roomIdInput = document.getElementById('roomId');
  const copyLinkBtn = document.getElementById('copyLink');
  const createRoomBtn = document.getElementById('createRoom');
  const joinExistingBtn = document.getElementById('joinExisting');
  
  // DOM elements - Chat
  const chatRoomId = document.getElementById('chat-room-id');
  const memberCount = document.getElementById('member-count');
  const chatMessages = document.getElementById('chat-messages');
  const messageInput = document.getElementById('message-input');
  const sendMessageBtn = document.getElementById('send-message');
  const usernameInput = document.getElementById('username');
  const userAvatar = document.getElementById('user-avatar');
  const noRoomView = document.getElementById('no-room');
  const chatActiveView = document.getElementById('chat-active');
  
  // DOM elements - Settings
  const serverUrlInput = document.getElementById('serverUrl');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const testConnectionBtn = document.getElementById('testConnection');
  const optionsBtn = document.getElementById('options');
  
  // App state
  let currentRoomId = null;
  let username = localStorage.getItem('videoSync_username') || 'Guest_' + Math.floor(Math.random() * 1000);
  
  // Initialize
  init();
  
  // Tab functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const targetTab = document.getElementById(`${tab.dataset.tab}-tab`);
      targetTab.classList.add('active');
    });
  });
  
  // Initialize app
  function init() {
    checkConnectionStatus();
    loadSettings();
    setupUsername();
    getCurrentRoom();
    
    // Set up event listeners
    copyLinkBtn.addEventListener('click', copyRoomLink);
    createRoomBtn.addEventListener('click', createNewRoom);
    joinExistingBtn.addEventListener('click', promptJoinRoom);
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', handleMessageKeypress);
    usernameInput.addEventListener('change', updateUsername);
    saveSettingsBtn.addEventListener('click', saveSettings);
    testConnectionBtn.addEventListener('click', testConnection);
    optionsBtn.addEventListener('click', openOptions);
  }
  
  // Check server connection status
  function checkConnectionStatus() {
    chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, (response) => {
      if (chrome.runtime.lastError) {
        updateConnectionStatus(false);
        console.error('Error checking connection:', chrome.runtime.lastError);
        return;
      }

      updateConnectionStatus(response && response.connected);
    });
  }
  
  // Update connection status UI
  function updateConnectionStatus(isConnected) {
    const statusEl = connectionStatus;
    const statusIndicator = statusEl.querySelector('.status-indicator') || document.createElement('div');
    const headerIndicator = document.getElementById('connectionStatus');
    
    if (!statusEl.contains(statusIndicator)) {
      statusIndicator.className = 'status-indicator';
      statusEl.prepend(statusIndicator);
    }
    
    if (isConnected) {
      statusEl.className = 'status connected';
      statusIndicator.className = 'status-indicator connected';
      headerIndicator.className = 'status-indicator connected';
      statusEl.querySelector('span').textContent = 'Connected to sync server';
    } else {
      statusEl.className = 'status disconnected';
      statusIndicator.className = 'status-indicator disconnected';
      headerIndicator.className = 'status-indicator disconnected';
      statusEl.querySelector('span').textContent = 'Not connected to sync server';
    }
  }
  
  // Load settings
  function loadSettings() {
    chrome.storage.sync.get(['serverUrl'], (result) => {
      if (result.serverUrl) {
        serverUrlInput.value = result.serverUrl;
      } else {
        serverUrlInput.value = 'ws://localhost:3000';
      }
    });
  }
  
  // Setup username
  function setupUsername() {
    usernameInput.value = username;
    updateAvatarInitial();
  }
  
  // Update avatar with user's initial
  function updateAvatarInitial() {
    const initial = username.charAt(0).toUpperCase();
    userAvatar.textContent = initial;
  }
  
  // Get current room
  function getCurrentRoom() {
    chrome.runtime.sendMessage({ type: 'getCurrentRoom' }, (response) => {
      if (response && response.roomId) {
        currentRoomId = response.roomId;
        roomIdInput.value = response.roomId;
        chatRoomId.textContent = `Room: ${response.roomId}`;
        
        // Show chat interface if we have a room
        showChatInterface(true);
        
        // Load chat history for this room
        loadChatHistory(response.roomId);
      } else {
        roomIdInput.value = 'No active room';
        showChatInterface(false);
      }
    });
  }
  
  // Show/hide chat interface
  function showChatInterface(show) {
    if (show) {
      noRoomView.style.display = 'none';
      chatActiveView.style.display = 'flex';
    } else {
      noRoomView.style.display = 'flex';
      chatActiveView.style.display = 'none';
    }
  }
  
  // Load chat history
  function loadChatHistory(roomId) {
    chrome.runtime.sendMessage({ type: 'getChatHistory', roomId }, (response) => {
      if (response && response.messages) {
        chatMessages.innerHTML = ''; // Clear existing messages
        
        response.messages.forEach(msg => {
          addChatMessage(msg);
        });
        
        // Scroll to bottom
        scrollChatToBottom();
      }
    });
  }
  
  // Create a new room
  function createNewRoom() {
    // Generate random room ID
    const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
    
    chrome.runtime.sendMessage({ 
      type: 'createRoom',
      roomId: roomId,
      username: username
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error creating room:', chrome.runtime.lastError);
        showNotification('Error', 'Failed to create room');
        return;
      }
      
      if (response && response.success) {
        currentRoomId = roomId;
        roomIdInput.value = roomId;
        chatRoomId.textContent = `Room: ${roomId}`;
        showChatInterface(true);
        
        // Update the URL of the current page
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length === 0) {
            console.error('No active tab found');
            return;
          }
          
          const currentUrl = new URL(tabs[0].url);
          currentUrl.hash = roomId;
          chrome.tabs.update(tabs[0].id, { url: currentUrl.toString() });
        });
        
        // Notify user
        showNotification('Room created!', 'Click "Copy Sync Link" to share');
      } else {
        showNotification('Error', 'Failed to create room. Please try again.');
      }
    });
  }
  
  // Prompt to join an existing room
  function promptJoinRoom() {
    const roomId = prompt('Enter room ID to join:');
    
    if (!roomId) return;
    
    joinRoom(roomId);
  }
  
  // Join a room
  function joinRoom(roomId) {
    chrome.runtime.sendMessage({ 
      type: 'joinRoom',
      roomId: roomId,
      username: username
    }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        console.error('Error joining room:', chrome.runtime.lastError || 'Unknown error');
        showNotification('Error', 'Failed to join room');
        return;
      }
      
      currentRoomId = roomId;
      roomIdInput.value = roomId;
      chatRoomId.textContent = `Room: ${roomId}`;
      showChatInterface(true);
      
      // Load chat history
      loadChatHistory(roomId);
      
      showNotification('Joined room!', `You're now in room ${roomId}`);
    });
  }
  
  // Copy room link to clipboard
  function copyRoomLink() {
    const roomId = roomIdInput.value;
    
    if (!roomId || roomId === 'No active room') {
      showNotification('No active room', 'Create a new room first');
      return;
    }
    
    // Get current active tab to generate link with correct URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      
      const currentUrl = new URL(tabs[0].url);
      const syncUrl = `${currentUrl.origin}${currentUrl.pathname}${currentUrl.search}#${roomId}`;
      
      // Copy to clipboard
      navigator.clipboard.writeText(syncUrl).then(() => {
        showNotification('Link copied!', 'Share it with your friends');
        
        // Visual feedback
        copyLinkBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyLinkBtn.textContent = 'Copy Sync Link';
        }, 2000);
      }).catch((error) => {
        console.error('Failed to copy:', error);
        showNotification('Copy failed', 'Please try again');
      });
    });
  }
  
  // Update username
  function updateUsername() {
    const newUsername = usernameInput.value.trim();
    
    if (!newUsername) {
      usernameInput.value = username;
      return;
    }
    
    username = newUsername;
    localStorage.setItem('videoSync_username', username);
    updateAvatarInitial();
    
    // Update username on server if in a room
    if (currentRoomId) {
      chrome.runtime.sendMessage({
        type: 'updateUsername',
        username: username,
        roomId: currentRoomId
      });
    }
  }
  
  // Send a chat message
  function sendMessage() {
    const messageText = messageInput.value.trim();
    
    if (!messageText || !currentRoomId) return;
    
    chrome.runtime.sendMessage({
      type: 'sendChatMessage',
      roomId: currentRoomId,
      username: username,
      text: messageText
    }, (response) => {
      if (response && response.success) {
        // Add message to UI (optimistic)
        addChatMessage({
          username: username,
          text: messageText,
          timestamp: Date.now(),
          isLocal: true
        });
        
        // Clear input
        messageInput.value = '';
        
        // Scroll to bottom
        scrollChatToBottom();
      }
    });
  }
  
  // Handle Enter key on message input
  function handleMessageKeypress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
  
  // Add a chat message to the UI
  function addChatMessage(message) {
    const msgEl = document.createElement('div');
    
    if (message.isSystem) {
      msgEl.className = 'message system';
      msgEl.textContent = message.text;
    } else {
      // Determine if this is a sent or received message
      const isLocal = message.isLocal || message.username === username;
      msgEl.className = `message ${isLocal ? 'sent' : 'received'}`;
      
      const sender = document.createElement('div');
      sender.className = 'sender';
      sender.textContent = message.username || 'Anonymous';
      
      const text = document.createElement('div');
      text.textContent = message.text;
      
      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = formatTimestamp(message.timestamp);
      
      msgEl.appendChild(sender);
      msgEl.appendChild(text);
      msgEl.appendChild(time);
    }
    
    chatMessages.appendChild(msgEl);
    scrollChatToBottom();
  }
  
  // Format timestamp
  function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // Scroll chat to bottom
  function scrollChatToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }
  
  // Save settings
  function saveSettings() {
    const serverUrl = serverUrlInput.value.trim();
    
    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
      showNotification('Error', 'Server URL must start with ws:// or wss://');
      return;
    }
    
    chrome.storage.sync.set({ serverUrl }, () => {
      showNotification('Settings saved', 'Server URL updated');
      
      // Reconnect with new URL
      chrome.runtime.sendMessage({ 
        type: 'updateServerUrl', 
        url: serverUrl 
      });
    });
  }
  
  // Test server connection
  function testConnection() {
    const serverUrl = serverUrlInput.value.trim();
    
    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
      showNotification('Error', 'Server URL must start with ws:// or wss://');
      return;
    }
    
    showNotification('Testing...', 'Connecting to server');
    
    // Try to create a websocket connection to test
    try {
      const testSocket = new WebSocket(serverUrl);
      
      testSocket.onopen = () => {
        showNotification('Connection successful', 'Connected to server');
        
        // Close test connection after success
        setTimeout(() => testSocket.close(), 1000);
      };
      
      testSocket.onerror = () => {
        showNotification('Connection failed', 'Could not connect to server');
      };
    } catch (err) {
      showNotification('Connection error', err.message);
    }
  }
  
  // Open options page
  function openOptions() {
    chrome.runtime.openOptionsPage ? 
      chrome.runtime.openOptionsPage() : 
      window.open(chrome.runtime.getURL('options.html'));
  }
  
  // Show notification
  function showNotification(title, message) {
    console.log(`${title}: ${message}`);
    
    const notificationEl = document.createElement('div');
    notificationEl.className = 'notification';
    notificationEl.innerHTML = `<strong>${title}</strong>: ${message}`;
    
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => n.remove());
    
    document.body.appendChild(notificationEl);
    
    setTimeout(() => {
      notificationEl.remove();
    }, 3000);
  }
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'connectionStatus') {
      updateConnectionStatus(message.connected);
    } else if (message.type === 'chatMessage') {
      addChatMessage(message);
    } else if (message.type === 'memberUpdate') {
      if (memberCount) {
        memberCount.textContent = message.memberCount || 0;
      }
    }
  });
});
