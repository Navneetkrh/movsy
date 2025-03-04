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
          serverUrlInput.value = 'ws://localhost:3000';
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

/**
 * Options page controller
 * Handles saving and loading options
 */

document.addEventListener('DOMContentLoaded', loadOptions);

// Default options
const defaultOptions = {
  serverUrl: 'ws://localhost:3000',
  reconnectAttempts: 5,
  darkMode: false,
  rememberPosition: true,
  overlayOpacity: 85,
  autoJoin: true,
  autoCollapse: false,
  username: `Guest_${Math.floor(Math.random() * 10000)}`
};

// Load options from storage
function loadOptions() {
  chrome.storage.sync.get(defaultOptions, (options) => {
    document.getElementById('server-url').value = options.serverUrl;
    document.getElementById('reconnect-attempts').value = options.reconnectAttempts;
    document.getElementById('dark-mode').checked = options.darkMode;
    document.getElementById('remember-position').checked = options.rememberPosition;
    document.getElementById('overlay-opacity').value = options.overlayOpacity;
    document.getElementById('auto-join').checked = options.autoJoin;
    document.getElementById('auto-collapse').checked = options.autoCollapse;
    document.getElementById('username').value = options.username;
    
    console.log('Options loaded:', options);
  });
  
  // Add event listeners
  document.getElementById('save-btn').addEventListener('click', saveOptions);
  document.getElementById('reset-btn').addEventListener('click', resetOptions);
}

// Save options to storage
function saveOptions() {
  const options = {
    serverUrl: document.getElementById('server-url').value,
    reconnectAttempts: parseInt(document.getElementById('reconnect-attempts').value) || 5,
    darkMode: document.getElementById('dark-mode').checked,
    rememberPosition: document.getElementById('remember-position').checked,
    overlayOpacity: parseInt(document.getElementById('overlay-opacity').value) || 85,
    autoJoin: document.getElementById('auto-join').checked,
    autoCollapse: document.getElementById('auto-collapse').checked,
    username: document.getElementById('username').value
  };
  
  chrome.storage.sync.set(options, () => {
    showToast('Settings saved successfully!');
    console.log('Options saved:', options);
    
    // Notify background script about server URL change
    chrome.runtime.sendMessage({
      type: 'updateServerUrl',
      url: options.serverUrl
    });
    
    // Notify about username change
    chrome.runtime.sendMessage({
      type: 'updateUsername',
      username: options.username
    });
  });
}

// Reset options to defaults
function resetOptions() {
  if (confirm('Are you sure you want to reset all settings to default values?')) {
    chrome.storage.sync.set(defaultOptions, () => {
      // Reload the form with default values
      loadOptions();
      showToast('Settings have been reset to defaults');
    });
  }
}

// Show toast message
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
