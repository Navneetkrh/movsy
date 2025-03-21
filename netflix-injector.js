function getPlayer() {
    const { videoPlayer } = window.netflix.appContext.state.playerApp.getAPI();
    const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
    return videoPlayer.getVideoPlayerBySessionId(playerSessionId);
  }
  
  window.addEventListener('message', (event) => {
    if (!event.data || !event.data.action || event.data.source !== 'movsy_extension') {
      return;
    }
    try {
      const player = getPlayer();
      if (event.data.playbackRate) {
        player.setPlaybackRate(event.data.playbackRate);
      }
      switch (event.data.action) {
        case 'play':
          player.play();
          break;
        case 'pause':
          player.pause();
          break;
        case 'seek':
          // Convert seconds to milliseconds for Netflix API
          player.seek(event.data.time * 1000);
          break;
        case 'getTime':
          window.postMessage({
            source: 'movsy_netflix',
            currentTime: player.getCurrentTime() / 1000,
            isPlaying: !player.isPaused()
          }, '*');
          break;
      }
    } catch (err) {
      console.error('Netflix player control error:', err);
    }
  });
  
  // Signal that the Netflix injector is ready
  window.postMessage({ source: 'movsy_netflix', status: 'ready' }, '*');
  