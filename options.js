import config from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const testConnectionBtn = document.getElementById('testConnection');
  const saveSettingsBtn = document.getElementById('saveSettings');
  const statusDiv = document.getElementById('connectionStatus');
  
  // Load saved server URL
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    } else {
      serverUrlInput.value = 'ws://localhost:3000';
    }
  });
  
  // Test connection button
  testConnectionBtn.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value.trim();
    
    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
      showStatus('Error: URL must start with ws:// or wss://', 'error');
      return;
    }
    
    showStatus('Testing connection...', '');
    
    const testUrl = serverUrl.replace(/^ws/, 'http');
    
    fetch(`${testUrl}/health`, { timeout: 5000 })
      .then(response => {
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        return response.json();
      })
      .then(data => {
        showStatus(`Success! Server has ${data.rooms || 0} active rooms and ${data.connections || 0} connections.`, 'success');
      })
      .catch(error => {
        showStatus(`Failed to connect: ${error.message}`, 'error');
        
        // Try WebSocket direct test if HTTP test fails
        try {
          const ws = new WebSocket(serverUrl);
          
          ws.onopen = () => {
            showStatus(`WebSocket connection successful!`, 'success');
            ws.close();
          };
          
          ws.onerror = () => {
            showStatus(`WebSocket connection failed.`, 'error');
          };
        } catch (wsError) {
          console.error('WebSocket test error:', wsError);
        }
      });
  });
  
  // Save settings
  saveSettingsBtn.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value.trim();
    
    if (!serverUrl.startsWith('ws://') && !serverUrl.startsWith('wss://')) {
      showStatus('Error: URL must start with ws:// or wss://', 'error');
      return;
    }
    
    chrome.storage.sync.set({ serverUrl }, () => {
      showStatus('Settings saved successfully!', 'success');
      
      // Notify background script to reconnect
      chrome.runtime.sendMessage({ 
        type: 'reconnect',
        serverUrl: serverUrl
      });
    });
  });
  
  // Helper to show status
  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
  }
});
