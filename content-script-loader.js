/**
 * Ensures proper loading of CSS and injects overlay when the page is ready
 */

// Load the soft theme CSS
function loadThemeCSS() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('soft-theme.css');
  document.head.appendChild(link);
  console.log('Video Sync: Soft theme CSS loaded');
}

// Initialize the overlay UI
function initOverlay() {
  // Check if script is already injected
  if (document.getElementById('vs-overlay-script')) {
    console.log('Video Sync: Overlay script already loaded');
    return;
  }
  
  // Inject the overlay script
  const script = document.createElement('script');
  script.id = 'vs-overlay-script';
  script.src = chrome.runtime.getURL('overlay-chat.js');
  document.body.appendChild(script);
  
  console.log('Video Sync: Overlay script injected');
}

// Main initialization function
function initialize() {
  loadThemeCSS();
  
  // Wait for document to be fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOverlay);
  } else {
    initOverlay();
  }
}

// Start initialization
initialize();
