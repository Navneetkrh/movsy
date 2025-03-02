

script.onload = () => {
  chrome.storage.sync.get(['serverUrl'], (result) => {
    const serverUrl = result.serverUrl || 'https://your-vercel-server-url'; // Replace with your Vercel server URL
    socket = io(serverUrl);

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
      video.currentTime = data.currentTime;
      video.play();
    });

    socket.on('pause', (data) => {
      video.currentTime = data.currentTime;
      video.pause();
    });

    socket.on('seeked', (data) => {
      video.currentTime = data.currentTime;
    });
  } else {
    console.log('No video element found on this page.');
  }
});
};
