document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const saveButton = document.getElementById('save');

  saveButton.addEventListener('click', () => {
    const serverUrl = serverUrlInput.value;
    chrome.storage.sync.set({ serverUrl: serverUrl }, () => {
      console.log('Server URL saved: ' + serverUrl);
    });
  });

  chrome.storage.sync.get(['serverUrl'], (result) => {
    serverUrlInput.value = result.serverUrl || '';
  });
});
