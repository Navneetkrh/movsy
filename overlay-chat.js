/**
 * Video Sync Overlay Chat
 * Soft UI theme with purple, beige and peach colors
 */

class VideoSyncOverlay {
  constructor() {
    this.visible = true;
    this.connected = false;
    this.roomId = null;
    this.username = localStorage.getItem('videoSync_username') || this.generateGuestName();
    this.messages = [];
    this.activeTab = 'chat';
    this.memberCount = 0;
    this.container = null;
    this.chatMessages = null;
    this.chatInput = null;
    
    // Initialize UI
    this.createOverlay();
    this.setupEventListeners();
    this.checkConnection();
    
    // Auto-detect room ID from URL hash
    if (window.location.hash) {
      const hashRoomId = window.location.hash.slice(1);
      if (hashRoomId) {
        this.joinRoom(hashRoomId);
      }
    }
  }
  
  /**
   * Create the overlay UI
   */
  createOverlay() {
    // Add the soft theme CSS
    this.addStylesheet('/soft-theme.css');
    
    // Create main container
    this.container = document.createElement('div');
    this.container.className = 'vs-overlay';
    this.container.id = 'vs-overlay';
    this.container.style.height = '400px';
    
    // Create header with controls
    const header = document.createElement('div');
    header.className = 'vs-header';
    
    const headerTitle = document.createElement('div');
    headerTitle.className = 'vs-header-title';
    headerTitle.innerHTML = '<span>✨</span><span>Video Sync</span>';
    
    const headerControls = document.createElement('div');
    headerControls.className = 'vs-header-controls';
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'vs-btn-icon toggle';
    toggleBtn.innerHTML = '▼';
    toggleBtn.title = 'Toggle visibility';
    toggleBtn.addEventListener('click', () => this.toggleCollapse());
    
    headerControls.appendChild(toggleBtn);
    header.appendChild(headerTitle);
    header.appendChild(headerControls);
    
    // Create content area
    const content = document.createElement('div');
    content.className = 'vs-content';
    
    // Create status indicator
    const status = document.createElement('div');
    status.className = 'vs-status';
    status.innerHTML = `
      <div id="vs-status-indicator" class="vs-status-indicator disconnected"></div>
      <span id="vs-status-text">Checking connection...</span>
    `;
    
    // Create room info
    const roomInfo = document.createElement('div');
    roomInfo.className = 'vs-room-info';
    roomInfo.innerHTML = `
      <div class="vs-room-id" id="vs-room-id">No active room</div>
      <div class="vs-member-count">
        <span>👥</span>
        <span id="vs-member-count">0</span>
      </div>
    `;
    
    // Create tabs
    const tabs = document.createElement('div');
    tabs.className = 'vs-tabs';
    tabs.innerHTML = `
      <div class="vs-tab active" data-tab="chat">Chat</div>
      <div class="vs-tab" data-tab="controls">Controls</div>
    `;
    
    // Create tab content containers
    const chatTab = document.createElement('div');
    chatTab.className = 'vs-tab-content active';
    chatTab.dataset.tab = 'chat';
    
    const controlsTab = document.createElement('div');
    controlsTab.className = 'vs-tab-content';
    controlsTab.dataset.tab = 'controls';
    
    // Build chat interface
    chatTab.innerHTML = `
      <div class="vs-chat-container">
        <div class="vs-user-profile">
          <div class="vs-avatar" id="vs-avatar">${this.username.charAt(0).toUpperCase()}</div>
          <input type="text" class="vs-username-input" id="vs-username" 
            placeholder="Your name" value="${this.username}">
        </div>
        <div class="vs-chat-messages" id="vs-chat-messages"></div>
        <div class="vs-chat-form">
          <input type="text" class="vs-chat-input" id="vs-chat-input" 
            placeholder="Type a message...">
          <button class="vs-send-btn" id="vs-send-btn">Send</button>
        </div>
      </div>
    `;
    
    // Build controls interface
    controlsTab.innerHTML = `
      <div class="vs-empty-state" id="vs-no-room-message">
        <div class="vs-empty-icon">🎬</div>
        <h3>Create or join a room</h3>
        <p>Start watching videos together in sync</p>
      </div>
      <div class="vs-actions">
        <button class="vs-btn vs-btn-primary" id="vs-create-room">
          <span>Create Room</span>
        </button>
        <button class="vs-btn vs-btn-secondary" id="vs-join-room">
          <span>Join Room</span>
        </button>
      </div>
      <div class="vs-actions" style="margin-top: 10px;">
        <button class="vs-btn vs-btn-neutral" id="vs-copy-link">
          <span>Copy Link</span>
        </button>
      </div>
    `;
    
    // Build the footer
    const footer = document.createElement('div');
    footer.className = 'vs-footer';
    footer.textContent = 'Made by Navneet';
    
    // Assemble the UI
    content.appendChild(status);
    content.appendChild(roomInfo);
    content.appendChild(tabs);
    content.appendChild(chatTab);
    content.appendChild(controlsTab);
    
    this.container.appendChild(header);
    this.container.appendChild(content);
    this.container.appendChild(footer);
    
    // Add to page
    document.body.appendChild(this.container);
    
    // Store references to key elements
    this.chatMessages = document.getElementById('vs-chat-messages');
    this.chatInput = document.getElementById('vs-chat-input');
    
    // Make draggable
    this.makeElementDraggable(this.container, header);
  }
  
  /**
   * Set up event listeners for the UI
   */
  setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.vs-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        this.switchTab(tabName);
      });
    });
    
    // Username change
    document.getElementById('vs-username').addEventListener('change', (e) => {
      this.updateUsername(e.target.value);
    });
    
    // Send message button
    document.getElementById('vs-send-btn').addEventListener('click', () => {
      this.sendChatMessage();
    });
    
    // Send on Enter key
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    
    // Create room button
    document.getElementById('vs-create-room').addEventListener('click', () => {
      this.createRoom();
    });
    
    // Join room button
    document.getElementById('vs-join-room').addEventListener('click', () => {
      this.promptJoinRoom();
    });
    
    // Copy link button
    document.getElementById('vs-copy-link').addEventListener('click', () => {
      this.copyRoomLink();
    });
    
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'serverConnectionStatus') {
        this.updateConnectionStatus(message.connected);
      } else if (message.type === 'chatMessage') {
        this.addChatMessage(message);
      } else if (message.type === 'memberUpdate') {
        this.updateMemberCount(message.memberCount);
      }
    });
  }
  
  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update active tab
    this.activeTab = tabName;
    
    // Update UI
    document.querySelectorAll('.vs-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.vs-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tab === tabName);
    });
  }
  
  /**
   * Add a chat message to the UI
   */
  addChatMessage(message) {
    // Store message
    this.messages.push(message);
    
    // Create message element
    const msgEl = document.createElement('div');
    
    if (message.isSystem) {
      msgEl.className = 'vs-message system';
      msgEl.textContent = message.text;
    } else {
      // Is this a sent or received message?
      const isSent = message.username === this.username;
      msgEl.className = `vs-message ${isSent ? 'sent' : 'received'}`;
      
      // Add sender name if it's a received message
      if (!isSent) {
        const sender = document.createElement('div');
        sender.className = 'vs-sender ' + (isSent ? 'sent' : 'received');
        sender.textContent = message.username;
        msgEl.appendChild(sender);
      }
      
      // Add message text
      const text = document.createElement('div');
      text.textContent = message.text;
      msgEl.appendChild(text);
      
      // Add timestamp
      if (message.timestamp) {
        const time = document.createElement('div');
        time.className = 'vs-timestamp';
        time.textContent = this.formatTime(message.timestamp);
        msgEl.appendChild(time);
      }
    }
    
    // Add to chat and scroll
    this.chatMessages.appendChild(msgEl);
    this.scrollChatToBottom();
  }
  
  /**
   * Send a chat message
   */
  sendChatMessage() {
    const text = this.chatInput.value.trim();
    if (!text || !this.roomId) return;
    
    chrome.runtime.sendMessage({
      type: 'sendChatMessage',
      roomId: this.roomId,
      username: this.username,
      text: text
    });
    
    // Clear input
    this.chatInput.value = '';
  }
  
  /**
   * Update username
   */
  updateUsername(newUsername) {
    if (!newUsername) return;
    
    this.username = newUsername;
    localStorage.setItem('videoSync_username', this.username);
    
    // Update avatar
    document.getElementById('vs-avatar').textContent = this.username.charAt(0).toUpperCase();
    
    // Notify server if connected to a room
    if (this.roomId) {
      chrome.runtime.sendMessage({
        type: 'updateUsername',
        username: this.username,
        roomId: this.roomId
      });
    }
  }
  
  /**
   * Join a room
   */
  joinRoom(roomId) {
    chrome.runtime.sendMessage({
      type: 'joinRoom',
      roomId: roomId,
      username: this.username
    }, (response) => {
      if (response && response.success) {
        this.roomId = roomId;
        
        // Update UI
        document.getElementById('vs-room-id').textContent = roomId;
        document.getElementById('vs-no-room-message').style.display = 'none';
        
        // Add system message
        this.addChatMessage({
          isSystem: true,
          text: `You joined room ${roomId}`,
          timestamp: Date.now()
        });
        
        // Request chat history
        chrome.runtime.sendMessage({
          type: 'getChatHistory',
          roomId: roomId
        }, (historyResponse) => {
          if (historyResponse && historyResponse.messages) {
            // Clear existing messages
            this.chatMessages.innerHTML = '';
            this.messages = [];
            
            // Add all messages
            historyResponse.messages.forEach(msg => this.addChatMessage(msg));
          }
        });
        
        // Switch to chat tab
        this.switchTab('chat');
        
        // Show notification
        this.showNotification('Room joined', `You're now in room ${roomId}`);
      }
    });
  }
  
  /**
   * Create a new room
   */
  createRoom() {
    const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
    
    chrome.runtime.sendMessage({
      type: 'createRoom',
      roomId: roomId,
      username: this.username
    }, (response) => {
      if (response && response.success) {
        this.roomId = roomId;
        
        // Update URL hash
        window.location.hash = roomId;
        
        // Update UI
        document.getElementById('vs-room-id').textContent = roomId;
        document.getElementById('vs-no-room-message').style.display = 'none';
        
        // Add system message
        this.addChatMessage({
          isSystem: true,
          text: `Room created: ${roomId}`,
          timestamp: Date.now()
        });
        
        // Switch to chat tab
        this.switchTab('chat');
        
        // Show notification
        this.showNotification('Room created', 'Share the link with friends to watch together');
      }
    });
  }
  
  /**
   * Prompt to join an existing room
   */
  promptJoinRoom() {
    const roomId = prompt('Enter room ID to join:');
    if (roomId) {
      this.joinRoom(roomId);
    }
  }
  
  /**
   * Copy room link to clipboard
   */
  copyRoomLink() {
    if (!this.roomId) {
      this.showNotification('No active room', 'Create or join a room first');
      return;
    }
    
    const url = window.location.href.split('#')[0] + '#' + this.roomId;
    
    try {
      navigator.clipboard.writeText(url).then(() => {
        this.showNotification('Link copied!', 'Share it with your friends');
      }).catch(err => {
        console.error('Failed to copy:', err);
        // Fallback
        this.showNotification('Copy failed', 'Please copy this link manually: ' + url);
      });
    } catch (err) {
      console.error('Clipboard API not available:', err);
      this.showNotification('Copy failed', 'Please copy this link manually: ' + url);
    }
  }
  
  /**
   * Check connection status with the server
   */
  checkConnection() {
    chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, response => {
      if (response) {
        this.updateConnectionStatus(response.connected);
      }
    });
  }
  
  /**
   * Update connection status indicator
   */
  updateConnectionStatus(isConnected) {
    this.connected = isConnected;
    
    const indicator = document.getElementById('vs-status-indicator');
    const statusText = document.getElementById('vs-status-text');
    
    if (!indicator || !statusText) return;
    
    if (isConnected) {
      indicator.className = 'vs-status-indicator connected';
      statusText.textContent = 'Connected to sync server';
    } else {
      indicator.className = 'vs-status-indicator disconnected';
      statusText.textContent = 'Disconnected from sync server';
    }
  }
  
  /**
   * Update member count display
   */
  updateMemberCount(count) {
    this.memberCount = count;
    const memberCountElement = document.getElementById('vs-member-count');
    if (memberCountElement) {
      memberCountElement.textContent = count;
    }
  }
  
  /**
   * Show a notification
   */
  showNotification(title, message) {
    // Remove any existing notifications
    const existingNotification = document.querySelector('.vs-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'vs-notification';
    
    // Add title and message
    const titleElement = document.createElement('div');
    titleElement.className = 'vs-notification-title';
    titleElement.textContent = title;
    
    const messageElement = document.createElement('div');
    messageElement.className = 'vs-notification-message';
    messageElement.textContent = message;
    
    notification.appendChild(titleElement);
    notification.appendChild(messageElement);
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after timeout
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, 3000);
  }
  
  /**
   * Toggle collapsed state
   */
  toggleCollapse() {
    const overlay = this.container;
    if (overlay.classList.contains('collapsed')) {
      overlay.classList.remove('collapsed');
    } else {
      overlay.classList.add('collapsed');
    }
  }
  
  /**
   * Make an element draggable
   */
  makeElementDraggable(element, handle) {
    let offsetX = 0, offsetY = 0, startX = 0, startY = 0;
    
    handle.onmousedown = (e) => {
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      document.onmousemove = onMouseMove;
      document.onmouseup = onMouseUp;
    };
    
    function onMouseMove(e) {
      e.preventDefault();
      offsetX = startX - e.clientX;
      offsetY = startY - e.clientY;
      startX = e.clientX;
      startY = e.clientY;
      
      // Calculate new position
      const newTop = (element.offsetTop - offsetY);
      const newLeft = (element.offsetLeft - offsetX);
      
      // Set boundaries
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight;
      
      element.style.top = Math.max(0, Math.min(newTop, maxY)) + 'px';
      element.style.left = Math.max(0, Math.min(newLeft, maxX)) + 'px';
    }
    
    function onMouseUp() {
      document.onmousemove = null;
      document.onmouseup = null;
    }
  }
  
  /**
   * Format timestamp for messages
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Scroll chat to the bottom
   */
  scrollChatToBottom() {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }
  
  /**
   * Generate random guest name
   */
  generateGuestName() {
    return 'Guest_' + Math.floor(Math.random() * 10000);
  }
  
  /**
   * Add stylesheet to the page
   */
  addStylesheet(path) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL(path);
    document.head.appendChild(link);
  }
}

// Initialize when the document is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  window.videoSyncOverlay = new VideoSyncOverlay();
});

// Initialize immediately if document is already loaded
if (document.readyState === 'complete') {
  window.videoSyncOverlay = new VideoSyncOverlay();
}