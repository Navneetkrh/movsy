// content.js

console.log("Content script loaded");
// Inject Socket.IO client
const script = document.createElement('script');
script.src = 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.4/socket.io.js';
document.head.appendChild(script);

let socket;

script.onload = () => {
  socket = io('https://your-vercel-server-url'); // Replace with your Vercel server URL

  console.log('Socket.IO injected');

  // Listen for video events
  const video = document.querySelector('video');

  if (video) {
    video.addEventListener('play', () => {
      console.log('Video playing');
      socket.emit('play', { currentTime: video.currentTime });
    });

    video.addEventListener('pause', () => {
      console.log('Video paused');
      socket.emit('pause', { currentTime: video.currentTime });
    });

    video.addEventListener('seeked', () => {
      console.log('Video seeked');
      socket.emit('seeked', { currentTime: video.currentTime });
    });

    socket.on('play', (data) => {
      if (video.paused) {
        video.currentTime = data.currentTime;
        video.play();
      }
    });

    socket.on('pause', (data) => {
      if (!video.paused) {
        video.currentTime = data.currentTime;
        video.pause();
      }
    });

    socket.on('seeked', (data) => {
      video.currentTime = data.currentTime;
    });
  } else {
    console.log('No video element found on this page.');
  }
};

// Listen for video events
const video = document.querySelector('video');

if (video) {
  video.addEventListener('play', () => {
    console.log('Video playing');
  });

  video.addEventListener('pause', () => {
    console.log('Video paused');
  });

  video.addEventListener('seeked', () => {
    console.log('Video seeked');
  });
} else {
  console.log('No video element found on this page.');
}