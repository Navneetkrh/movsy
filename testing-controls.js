console.log('Video control testing script loaded');

let isPlaying = false;

function togglePlayback() {
  const message = {
    source: 'movsy_extension',
    action: isPlaying ? 'pause' : 'play',
    time: window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer?.getAllPlayerSessionIds()[0] || 0,
    playbackRate: 1.0
  };

  window.postMessage(message, '*');
  isPlaying = !isPlaying;
  console.log(`Video ${isPlaying ? 'played' : 'paused'}`);
}

// Start the test cycle
setInterval(togglePlayback, 5000);
