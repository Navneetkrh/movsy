/**
 * Enhanced Video Sync Overlay Controller
 * Handles all overlay functionality, appearance, and user interactions
 */

class VideoSyncOverlay {
  constructor() {
    // State
    this.visible = true;
    this.isDarkMode = localStorage.getItem('vs_dark_mode') === 'true';
    this.container = null;
    this.dragging = false;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;
    this.position = {
      x: parseInt(localStorage.getItem('vs_position_x')) || 20,
      y: parseInt(localStorage.getItem('vs_position_y')) || 20
    };
    
    // Create and initialize the UI
    this.createOverlay();
    this.initEventListeners();
    
    // Apply dark mode if enabled
    if (this.isDarkMode) {
      this.toggleDarkMode(true);
    }
    
    // Position overlay
    this.updatePosition();
  }
  
  /**
   * Create the overlay UI
   */
  createOverlay() {
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'video-sync-container';
    this.container.className = 'vs-overlay';
    
    // Create overlay content
    this.container.innerHTML = `
      <div class="vs-header">
        <div class="vs-header-title">
          <span>✨</span><span>Video Sync</span>
        </div>
        <div class="vs-header-controls">
          <button class="vs-btn-icon vs-dark-mode-toggle" title="Toggle Dark Mode">
            ${this.isDarkMode ? '☀️' : '🌙'}
          </button>
          <button class="vs-btn-icon vs-hide-btn" title="Hide Overlay">×</button>
          <button class="vs-btn-icon vs-toggle-btn" title="Collapse">▼</button>
        </div>
      </div>
      <div class="vs-content">
        <div class="vs-status">
          <div id="vs-status-indicator" class="vs-status-indicator disconnected"></div>
          <span id="vs-status-text">Checking connection...</span>
        </div>
        <div class="vs-room-info">
          <div class="vs-room-id" id="vs-room-id">No active room</div>
          <div class="vs-member-count">
            <span>👥</span>
            <span id="vs-member-count">0</span>
          </div>
        </div>
        <div class="vs-tabs">
          <div class="vs-tab active" data-tab="chat">Chat</div>
          <div class="vs-tab" data-tab="controls">Controls</div>
        </div>
        <div class="vs-tab-content active" data-tab="chat">
          <div class="vs-chat-container">
            <div class="vs-user-profile">
              <div class="vs-avatar" id="vs-avatar"></div>
              <input type="text" class="vs-username-input" id="vs-username" placeholder="Your name">
            </div>
            <div class="vs-chat-messages" id="vs-chat-messages"></div>
            <div class="vs-chat-form">
              <input type="text" class="vs-chat-input" id="vs-chat-input" placeholder="Type a message...">
              <button class="vs-send-btn" id="vs-send-btn">Send</button>
            </div>
          </div>
        </div>
        <div class="vs-tab-content" data-tab="controls">
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
        </div>
      </div>
      <div class="vs-footer">Made by Navneet</div>
      <div class="vs-show-button" style="display: none;">
        <button class="vs-btn vs-btn-floating">
          <span>Show Video Sync</span>
        </button>
      </div>
    `;
    
    // Append to document
    document.body.appendChild(this.container);
    
    // Store references to important elements
    this.usernameInput = document.getElementById('vs-username');
    this.chatInput = document.getElementById('vs-chat-input');
    this.sendButton = document.getElementById('vs-send-btn');
    this.chatMessages = document.getElementById('vs-chat-messages');
    this.toggleButton = document.querySelector('.vs-toggle-btn');
    this.hideButton = document.querySelector('.vs-hide-btn');
    this.showButton = document.querySelector('.vs-show-button');
    
    // Set username from localStorage or generate one
    this.username = localStorage.getItem('videoSync_username') || `Guest_${Math.floor(Math.random() * 10000)}`;
    this.usernameInput.value = this.username;
    this.updateAvatar();
  }
  
  /**
   * Set up all event listeners
   */
  initEventListeners() {
    // Make header draggable
    this.initDragging();
    
    // Tab switching
    document.querySelectorAll('.vs-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });
    
    // Collapse button
    this.toggleButton.addEventListener('click', () => this.toggleCollapse());
    
    // Hide button
    this.hideButton.addEventListener('click', () => this.hideOverlay());
    
    // Show button
    document.querySelector('.vs-btn-floating').addEventListener('click', () => this.showOverlay());
    
    // Dark mode toggle
    document.querySelector('.vs-dark-mode-toggle').addEventListener('click', () => this.toggleDarkMode());
    
    // Username input
    this.usernameInput.addEventListener('change', () => this.updateUsername());
    
    // Chat form
    this.sendButton.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Room controls
    document.getElementById('vs-create-room')?.addEventListener('click', () => this.createRoom());
    document.getElementById('vs-join-room')?.addEventListener('click', () => this.joinRoom());
    document.getElementById('vs-copy-link')?.addEventListener('click', () => this.copyRoomLink());
  }
  
  /**
   * Improved dragging implementation with better physics
   */
  initDragging() {
    const header = this.container.querySelector('.vs-header');
    
    // Mouse events
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.vs-btn-icon')) return; // Skip if clicking buttons
      
      this.dragging = true;
      this.dragOffsetX = e.clientX - this.container.getBoundingClientRect().left;
      this.dragOffsetY = e.clientY - this.container.getBoundingClientRect().top;
      
      // Add visual feedback
      this.container.classList.add('vs-dragging');
      
      // Capture mousemove and mouseup on the document level
      document.addEventListener('mousemove', this.dragMove);
      document.addEventListener('mouseup', this.dragEnd);
    });
    
    // Define bound methods
    this.dragMove = this.dragMove.bind(this);
    this.dragEnd = this.dragEnd.bind(this);
    
    // Touch events for mobile
    header.addEventListener('touchstart', (e) => {
      if (e.target.closest('.vs-btn-icon')) return; // Skip if touching buttons
      
      this.dragging = true;
      const touch = e.touches[0];
      this.dragOffsetX = touch.clientX - this.container.getBoundingClientRect().left;
      this.dragOffsetY = touch.clientY - this.container.getBoundingClientRect().top;
      
      // Add visual feedback
      this.container.classList.add('vs-dragging');
      
      // Prevent scrolling
      e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
      if (!this.dragging) return;
      
      const touch = e.touches[0];
      this.handleDrag(touch.clientX, touch.clientY);
      e.preventDefault(); // Prevent scrolling
    });
    
    document.addEventListener('touchend', () => {
      if (this.dragging) {
        this.dragging = false;
        this.container.classList.remove('vs-dragging');
        this.savePosition();
      }
    });
  }
  
  dragMove(e) {
    if (!this.dragging) return;
    this.handleDrag(e.clientX, e.clientY);
  }
  
  dragEnd() {
    if (!this.dragging) return;
    
    this.dragging = false;
    this.container.classList.remove('vs-dragging');
    document.removeEventListener('mousemove', this.dragMove);
    document.removeEventListener('mouseup', this.dragEnd);
    
    // Save position to localStorage
    this.savePosition();
  }
  
  handleDrag(clientX, clientY) {
    // Calculate new position with smooth physics
    const newX = clientX - this.dragOffsetX;
    const newY = clientY - this.dragOffsetY;
    
    // Constrain to viewport
    const maxX = window.innerWidth - this.container.offsetWidth;
    const maxY = window.innerHeight - this.container.offsetHeight;
    
    this.position.x = Math.max(0, Math.min(newX, maxX));
    this.position.y = Math.max(0, Math.min(newY, maxY));
    
    // Apply new position
    this.updatePosition();
  }
  
  updatePosition() {
    this.container.style.left = `${this.position.x}px`;
    this.container.style.top = `${this.position.y}px`;
  }
  
  savePosition() {
    localStorage.setItem('vs_position_x', this.position.x);
    localStorage.setItem('vs_position_y', this.position.y);
  }
  
  /**
   * Toggle dark mode
   */
  toggleDarkMode(force = null) {
    const isDark = force !== null ? force : !this.isDarkMode;
    this.isDarkMode = isDark;
    
    // Save preference
    localStorage.setItem('vs_dark_mode', isDark);
    
    // Update UI
    if (isDark) {
      this.container.classList.add('vs-dark-mode');
    } else {
      this.container.classList.remove('vs-dark-mode');
    }
    
    // Update button icon
    const darkModeBtn = document.querySelector('.vs-dark-mode-toggle');
    if (darkModeBtn) {
      darkModeBtn.innerHTML = isDark ? '☀️' : '🌙';
    }
  }
  
  /**
   * Toggle collapsed state
   */
  toggleCollapse() {
    this.container.classList.toggle('vs-collapsed');
    
    // Update button text
    if (this.container.classList.contains('vs-collapsed')) {
      this.toggleButton.innerHTML = '▲';
      this.toggleButton.title = 'Expand';
    } else {
      this.toggleButton.innerHTML = '▼';
      this.toggleButton.title = 'Collapse';
    }
  }
  
  /**
   * Hide overlay completely
   */
  hideOverlay() {
    this.container.style.display = 'none';
    this.showButton.style.display = 'block';
  }
  
  /**
   * Show overlay again
   */
  showOverlay() {
    this.container.style.display = 'flex';
    this.showButton.style.display = 'none';
  }
  
  /**
   * Switch between tabs
   */
  switchTab(tabName) {
    // Update tabs
    document.querySelectorAll('.vs-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    // Update tab content
    document.querySelectorAll('.vs-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tab === tabName);
    });
    
    // Scroll chat to bottom when switching to chat tab
    if (tabName === 'chat') {
      this.scrollChatToBottom();
    }
  }
  
  /**
   * Update username
   */
  updateUsername() {
    const newName = this.usernameInput.value.trim();
    if (!newName) return;
    
    this.username = newName;
    localStorage.setItem('videoSync_username', newName);
    this.updateAvatar();
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'updateUsername',
      username: this.username
    });
  }
  
  /**
   * Update avatar with initial
   */
  updateAvatar() {
    const avatarEl = document.getElementById('vs-avatar');
    if (avatarEl) {
      avatarEl.textContent = this.username.charAt(0).toUpperCase();
    }
  }
  
  /**
   * Send chat message
   */
  sendMessage() {
    const text = this.chatInput.value.trim();
    if (!text) return;
    
    // Send via background script
    chrome.runtime.sendMessage({
      type: 'sendChatMessage',
      text,
      username: this.username
    });
    
    // Clear input
    this.chatInput.value = '';
  }
  
  /**
   * Add message to chat UI
   */
  addChatMessage(message) {
    if (!this.chatMessages) return;
    
    const msgEl = document.createElement('div');
    
    if (message.isSystem) {
      msgEl.className = 'vs-message vs-system';
      msgEl.textContent = message.text;
    } else {
      const isSelf = message.username === this.username;
      msgEl.className = `vs-message ${isSelf ? 'vs-sent' : 'vs-received'}`;
      
      // Create sender element
      if (!isSelf) {
        const sender = document.createElement('div');
        sender.className = 'vs-sender';
        sender.textContent = message.username || 'Unknown';
        msgEl.appendChild(sender);
      }
      
      // Create message content
      const content = document.createElement('div');
      content.className = 'vs-message-content';
      content.textContent = message.text;
      msgEl.appendChild(content);
      
      // Add timestamp if available
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
   * Format timestamp for chat
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  /**
   * Scroll chat to bottom
   */
  scrollChatToBottom() {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }
  
  /**
   * Create a new room
   */
  createRoom() {
    const roomId = 'room_' + Math.random().toString(36).substring(2, 8);
    
    chrome.runtime.sendMessage({
      type: 'createRoom',
      roomId
    }, response => {
      if (response && response.success) {
        document.getElementById('vs-room-id').textContent = roomId;
        document.getElementById('vs-no-room-message').style.display = 'none';
        this.showNotification('Room created', 'Copy the link to share with friends');
      }
    });
  }
  
  /**
   * Join an existing room
   */
  joinRoom() {
    const roomId = prompt('Enter room ID to join:');
    if (!roomId) return;
    
    chrome.runtime.sendMessage({
      type: 'joinRoom',
      roomId
    }, response => {
      if (response && response.success) {
        document.getElementById('vs-room-id').textContent = roomId;
        document.getElementById('vs-no-room-message').style.display = 'none';
        this.showNotification('Room joined', 'You can now watch videos together');
      } else {
        this.showNotification('Error', 'Could not join room');
      }
    });
  }
  
  /**
   * Copy room link to clipboard
   */
  copyRoomLink() {
    const roomId = document.getElementById('vs-room-id').textContent;
    
    if (roomId === 'No active room') {
      this.showNotification('No room', 'Create or join a room first');
      return;
    }
    
    // Create link with current URL plus room ID as hash
    const url = window.location.href.split('#')[0] + '#' + roomId;
    
    // Copy to clipboard
    navigator.clipboard.writeText(url)
      .then(() => {
        this.showNotification('Link copied', 'Share with friends to watch together');
      })
      .catch(() => {
        // Fallback for clipboard API failures
        prompt('Copy this link to share:', url);
      });
  }
  
  /**
   * Show notification
   */
  showNotification(title, message, type = 'info') {
    // Create notification
    const notification = document.createElement('div');
    notification.className = `vs-notification ${type}`;
    notification.innerHTML = `
      <div class="vs-notification-title">${title}</div>
      <div class="vs-notification-message">${message}</div>
      <button class="vs-notification-close">×</button>
    `;
    
    // Add to DOM
    document.body.appendChild(notification);
    
    // Add close handler
    notification.querySelector('.vs-notification-close').addEventListener('click', () => {
      notification.classList.add('vs-sliding-out');
      setTimeout(() => notification.remove(), 300);
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.classList.add('vs-sliding-out');
        setTimeout(() => notification.remove(), 300);
      }
    }, 5000);
  }
}

// Create and export the overlay
window.videoSyncOverlay = new VideoSyncOverlay();
