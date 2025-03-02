// background.js

console.log("Background script loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Video Sync extension installed");
});

chrome.storage.sync.get(['serverUrl'], (result) => {
  const serverUrl = result.serverUrl || 'https://movsy-production.up.railway.app/'; // Replace with your Vercel server URL
  const socket = io(serverUrl);

socket.on('connect', () => {
  console.log('Connected to Socket.IO server');
});
});
