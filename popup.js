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
  
  chrome.runtime.sendMessage({type: 'getConnectionStatus'}, response => {
    if (response && response.connected) {
      statusDiv.textContent = 'Connected to sync server';
      statusDiv.className = 'status connected';
    } else {
      statusDiv.textContent = 'Not connected to sync server';
      statusDiv.className = 'status disconnected';
    }
  });
}

// Get current room ID from active tab
async function updateRoomInfo() {
  const tab = await getActiveTab();
  const roomInput = document.getElementById('roomId');
  
  // Try to extract room from URL hash
  const url = new URL(tab.url);
  if (url.hash) {
    const roomId = url.hash.slice(1);
    roomInput.value = roomId;
  } else {
    roomInput.value = 'Not in a sync room';
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check connection status
  checkConnection();
  
  // Update room info
  updateRoomInfo();
  
  // Copy link button
  document.getElementById('copyLink').addEventListener('click', async () => {
    const tab = await getActiveTab();
    const roomInput = document.getElementById('roomId');
    
    if (roomInput.value && roomInput.value !== 'Not in a sync room') {
      // Make sure URL has the room hash
      const url = new URL(tab.url);
      url.hash = roomInput.value;
      
      // Copy to clipboard
      navigator.clipboard.writeText(url.toString())
        .then(() => {
          alert('Sync link copied to clipboard!');
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
    
    // Update URL
    chrome.tabs.update(tab.id, {
      url: `${tab.url.split('#')[0]}#${roomId}`
    });
    
    // Close popup
    window.close();
  });
  
  // Options button
  document.getElementById('options').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
});
