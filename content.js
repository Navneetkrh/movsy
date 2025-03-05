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
        
        // Request sync after successful join
        setTimeout(() => {
          chrome.runtime.sendMessage({
            type: 'requestSync',
            roomId: roomId
          }, syncResponse => {
            if (syncResponse && syncResponse.currentTime !== undefined) {
              const video = findVideoElement();
              if (video) {
                video.currentTime = syncResponse.currentTime;
                console.log('⏱️ Synced video to:', syncResponse.currentTime);
              }
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

// Initialize video sync
setupVideoSync();