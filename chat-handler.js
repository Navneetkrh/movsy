/**
 * Chat functionality for Video Sync
 * Handles message sending, receiving, and UI for chat
 */

// Store the chat history
let chatHistory = [];
let activeRoomId = null;

// Initialize chat
function initChat(roomId) {
  activeRoomId = roomId;
  console.log('Chat initialized for room:', roomId);
  
  // Load chat history from local storage
  try {
    const savedHistory = localStorage.getItem(`vs_chat_${roomId}`);
    if (savedHistory) {
      chatHistory = JSON.parse(savedHistory);
      console.log(`Loaded ${chatHistory.length} chat messages from history`);
    }
  } catch (err) {
    console.error('Error loading chat history:', err);
  }
  
  return {
    addMessage,
    getHistory,
    clearHistory
  };
}

// Add a message to chat history
function addMessage(message) {
  // Add timestamp if not present
  if (!message.timestamp) {
    message.timestamp = Date.now();
  }
  
  // Add to history
  chatHistory.push(message);
  
  // Limit history size
  if (chatHistory.length > 100) {
    chatHistory.shift();
  }
  
  // Save to local storage
  try {
    localStorage.setItem(`vs_chat_${activeRoomId}`, JSON.stringify(chatHistory));
  } catch (err) {
    console.error('Error saving chat history:', err);
  }
  
  return message;
}

// Get chat history
function getHistory() {
  return chatHistory;
}

// Clear chat history
function clearHistory() {
  chatHistory = [];
  try {
    localStorage.removeItem(`vs_chat_${activeRoomId}`);
  } catch (err) {
    console.error('Error clearing chat history:', err);
  }
}

// Format chat timestamp
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Export functions
window.vsChat = {
  initChat,
  formatTimestamp
};
