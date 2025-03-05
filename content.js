console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let isController = false;
let ignoreEvents = false;
let chatVisible = false;
let username =
  localStorage.getItem('videoSync_username') ||
  'Guest_' + Math.floor(Math.random() * 1000);
let messageHistory = [];
let isNetflix = false;
let netflixInjected = false;

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
  const messageListener = (message, sender, sendResponse) => {
    if (message.type === 'videoControl') {
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
    if (message.type === 'serverConnectionStatus') {
      connected = message.connected;
      updateConnectionIndicator(connected);
      console.log('Server connection status:', connected ? 'Connected' : 'Disconnected');
    }
    if (message.type === 'chatMessage') {
      messageHistory.push(message);
      if (chatVisible) {
        addChatMessage(message);
      }
    }
    if (message.type === 'memberUpdate') {
      updateMemberCount(message.memberCount);
    }
  };
  
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

// Modified joinRoom: update URL hash with room ID and current time, then reload if needed.
function joinRoom(id) {
  roomId = id;
  // If the URL hash does not match the roomId, update it and reload.
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
        const roomIdElement = document.getElementById('vs-room-id');
        if (roomIdElement) {
          roomIdElement.textContent = roomId;
        }
        
        // Request playback sync and chat history
        setTimeout(() => {
          safeRuntimeCall(() => chrome.runtime.sendMessage({
            type: 'requestPlaybackStatus',
            roomId: roomId
          }, (playbackResponse) => {
            if (playbackResponse && playbackResponse.currentTime !== undefined) {
              console.log('🔄 Syncing to current playback time:', playbackResponse.currentTime);
              const video = findVideoElement();
              if (video) {
                ignoreEvents = true;
                if (isNetflix && netflixInjected) {
                  window.postMessage({
                    source: 'movsy_extension',
                    action: playbackResponse.isPlaying ? 'play' : 'pause',
                    time: playbackResponse.currentTime,
                    playbackRate: 1.0
                  }, '*');
                } else {
                  video.currentTime = playbackResponse.currentTime;
                  if (playbackResponse.isPlaying) {
                    video.play().catch(err => console.error('Error auto-playing video:', err));
                  } else {
                    video.pause();
                  }
                }
                setTimeout(() => { ignoreEvents = false; }, 1000);
              }
            } else {
              console.log('No playback status received or room is new');
              chrome.runtime.sendMessage({
                type: 'requestSync',
                roomId: roomId
              });
            }
          }));
          
          safeRuntimeCall(() => chrome.runtime.sendMessage({
            type: 'getChatHistory',
            roomId: roomId
          }, (response) => {
            if (response && response.messages) {
              messageHistory = response.messages;
              if (chatVisible) {
                renderChatHistory();
              }
            }
          }));
        }, 1000);
      } else {
        console.log('❌ Failed to join room:', joinResponse?.reason || 'unknown reason');
        setTimeout(() => joinRoom(roomId), 5000);
      }
    }));
  }));
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
