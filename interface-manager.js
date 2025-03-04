/**
 * Interface Manager
 * Orchestrates the interaction between different components
 */

class InterfaceManager {
  constructor() {
    this.overlayController = null;
    this.chatHandler = null;
    this.syncController = null;
    this.initialized = false;
    
    // Initialize as soon as possible
    this.init();
  }
  
  /**
   * Initialize the interface
   */
  async init() {
    console.log('🚀 Initializing Video Sync Interface');
    
    try {
      // Inject CSS first to avoid FOUC (Flash of Unstyled Content)
      await this.injectCSS('enhanced-theme.css');
      
      // Create overlay controller
      this.createOverlayController();
      
      // Setup message listeners
      this.setupMessageListeners();
      
      // Try to get room ID from URL hash
      this.detectRoomFromURL();
      
      this.initialized = true;
      console.log('✓ Interface initialization complete');
    } catch (err) {
      console.error('× Interface initialization failed:', err);
    }
  }
  
  /**
   * Inject CSS stylesheet
   */
  injectCSS(path) {
    return new Promise((resolve, reject) => {
      try {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = chrome.runtime.getURL(path);
        
        link.onload = () => {
          console.log(`✓ CSS injected: ${path}`);
          resolve(true);
        };
        
        link.onerror = (err) => {
          console.error(`× Failed to load CSS: ${path}`, err);
          reject(err);
        };
        
        document.head.appendChild(link);
      } catch (err) {
        console.error('Error injecting CSS:', err);
        reject(err);
      }
    });
  }
  
  /**
   * Create overlay controller
   */
  createOverlayController() {
    // Load overlay script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('overlay-controller.js');
    script.onload = () => {
      console.log('✓ Overlay controller loaded');
      // Store reference to the controller
      this.overlayController = window.videoSyncOverlay;
    };
    document.head.appendChild(script);
  }
  
  /**
   * Setup message listeners for Chrome runtime messages
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('📩 Message received:', message.type);
      
      switch (message.type) {
        case 'serverConnectionStatus':
          this.handleConnectionStatus(message.connected);
          break;
        
        case 'chatMessage':
          this.handleChatMessage(message);
          break;
          
        case 'memberUpdate':
          this.handleMemberUpdate(message.memberCount);
          break;
          
        case 'videoControl':
          this.handleVideoControl(message);
          break;
      }
      
      // Always return true for async response
      return true;
    });
  }
  
  /**
   * Handle connection status updates
   */
  handleConnectionStatus(isConnected) {
    const statusIndicator = document.getElementById('vs-status-indicator');
    const statusText = document.getElementById('vs-status-text');
    
    if (!statusIndicator || !statusText) return;
    
    if (isConnected) {
      statusIndicator.className = 'vs-status-indicator connected';
      statusText.textContent = 'Connected to sync server';
    } else {
      statusIndicator.className = 'vs-status-indicator disconnected';
      statusText.textContent = 'Disconnected from sync server';
    }
  }
  
  /**
   * Handle chat messages
   */
  handleChatMessage(message) {
    if (this.overlayController) {
      this.overlayController.addChatMessage(message);
    }
  }
  
  /**
   * Handle member count updates
   */
  handleMemberUpdate(count) {
    const memberCountEl = document.getElementById('vs-member-count');
    if (memberCountEl) {
      memberCountEl.textContent = count || '1';
    }
  }
  
  /**
   * Handle video control commands
   */
  handleVideoControl(message) {
    const video = this.findVideoElement();
    if (!video) {
      console.log('× No video element found for control command');
      return;
    }
    
    console.log(`🎬 Executing video command: ${message.action}`);
    this.syncVideoWithCommand(video, message);
  }
  
  /**
   * Find video element
   */
  findVideoElement() {
    // Try various selectors for different platforms
    const selectors = [
      'video',                              // Generic
      'video.html5-main-video',             // YouTube
      'video.VideoPlayer',                  // Netflix
      'video.btm-media-client-element',     // Disney+
      'video.webPlayerElement'              // Prime Video
    ];
    
    for (const selector of selectors) {
      const video = document.querySelector(selector);
      if (video) return video;
    }
    
    return null;
  }
  
  /**
   * Sync video with received command
   */
  syncVideoWithCommand(video, command) {
    // Set flag to ignore our own events
    this.ignoreEvents = true;
    
    try {
      if (command.action === 'play') {
        // Seek if time difference is significant
        if (Math.abs(video.currentTime - command.time) > 0.5) {
          video.currentTime = command.time;
        }
        video.play().catch(err => {
          console.error('Error playing video:', err);
        });
      } else if (command.action === 'pause') {
        video.currentTime = command.time;
        video.pause();
      } else if (command.action === 'seeked') {
        video.currentTime = command.time;
      }
    } catch (err) {
      console.error('Error executing command:', err);
    }
    
    // Reset flag after a short delay
    setTimeout(() => {
      this.ignoreEvents = false;
    }, 500);
  }
  
  /**
   * Detect room ID from URL hash
   */
  detectRoomFromURL() {
    if (window.location.hash) {
      const roomId = window.location.hash.slice(1);
      if (roomId && roomId.startsWith('room_')) {
        console.log('📋 Found room ID in URL:', roomId);
        this.joinRoom(roomId);
      }
    }
  }
  
  /**
   * Join a room
   */
  joinRoom(roomId) {
    chrome.runtime.sendMessage({
      type: 'joinRoom',
      roomId: roomId,
    }, response => {
      if (response && response.success) {
        console.log('✅ Successfully joined room:', roomId);
        
        // Update UI
        const roomIdElement = document.getElementById('vs-room-id');
        if (roomIdElement) roomIdElement.textContent = roomId;
        
        // Show notification if overlay controller is ready
        if (this.overlayController) {
          this.overlayController.showNotification('Room joined', `You've joined room ${roomId}`);
        }
      } else {
        console.error('Failed to join room');
      }
    });
  }
}

// Initialize interface
window.vsInterface = new InterfaceManager();
