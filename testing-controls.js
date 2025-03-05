console.log('Video control testing script loaded');

let isPlaying = true;
let testPhase = 0;

function runTest() {
  let message;
  const player = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
  let currentTime = 0;
  
  if (player) {
    const sessionId = player.getAllPlayerSessionIds()[0];
    const netflixPlayer = player.getVideoPlayerBySessionId(sessionId);
    currentTime = netflixPlayer.getCurrentTime() / 1000;
  }
  
  switch (testPhase % 4) {
    case 0: // Play
      message = {
        source: 'movsy_extension',
        action: 'play',
        time: currentTime,
        playbackRate: 1.0
      };
      console.log('TEST: Playing video');
      break;
    case 1: // Pause
      message = {
        source: 'movsy_extension',
        action: 'pause',
        time: currentTime,
        playbackRate: 1.0
      };
      console.log('TEST: Pausing video');
      break;
    case 2: // Seek forward
      message = {
        source: 'movsy_extension',
        action: 'seek',
        time: currentTime + 30, // Seek 30 seconds forward
        isPlaying: true,
        playbackRate: 1.0
      };
      console.log('TEST: Seeking +30s');
      break;
    case 3: // Seek backward
      message = {
        source: 'movsy_extension',
        action: 'seek',
        time: Math.max(0, currentTime - 15), // Seek 15 seconds back
        isPlaying: true,
        playbackRate: 1.0
      };
      console.log('TEST: Seeking -15s');
      break;
  }
  
  window.postMessage(message, '*');
  testPhase++;
}

// Start the test cycle
setInterval(runTest, 5000);
