// background.js

console.log("Background script loaded");

chrome.runtime.onInstalled.addListener(() => {
  console.log("Video Sync extension installed");
});

const socket = io('https://your-vercel-server-url'); // Replace with your Vercel server URL

socket.on('connect', () => {
  console.log('Connected to Socket.IO server');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'videoEvent') {
    socket.emit('videoEvent', message.data);
  }
});