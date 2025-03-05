console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let isController = false;
let ignoreEvents = false;
let chatVisible = false;
let username = null;
let messageHistory = [];
let isNetflix = false;
let netflixInjected = false;

// Initialize username from storage using message passing instead of direct storage access
function initUsername() {
  // Send message to background script to get the username
  safeRuntimeCall(() => chrome.runtime.sendMessage({ type: 'getSavedUsername' }, (response) => {
    if (response && response.username) {
      username = response.username;
    } else {
      // Generate a random username only if we don't have one saved
      username = 'Guest_' + Math.floor(Math.random() * 1000);
      // Send message to background script to save the username
      safeRuntimeCall(() => chrome.runtime.sendMessage({ 
        type: 'setUsername',
        username: username
      }));
    }
    console.log('Using username:', username);
  }));
}

// Call this immediately
initUsername();

// Helper function to safely make runtime API calls
function safeRuntimeCall(apiCall) {
  try {
    return apiCall();
  } catch (e) {
    if (e.message.includes('Extension context invalidated')) {
      console.log('Extension context invalidated. The extension may have been reloaded, disabled, or uninstalled.');
      // Here we could implement some recovery logic if needed
      return null;
    }
    console.error('Runtime API error:', e);
    return null;
  }
}

// Test mode initialization – loads testing-controls.js if needed
function initTestMode() {
  console.log('Initializing test mode');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('testing-controls.js');
  document.head.appendChild(script);
}

// If a room link exists in the URL hash, use it
if (window.location.hash) {
  // Expect roomId[&t=timestamp]
  const hash = window.location.hash.slice(1);
  const parts = hash.split('&t=');
  roomId = parts[0];
  console.log('Found room ID in URL:', roomId);
  // Optionally, you could use the "t" parameter to immediately set currentTime.
  joinRoom(roomId);
}

// Check if we're on Netflix and inject the controller if needed
function checkForNetflix() {
  isNetflix = window.location.hostname.includes('netflix.com');
  if (isNetflix && !netflixInjected) {
    injectNetflixController();
  }
}

// Inject the Netflix controller script
function injectNetflixController() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('netflix-injector.js');
    document.head.appendChild(script);
    window.addEventListener('message', (event) => {
      if (event.data && event.data.source === 'movsy_netflix') {
        if (event.data.status === 'ready') {
          console.log('Netflix controller injected successfully');
          netflixInjected = true;
        }
        // When the Netflix player posts its current time:
        if (event.data.currentTime !== undefined) {
          if (!ignoreEvents) {
            chrome.runtime.sendMessage({
              type: 'videoEvent',
              eventName: event.data.isPlaying ? 'play' : 'pause',
              currentTime: event.data.currentTime
            });
          }
        }
      }
    });
  } catch (err) {
    console.error('Failed to inject Netflix controller:', err);
  }
}

// Main video sync functionality
function setupVideoSync() {
  checkForNetflix();
  const video = findVideoElement();
  if (!video) {
    console.log('No video element found, retrying in 2 seconds');
    setTimeout(setupVideoSync, 2000);
    return;
  }
  console.log('Found video element, setting up sync');

  // If URL hash contains "test", initialize test mode.
  if (window.location.hash.includes('test')) {
    initTestMode();
  }

  // Listen for local video events (using "seeked" for seeking)
  video.addEventListener('play', () => {
    if (ignoreEvents) return;
    console.log('Video played at:', video.currentTime);
    safeRuntimeCall(() => 
      chrome.runtime.sendMessage({
        type: 'videoEvent',
        eventName: 'play',
        currentTime: video.currentTime
      })
    );
  });
  
  video.addEventListener('pause', () => {
    if (ignoreEvents) return;
    console.log('Video paused at:', video.currentTime);
    safeRuntimeCall(() => 
      chrome.runtime.sendMessage({
        type: 'videoEvent',
        eventName: 'pause',
        currentTime: video.currentTime
      })
    );
  });
  
  video.addEventListener('seeked', () => {
    if (ignoreEvents) return;
    console.log('Video seeked to:', video.currentTime);
    safeRuntimeCall(() => 
      chrome.runtime.sendMessage({
        type: 'videoEvent',
        eventName: 'seek',
        currentTime: video.currentTime
      })
    );
  });

  // Listen for sync commands and chat messages
  const messageListener = setupMessageListeners();
  
  try {
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Add listener removal on page unload
    window.addEventListener('beforeunload', () => {
      try {
        chrome.runtime.onMessage.removeListener(messageListener);
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
  } catch (e) {
    console.error('Failed to add message listener:', e);
  }
}

// Find video element for various sites
function findVideoElement() {
  if (window.location.hostname.includes('youtube.com')) {
    return document.querySelector('video.html5-main-video');
  }
  if (window.location.hostname.includes('netflix.com')) {
    const netflixPlayer = document.querySelector('.NFPlayer');
    if (netflixPlayer) {
      const video = netflixPlayer.querySelector('video');
      if (video) return video;
    }
    const videoPlayer = document.querySelector('.VideoContainer video');
    if (videoPlayer) return videoPlayer;
    console.log("Alternate Netflix video selector used");
    return document.querySelector('video');
  }
  if (window.location.hostname.includes('disneyplus.com')) {
    return document.querySelector('video.btm-media-client-element');
  }
  if (window.location.hostname.includes('primevideo.com') ||
      window.location.hostname.includes('amazon.com')) {
    return document.querySelector('video.webPlayerElement');
  }
  return document.querySelector('video');
}

// Improved joinRoom function with better chat handling
function joinRoom(id) {
  roomId = id;
  
  // If the URL hash does not match the roomId, update it and reload
  const currentHash = window.location.hash.slice(1);
  const video = findVideoElement();
  const currentTime = video ? Math.floor(video.currentTime) : 0;
  
  if (!currentHash.startsWith(roomId)) {
    window.location.hash = roomId + '&t=' + currentTime;
    console.log('Room link generated, reloading page to sync state...');
    setTimeout(() => { location.reload(); }, 500);
    return;
  }
  
  console.log('🚪 Joining room:', roomId);
  
  // Wait for username to be initialized before joining
  const joinWithUsername = () => {
    if (!username) {
      console.log('Waiting for username initialization...');
      setTimeout(joinWithUsername, 500);
      return;
    }
    
    safeRuntimeCall(() => chrome.runtime.sendMessage({ type: 'getConnectionStatus' }, (connectionResponse) => {
      if (!connectionResponse || !connectionResponse.connected) {
        console.log('⚠️ Server not connected, waiting before joining room...');
        setTimeout(() => joinRoom(roomId), 3000);
        return;
      }
      
      safeRuntimeCall(() => chrome.runtime.sendMessage({
        type: 'joinRoom',
        roomId: roomId,
        username: username
      }, (joinResponse) => {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('❌ Error joining room:', error);
          setTimeout(() => joinRoom(roomId), 5000);
          return;
        }
        
        if (joinResponse && joinResponse.success) {
          console.log('✅ Successfully joined room:', roomId);
          addSystemMessage(`You joined room ${roomId}`);
          
          // Create UI if needed, then update room ID display
          createChatUI();
          const roomIdElement = document.getElementById('vs-room-id');
          if (roomIdElement) {
            roomIdElement.textContent = roomId;
          }
          
          // Show chat interface
          toggleChatVisibility(true);
          
          // Request chat history
          fetchChatHistory();
        } else {
          console.log('❌ Failed to join room:', joinResponse?.reason || 'unknown reason');
          setTimeout(() => joinRoom(roomId), 5000);
        }
      }));
    }));
  };
  
  // Start the join process
  joinWithUsername();
}

// Update connection indicator (if UI is present)
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

// Add a system chat message
function addSystemMessage(text) {
  addChatMessage({ isSystem: true, text });
}

// Add a chat message to the floating UI
function addChatMessage(message) {
  const chatMessages = document.getElementById('vs-chat-messages');
  if (!chatMessages) return;
  const msgEl = document.createElement('div');
  if (message.isSystem) {
    msgEl.className = 'vs-message system';
    msgEl.textContent = message.text;
  } else {
    const isSent = message.username === username;
    msgEl.className = `vs-message ${isSent ? 'sent' : 'received'}`;
    const sender = document.createElement('span');
    sender.className = 'vs-sender';
    sender.textContent = message.username || 'Anonymous';
    const text = document.createElement('span');
    text.textContent = message.text;
    if (message.timestamp) {
      const time = document.createElement('span');
      time.className = 'vs-timestamp';
      time.textContent = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      msgEl.appendChild(time);
    }
    msgEl.appendChild(sender);
    msgEl.appendChild(document.createElement('br'));
    msgEl.appendChild(text);
  }
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Render chat history in the UI
function renderChatHistory() {
  const chatMessages = document.getElementById('vs-chat-messages');
  if (!chatMessages) return;
  chatMessages.innerHTML = '';
  messageHistory.forEach(msg => addChatMessage(msg));
}

// Initialize video sync with error handling
try {
  setupVideoSync();
} catch (e) {
  console.error('Error setting up video sync:', e);
}

// For Netflix, poll for player readiness and inject controller
if (window.location.hostname.includes('netflix.com')) {
  try {
    pollForNetflix();
  } catch (e) {
    console.error('Error starting Netflix polling:', e);
  }
}

// Add listener for extension context changes
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Extension context invalidated')) {
    console.log('Extension context was invalidated. The extension was likely reloaded or disabled.');
    // You could attempt to gracefully handle this situation
    // For example, show a UI notification that sync is disabled
  }
});

function pollForNetflix() {
  if (window.location.hostname.includes('netflix.com')) {
    const checkNetflix = setInterval(() => {
      if (
        window.netflix &&
        window.netflix.appContext &&
        window.netflix.appContext.state &&
        window.netflix.appContext.state.playerApp
      ) {
        console.log('Netflix player detected, injecting controller');
        clearInterval(checkNetflix);
        injectNetflixController();
      }
    }, 1000);
    setTimeout(() => { clearInterval(checkNetflix); }, 30000);
  }
}

// Listen for sync commands and chat messages with better error handling
function setupMessageListeners() {
  const messageListener = (message, sender, sendResponse) => {
    try {
      // Video control commands
      if (message.type === 'videoControl') {
        // ...existing code for video control...
        console.log('Received control command:', message);
        ignoreEvents = true;
        try {
          if (isNetflix && netflixInjected) {
            // Forward control to Netflix via postMessage.
            window.postMessage({
              source: 'movsy_extension',
              action: message.action,
              time: message.time,
              playbackRate: 1.0
            }, '*');
          } else {
            // Standard video element control (YouTube, etc.)
            if (message.action === 'play') {
              if (Math.abs(video.currentTime - message.time) > 0.5) {
                video.currentTime = message.time;
              }
              video.play().catch(err => console.error('Error playing video:', err));
            } else if (message.action === 'pause') {
              video.currentTime = message.time;
              video.pause();
            } else if (message.action === 'seek') {
              video.currentTime = message.time;
            }
          }
        } catch (err) {
          console.error('Error executing command:', err);
        }
        setTimeout(() => { ignoreEvents = false; }, 500);
      }
      
      // Server connection status
      if (message.type === 'serverConnectionStatus') {
        connected = message.connected;
        updateConnectionIndicator(connected);
        console.log('Server connection status:', connected ? 'Connected' : 'Disconnected');
      }
      
      // Handle chat messages - improved to check roomId
      if (message.type === 'chatMessage') {
        // Only process messages for our current room
        if (message.roomId === roomId || !message.roomId) {
          // Add to message history if not duplicate (check by timestamp)
          const isDuplicate = messageHistory.some(msg => 
            msg.timestamp === message.timestamp && 
            msg.username === message.username && 
            msg.text === message.text
          );
          
          if (!isDuplicate) {
            messageHistory.push(message);
            if (chatVisible) {
              addChatMessage(message);
            }
          }
        }
      }
      
      // Member updates
      if (message.type === 'memberUpdate') {
        updateMemberCount(message.memberCount);
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  };

  // Add listener with proper error handling
  try {
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Add listener removal on page unload
    window.addEventListener('beforeunload', () => {
      try {
        chrome.runtime.onMessage.removeListener(messageListener);
      } catch (e) {
        // Ignore errors during cleanup
      }
    });
  } catch (e) {
    console.error('Failed to add message listener:', e);
  }
  
  return messageListener;
}

// Fetch chat history specifically - separate function for better reusability
function fetchChatHistory() {
  if (!roomId) return;
  
  console.log('📜 Fetching chat history for room:', roomId);
  safeRuntimeCall(() => chrome.runtime.sendMessage({
    type: 'getChatHistory',
    roomId: roomId
  }, (response) => {
    if (response && response.messages && response.messages.length > 0) {
      console.log(`📨 Received ${response.messages.length} chat messages from history`);
      
      // Replace message history with new messages
      messageHistory = response.messages;
      
      // Render in UI if visible
      if (chatVisible) {
        renderChatHistory();
      }
    } else {
      console.log('No chat history available or room is new');
    }
  }));
}

// Create or show chat UI
function createChatUI() {
  if (document.getElementById('vs-chat-container')) {
    return; // Already created
  }
  
  // Create floating chat UI
  const chatContainer = document.createElement('div');
  chatContainer.id = 'vs-chat-container';
  chatContainer.className = 'vs-chat-container';
  
  // Add chat header, messages area, input, etc.
  // ...existing code for creating chat UI...
  
  document.body.appendChild(chatContainer);
}

// Toggle chat visibility
function toggleChatVisibility(show) {
  chatVisible = show !== undefined ? show : !chatVisible;
  
  const chatContainer = document.getElementById('vs-chat-container');
  if (chatContainer) {
    chatContainer.style.display = chatVisible ? 'block' : 'none';
    
    if (chatVisible) {
      // Re-render messages when made visible
      renderChatHistory();
    }
  }
}

// Initialize video sync
function initializeSync() {
  try {
    // Setup message listeners first
    setupMessageListeners();
    
    // Then setup video sync
    setupVideoSync();
    
    // Create refresh button for chat
    createRefreshButton();
  } catch (e) {
    console.error('Error setting up video sync:', e);
  }
}

// Create a refresh button for chat
function createRefreshButton() {
  // Add a refresh button to get the latest messages
  const chatHeader = document.querySelector('.vs-chat-header');
  if (chatHeader) {
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄';
    refreshBtn.className = 'vs-refresh-btn';
    refreshBtn.title = 'Refresh chat messages';
    refreshBtn.onclick = fetchChatHistory;
    chatHeader.appendChild(refreshBtn);
  }
}

// Start initialization
initializeSync();
