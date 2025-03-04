/**
 * Video Sync Error Handling Utilities
 * Add this file to your project to improve error handling
 */

// Safe chrome messaging with error handling
function sendMessageWithErrorHandling(message, callback = null) {
  try {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.warn(`Message error: ${chrome.runtime.lastError.message}`, message);
        if (callback) callback(null);
        return;
      }
      if (callback) callback(response);
    });
  } catch (err) {
    console.error('Failed to send message:', err, message);
    if (callback) callback(null);
  }
}

// Safe element creation with error handling
function safeCreateElement(parent, type, className = null, id = null, content = null) {
  try {
    if (!parent) {
      console.warn('Parent element not found for', type, className);
      return null;
    }
    
    const element = document.createElement(type);
    if (className) element.className = className;
    if (id) element.id = id;
    if (content) element.textContent = content;
    
    parent.appendChild(element);
    return element;
  } catch (err) {
    console.error('Failed to create element:', err, type, className);
    return null;
  }
}

// Safe element access with fallback
function getElementSafe(id, fallback = null) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with id ${id} not found`);
    return fallback;
  }
  return element;
}

// Debug helper
function debugState(state) {
  console.group('Video Sync Debug');
  console.log('Connected:', state.connected);
  console.log('Room ID:', state.roomId);
  console.log('Username:', state.username);
  console.log('Chat visible:', state.chatVisible);
  console.groupEnd();
}

// Export utilities
window.vsUtils = {
  sendMessage: sendMessageWithErrorHandling,
  createElement: safeCreateElement,
  getElement: getElementSafe,
  debugState
};
