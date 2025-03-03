import config from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const testButton = document.getElementById('testConnection');
  const saveButton = document.getElementById('saveSettings');
  const statusDiv = document.getElementById('connectionStatus');
  
  // Load saved settings
  chrome.storage.sync.get(['serverUrl'], (result) => {
    if (result.serverUrl) {
      serverUrlInput.value = result.serverUrl;
    } else {
      serverUrlInput.value = 'ws://localhost:3000';
    }
  });
  
  // Test connection button
  testButton.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value;
    statusDiv.style.display = 'block';
    statusDiv.textContent = 'Testing connection...';
    statusDiv.className = 'status';
    
    // Convert ws:// to http:// for health check
    const httpUrl = serverUrl.replace(/^ws/, 'http');
    
    fetch(`${httpUrl}/health`)
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        statusDiv.textContent = `Connection successful! Server has ${data.rooms || 0} active rooms.`;
        statusDiv.className = 'status success';
      })
      .catch(err => {
        statusDiv.textContent = `Connection failed: ${err.message}`;
        statusDiv.className = 'status error';
      });
  });
  
  // Save settings button
  saveButton.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value;
    
    chrome.storage.sync.set({ serverUrl }, () => {
      statusDiv.textContent = 'Settings saved!';
      statusDiv.className = 'status success';
      statusDiv.style.display = 'block';
      
      // Notify background script to reconnect
      chrome.runtime.sendMessage({ type: 'reconnect', serverUrl });
      
      // Hide message after 3 seconds
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    });
  });
});
