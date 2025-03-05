function getPlayer() {
  // get the netflix player object
  const { videoPlayer } = window.netflix.appContext.state.playerApp.getAPI();

  // Getting player id
  const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
  const player = videoPlayer.getVideoPlayerBySessionId(playerSessionId);

  return player;
}

window.addEventListener('message', (event) => {
  if (!event.data || !event.data.action || event.data.source !== 'movsy_extension') {
    return; // Ignore irrelevant messages
  }

  try {
    const player = getPlayer();
    
    if (event.data.playbackRate) {
      player.setPlaybackRate(event.data.playbackRate);
    }

    switch (event.data.action) {
      case 'play': {
        player.play();
        break;
      }
      case 'pause': {
        player.pause();
        break;
      }
      case 'seek': {
        player.seek(event.data.time * 1000); // Netflix uses milliseconds
        break;
      }
      case 'getTime': {
        // Return current time back to content script
        window.postMessage({
          source: 'movsy_netflix',
          currentTime: player.getCurrentTime() / 1000, // Convert ms to seconds
          isPlaying: !player.isPaused()
        }, '*');
        break;
      }
    }
  } catch (err) {
    console.error('Netflix player control error:', err);
  }
});

// Signal that the injector is loaded
window.postMessage({ source: 'movsy_netflix', status: 'ready' }, '*');
console.log('Netflix player controller injected');
