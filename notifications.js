/**
 * Notification system for Video Sync
 * Shows Apple-style toast notifications for sync events
 */

// Create notification container if not exists
function getNotificationContainer() {
  let container = document.getElementById('vs-notifications-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'vs-notifications-container';
    container.className = 'vs-notifications-container';
    document.body.appendChild(container);
  }
  return container;
}

// Show a notification
function showNotification(message, type = 'info', duration = 3000) {
  const container = getNotificationContainer();
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `vs-notification ${type}`;
  notification.textContent = message;
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'vs-notification-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.onclick = () => removeNotification(notification);
  notification.appendChild(closeBtn);
  
  // Add to container
  container.appendChild(notification);
  
  // Auto remove
  setTimeout(() => {
    removeNotification(notification);
  }, duration);
  
  return notification;
}

// Remove notification with animation
function removeNotification(notification) {
  notification.classList.add('vs-sliding-out');
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300); // Match animation duration
}

// Initialize and make functions available globally
window.vsNotifications = {
  show: showNotification,
  info: (message, duration) => showNotification(message, 'info', duration),
  success: (message, duration) => showNotification(message, 'success', duration),
  warning: (message, duration) => showNotification(message, 'warning', duration),
  error: (message, duration) => showNotification(message, 'error', duration)
};

console.log('💬 Notification system initialized');
