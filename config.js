// Simple configuration object
const config = {
  serverUrl: 'ws://movsy-production.up.railway.app/',  // Make sure this matches your server address
  debug: true,
  version: '1.0.0'
};

// Make it globally accessible
window.config = config;

// Log configuration on load
console.log('📋 Video Sync config loaded:', config);

// Skip health checks - they cause CORS issues
