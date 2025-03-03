// Get currently active tab
function getActiveTab() {
  return new Promise(resolve => {
    chrome.tabs.query({active: true, currentWindow: true}, tabs => {
      resolve(tabs[0]);
    });
  });
}

// Get connection status from background
function checkConnection() {
  const statusDiv = document.getElementById('connectionStatus');
  const statusIndicator = statusDiv.querySelector('.status-indicator');
  
  chrome.runtime.sendMessage({type: 'getConnectionStatus'}, response => {
    if (response && response.connected) {
      statusDiv.className = 'status connected';
      statusIndicator.className = 'status-indicator connected';
      statusDiv.querySelector('span').textContent = 'Connected to sync server';
    } else {
      statusDiv.className = 'status disconnected';
      statusIndicator.className = 'status-indicator disconnected';
      statusDiv.querySelector('span').textContent = 'Not connected to server';
    }
  });
}

// Get current room ID from active tab
async function updateRoomInfo() {
  const tab = await getActiveTab();
  const roomInput = document.getElementById('roomId');
  
  // Try to extract room from URL hash
  if (tab && tab.url) {
    const url = new URL(tab.url);
    if (url.hash) {
      const roomId = url.hash.slice(1);
      roomInput.value = roomId;
    } else {
      roomInput.value = 'Not in a sync room';
    }
  } else {
    roomInput.value = 'No active tab';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Update footer with author
  document.querySelector('.footer').textContent = "Made by Navneet";
  
  // Check connection status
  checkConnection();
  
  // Update room info
  updateRoomInfo();
  
  // Copy link button
  document.getElementById('copyLink').addEventListener('click', async () => {
    const tab = await getActiveTab();
    const roomInput = document.getElementById('roomId');
    
    if (roomInput.value && roomInput.value !== 'Not in a sync room' && roomInput.value !== 'No active tab') {
      // Make sure URL has the room hash
      const url = new URL(tab.url);
      url.hash = roomInput.value;
      
      // Copy to clipboard
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          const copyBtn = document.getElementById('copyLink');
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Sync Link';
          }, 1500);
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          prompt('Copy this sync link:', url.toString());
        });
    } else {
      alert('No active sync room');
    }
  });
  
  // Create room button
  document.getElementById('createRoom').addEventListener('click', async () => {
    const tab = await getActiveTab();
    
    // Generate new room ID
    const roomId = Math.random().toString(36).substring(2, 8);
    
    if (tab && tab.url) {
      // Update URL with new room ID
      const url = new URL(tab.url);
      url.hash = roomId;
      
      // Navigate to new URL
      chrome.tabs.update(tab.id, {
        url: url.toString()
      });
    }
    
    // Close popup
    window.close();
  });
  
  // Options button
  document.getElementById('options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
