console.log('Video Sync content script loaded');

// Initialize state
let connected = false;
let roomId = null;
let isController = false;
let ignoreEvents = false;
let chatVisible = false;
let username = localStorage.getItem('videoSync_username') || 'Guest_' + Math.floor(Math.random() * 1000);
let messageHistory = [];
let isNetflix = false;
let netflixInjected = false;

// Add this function near the top with other initialization code
function initTestMode() {
  console.log('Initializing test mode');
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('testing-controls.js');
  document.head.appendChild(script);
}

// Try to get room ID from URL hash
if (window.location.hash) {
  roomId = window.location.hash.slice(1);
  console.log('Found room ID in URL:', roomId);
  
  // Join the room
  joinRoom(roomId);
}

// Check if we're on Netflix and inject the controller if needed
function checkForNetflix() {
  isNetflix = window.location.hostname.includes('netflix.com');
  
  if (isNetflix && !netflixInjected) {
    injectNetflixController();
  }
}

// Inject Netflix controller script
function injectNetflixController() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('netflix-injector.js');
    document.head.appendChild(script);
    
    // Listen for messages from the injected script
    window.addEventListener('message', (event) => {
      // Only process messages from our injected script
      if (event.data && event.data.source === 'movsy_netflix') {
        if (event.data.status === 'ready') {
          console.log('Netflix controller injected successfully');
          netflixInjected = true;
        }
        
        // Handle time update from Netflix player
        if (event.data.currentTime !== undefined) {
          // Forward this to sync server if needed
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

// Video sync functionality
function setupVideoSync() {
  // Check if we're on Netflix
  checkForNetflix();
  
  // Find video element
  const video = findVideoElement();
 
  
  if (!video) {
    console.log('No video element found, retrying in 2 seconds');
    setTimeout(setupVideoSync, 2000);
    return;
  }
  
  console.log('Found video element, setting up sync');
  
  // Add this line to start testing
  if (window.location.hash.includes('test')) {
    initTestMode();
  }

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
  
  video.addEventListener('seek', () => {
    if (ignoreEvents) return;
    
    console.log('Video seek to:', video.currentTime);
    chrome.runtime.sendMessage({
      type: 'videoEvent',
      eventName: 'seek',
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
        if (isNetflix && netflixInjected) {
          // Use Netflix injected controller
          window.postMessage({
            source: 'movsy_extension',
            action: message.action,
            time: message.time,
            playbackRate: 1.0
          }, '*');
        } else {
          // Standard video element control
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
          } else if (message.action === 'seek') {
            video.currentTime = message.time;
          }
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
  

}

// Find video element
function findVideoElement() {
  // YouTube specific
  if (window.location.hostname.includes('youtube.com')) {
    return document.querySelector('video.html5-main-video');
  }
  
  // Netflix specific
  if (window.location.hostname.includes('netflix.com')) {
    // Try Netflix player container first (more reliable)
    const netflixPlayer = document.querySelector('.NFPlayer');
    if (netflixPlayer) {
      const video = netflixPlayer.querySelector('video');
      if (video) return video;
    }
    
    // Try alternate Netflix selectors
    const videoPlayer = document.querySelector('.VideoContainer video');
    if (videoPlayer) return videoPlayer;
    console.log("alternate video selector used");
    
    // Fallback to any video element as last resort
    return document.querySelector('video');
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
        
        // Request sync after successful join - with enhanced playback time sync
        setTimeout(() => {
          // Request current playback position from other members
          chrome.runtime.sendMessage({
            type: 'requestPlaybackStatus',
            roomId: roomId
          }, playbackResponse => {
            if (playbackResponse && playbackResponse.currentTime !== undefined) {
              console.log('🔄 Syncing to current playback time:', playbackResponse.currentTime);
              
              // Get video element
              const video = findVideoElement();
              if (video) {
                // Set flag to ignore our own events
                ignoreEvents = true;
                
                // Handle sync for Netflix differently
                if (isNetflix && netflixInjected) {
                  window.postMessage({
                    source: 'movsy_extension',
                    action: playbackResponse.isPlaying ? 'play' : 'pause',
                    time: playbackResponse.currentTime,
                    playbackRate: 1.0
                  }, '*');
                } else {
                  // Set video time and playback state for other platforms
                  video.currentTime = playbackResponse.currentTime;
                  
                  // Match playback state (play if others are playing, pause otherwise)
                  if (playbackResponse.isPlaying) {
                    video.play().catch(err => console.error('Error auto-playing video:', err));
                  } else {
                    video.pause();
                  }
                }
                
                // Reset flag after a delay
                setTimeout(() => {
                  ignoreEvents = false;
                }, 1000);
              }
            } else {
              console.log('No playback status received or room is new');
              
              // Fallback to basic sync request
              chrome.runtime.sendMessage({
                type: 'requestSync',
                roomId: roomId
              });
            }
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

// Poll for Netflix player readiness
function pollForNetflix() {
  if (window.location.hostname.includes('netflix.com')) {
    const checkNetflix = setInterval(() => {
      if (window.netflix && window.netflix.appContext && 
          window.netflix.appContext.state && 
          window.netflix.appContext.state.playerApp) {
        console.log('Netflix player detected, injecting controller');
        clearInterval(checkNetflix);
        injectNetflixController();
      }
    }, 1000);
    
    // Stop checking after 30 seconds
    setTimeout(() => {
      clearInterval(checkNetflix);
    }, 30000);
  }
}

// Initialize video sync
setupVideoSync();

// For Netflix, monitor page for player initialization
if (window.location.hostname.includes('netflix.com')) {
  pollForNetflix();
}