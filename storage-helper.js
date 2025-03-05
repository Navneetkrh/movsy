/**
 * Storage Helper for Video Sync Extension
 * Provides consistent access to storage across different contexts
 */

const StorageHelper = {
  // Set a value in local storage
  setLocal: function(key, value) {
    return new Promise((resolve, reject) => {
      try {
        // Use chrome.storage.local when available
        if (chrome.storage && chrome.storage.local) {
          const data = {};
          data[key] = value;
          chrome.storage.local.set(data, () => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.error('Error setting local storage:', error);
              reject(error);
            } else {
              resolve(true);
            }
          });
        } 
        // Fall back to localStorage in non-extension contexts or for testing
        else if (window.localStorage) {
          window.localStorage.setItem(key, JSON.stringify(value));
          resolve(true);
        } 
        // No storage available
        else {
          reject(new Error('No storage mechanism available'));
        }
      } catch (err) {
        console.error('Storage access error:', err);
        reject(err);
      }
    });
  },
  
  // Get a value from local storage
  getLocal: function(key) {
    return new Promise((resolve, reject) => {
      try {
        // Use chrome.storage.local when available
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.get([key], (result) => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.error('Error getting from local storage:', error);
              reject(error);
            } else {
              resolve(result[key]);
            }
          });
        } 
        // Fall back to localStorage in non-extension contexts or for testing
        else if (window.localStorage) {
          const value = window.localStorage.getItem(key);
          try {
            resolve(JSON.parse(value));
          } catch (e) {
            resolve(value);
          }
        } 
        // No storage available
        else {
          reject(new Error('No storage mechanism available'));
        }
      } catch (err) {
        console.error('Storage access error:', err);
        reject(err);
      }
    });
  },
  
  // Set a value in sync storage (for settings)
  setSync: function(key, value) {
    return new Promise((resolve, reject) => {
      try {
        if (chrome.storage && chrome.storage.sync) {
          const data = {};
          data[key] = value;
          chrome.storage.sync.set(data, () => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.error('Error setting sync storage:', error);
              reject(error);
            } else {
              resolve(true);
            }
          });
        } else {
          // Fall back to local storage if sync isn't available
          this.setLocal(key, value)
            .then(resolve)
            .catch(reject);
        }
      } catch (err) {
        console.error('Storage access error:', err);
        reject(err);
      }
    });
  },
  
  // Get a value from sync storage
  getSync: function(key) {
    return new Promise((resolve, reject) => {
      try {
        if (chrome.storage && chrome.storage.sync) {
          chrome.storage.sync.get([key], (result) => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.error('Error getting from sync storage:', error);
              reject(error);
            } else {
              resolve(result[key]);
            }
          });
        } else {
          // Fall back to local storage if sync isn't available
          this.getLocal(key)
            .then(resolve)
            .catch(reject);
        }
      } catch (err) {
        console.error('Storage access error:', err);
        reject(err);
      }
    });
  },
  
  // Clear a specific key from storage
  removeLocal: function(key) {
    return new Promise((resolve, reject) => {
      try {
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(key, () => {
            const error = chrome.runtime.lastError;
            if (error) {
              console.error('Error removing from local storage:', error);
              reject(error);
            } else {
              resolve(true);
            }
          });
        } else if (window.localStorage) {
          window.localStorage.removeItem(key);
          resolve(true);
        } else {
          reject(new Error('No storage mechanism available'));
        }
      } catch (err) {
        console.error('Storage access error:', err);
        reject(err);
      }
    });
  }
};

// Export for both browser and CommonJS environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageHelper;
} else {
  window.StorageHelper = StorageHelper;
}
