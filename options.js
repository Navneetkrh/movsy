document.addEventListener('DOMContentLoaded', function() {
  const serverUrlInput = document.getElementById('serverUrl');
  const testConnectionBtn = document.getElementById('testConnection');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const saveDisplaySettingsBtn = document.getElementById('saveDisplaySettings');
  const statusDiv = document.getElementById('connectionStatus');
  
  // Toggle options
  const autoCollapseToggle = document.getElementById('autoCollapse');
  const showNotificationsToggle = document.getElementById('showNotifications');
  const autoJoinRoomsToggle = document.getElementById('autoJoinRooms');
  const chatHistoryLimitSelect = document.getElementById('chatHistoryLimit');

  const serverUrl = 'ws://movsy-production.up.railway.app/';
  
  // Load current settings
  loadSettings();
  
  // Save server settings button
  saveSettingsBtn.addEventListener('click', function() {
    const serverUrl = serverUrlInput.value.trim();
    
    if (!serverUrl) {
      showStatus('error', 'Please enter a valid server URL');
      return;
    }
    
    // Save settings
    chrome.storage.sync.set({ serverUrl: serverUrl }, function() {
      showStatus('success', 'Settings saved successfully!');
      
      // Update background script
      chrome.runtime.sendMessage({ 
        type: 'updateServerUrl',
        url: serverUrl
      });
    });
  });
  
  // Save display settings button
  saveDisplaySettingsBtn.addEventListener('click', function() {
    const settings = {
      autoCollapse: autoCollapseToggle.checked,
      showNotifications: showNotificationsToggle.checked,
      autoJoinRooms: autoJoinRoomsToggle.checked,
      chatHistoryLimit: parseInt(chatHistoryLimitSelect.value)
    };
    
    chrome.storage.sync.set(settings, function() {
      showStatus('success', 'Display settings saved successfully!');
    });
  });
  
  // Test connection button
  testConnectionBtn.addEventListener('click', function() {
    const serverUrl = serverUrlInput.value.trim();
    
    if (!serverUrl) {
      showStatus('error', 'Please enter a valid server URL');
      return;
    }
    
    showStatus('pending', 'Testing connection...');
    
    // Try HTTP endpoint first (for health check)
    const httpUrl = serverUrl.replace(/^ws/, 'http');
    
    fetch(`${httpUrl}/health`, { 
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    })
    .then(response => {
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      return response.json();
    })
    .then(data => {
      showStatus('success', `Connected successfully! Server has ${data.rooms || 0} active rooms and ${data.connections || 0} connections.`);
    })
    .catch(error => {
      console.warn('HTTP connection test failed:', error);
      // Fall back to WebSocket test
      testWebSocketConnection(serverUrl);
    });
  });
  
  // Test WebSocket connection directly
  function testWebSocketConnection(url) {
    try {
      const ws = new WebSocket(url);
      
      ws.onopen = function() {
        showStatus('success', 'WebSocket connection successful!');
        
        // Close test connection after success
        setTimeout(() => {
          ws.close();
        }, 1000);
      };
      
      ws.onerror = function(error) {
        console.error('WebSocket test error:', error);
        showStatus('error', 'Connection failed. Check the URL and make sure the server is running.');
      };
      
      // Set a timeout for the connection
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          showStatus('error', 'Connection timed out. Check the URL and make sure the server is running.');
          ws.close();
        }
      }, 5000);
    } catch (err) {
      console.error('WebSocket test error:', err);
      showStatus('error', `Invalid WebSocket URL format: ${err.message}`);
    }
  }
  
  // Show status message
  function showStatus(type, message) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Clear after some time for success messages
    if (type === 'success') {
      setTimeout(() => {
        statusDiv.style.opacity = '0';
        setTimeout(() => {
          statusDiv.style.display = 'none';
          statusDiv.style.opacity = '1';
        }, 300);
      }, 3000);
    }
  }
  
  // Load all settings
  function loadSettings() {
    chrome.storage.sync.get(
      [
        'serverUrl', 
        'autoCollapse', 
        'showNotifications', 
        'autoJoinRooms', 
        'chatHistoryLimit'
      ], 
      function(items) {
        // Server URL
        if (items.serverUrl) {
          serverUrlInput.value = items.serverUrl;
        } else {
          serverUrlInput.value = 'ws://movsy-production.up.railway.app/';
        }
        
        // Display settings
        autoCollapseToggle.checked = items.autoCollapse !== false; // Default true
        showNotificationsToggle.checked = items.showNotifications !== false; // Default true
        autoJoinRoomsToggle.checked = items.autoJoinRooms !== false; // Default true
        
        // Chat history limit
        if (items.chatHistoryLimit) {
          // Find the correct option in the select box
          const options = chatHistoryLimitSelect.options;
          for (let i = 0; i < options.length; i++) {
            if (options[i].value == items.chatHistoryLimit) {
              chatHistoryLimitSelect.selectedIndex = i;
              break;
            }
          }
        }
      }
    );
  }
});
