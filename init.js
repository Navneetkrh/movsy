/**
 * Video Sync Initialization Module
 * This ensures proper loading of styles and resources
 */

console.log('🚀 Video Sync init script loaded');

// Function to inject CSS into the page
function injectCSS(path) {
  return new Promise((resolve, reject) => {
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.type = 'text/css';
      link.href = chrome.runtime.getURL(path);
      
      link.onload = () => {
        console.log(`✓ CSS injected: ${path}`);
        resolve(true);
      };
      
      link.onerror = (err) => {
        console.error(`× Failed to load CSS: ${path}`, err);
        reject(err);
      };
      
      document.head.appendChild(link);
    } catch (err) {
      console.error('Error injecting CSS:', err);
      reject(err);
    }
  });
}

// Function to check if a video is present on the page
function findVideo() {
  // Try various selectors for different platforms
  const selectors = [
    'video',                              // Generic
    'video.html5-main-video',             // YouTube
    'video.VideoPlayer',                  // Netflix
    'video.btm-media-client-element',     // Disney+
    'video.webPlayerElement'              // Prime Video
  ];
  
  for (const selector of selectors) {
    const video = document.querySelector(selector);
    if (video) {
      console.log(`✓ Found video element with selector: ${selector}`);
      return video;
    }
  }
  
  console.log('× No video element found yet');
  return null;
}

// Start initialization process
async function initialize() {
  console.group('Video Sync Initialization');
  
  try {
    // Inject styles
    await injectCSS('soft-theme.css');
    
    // Check if we're on a page with video
    const checkVideo = () => {
      const video = findVideo();
      
      if (video) {
        console.log('✓ Video found, initializing sync UI');
        // The content script will handle the rest
      } else {
        console.log('Waiting for video to appear...');
        setTimeout(checkVideo, 2000);
      }
    };
    
    // Start checking for video
    checkVideo();
    
    console.log('✓ Initialization complete');
  } catch (error) {
    console.error('× Initialization failed:', error);
  }
  
  console.groupEnd();
}

// Run initialization
initialize();
