function getPlayer() {
  try {
    const { videoPlayer } = window.netflix.appContext.state.playerApp.getAPI();
    const playerSessionId = videoPlayer.getAllPlayerSessionIds()[0];
    return videoPlayer.getVideoPlayerBySessionId(playerSessionId);
  } catch (err) {
    console.error('Error getting Netflix player:', err);
    return null;
  }
}

// Helper function to handle seeking properly
function seekToTime(time) {
  try {
    const player = getPlayer();
    if (!player) return false;
    
    // Convert seconds to milliseconds for Netflix API
    const seekTimeMs = Math.floor(time * 1000);
    console.log(`Netflix seek to: ${time}s (${seekTimeMs}ms)`);
    
    // Use both methods for better compatibility
    player.seek(seekTimeMs);
    
    // Some Netflix versions also support this method
    if (typeof player.seekToTime === 'function') {
      player.seekToTime(seekTimeMs);
    }
    
    return true;
  } catch (err) {
    console.error('Netflix seek error:', err);
    return false;
  }
}

// Report current playback state
function reportPlaybackState() {
  try {
    const player = getPlayer();
    if (!player) return;
    
    window.postMessage({
      source: 'movsy_netflix',
      currentTime: player.getCurrentTime() / 1000, // Convert ms to seconds
      isPlaying: !player.isPaused(),
      duration: player.getDuration() / 1000
    }, '*');
  } catch (err) {
    console.error('Error reporting playback state:', err);
  }
}

// Listen for messages from content script
window.addEventListener('message', (event) => {
  if (!event.data || !event.data.source !== 'movsy_extension') {
    return;
  }

  const player = getPlayer();
  if (!player) {
    console.error('Netflix player not found');
    return;
  }
  
  try {
    console.log('Netflix received command:', event.data.action);
    
    if (event.data.playbackRate) {
      player.setPlaybackRate(event.data.playbackRate);
    }

    switch (event.data.action) {
      case 'play':
        if (event.data.time !== undefined) {
          seekToTime(event.data.time);
        }
        player.play();
        break;
        
      case 'pause':
        if (event.data.time !== undefined) {
          seekToTime(event.data.time);
        }
        player.pause();
        break;
        
      case 'seek':
        seekToTime(event.data.time);
        // Maintain playing state after seek
        if (event.data.isPlaying) {
          player.play();
        } else {
          player.pause();
        }
        break;
        
      case 'getTime':
        reportPlaybackState();
        break;
        
      case 'syncStatus':
        // Full synchronization command - seek and match play state
        if (event.data.time !== undefined) {
          seekToTime(event.data.time);
          
          if (event.data.isPlaying) {
            player.play();
          } else {
            player.pause();
          }
        }
        break;
    }
    
    // Send back updated state after any action
    setTimeout(reportPlaybackState, 500);
    
  } catch (err) {
    console.error('Netflix player control error:', err);
  }
});

// Add listener for video time updates
setInterval(reportPlaybackState, 5000);

// Signal that the injector is loaded
window.postMessage({ source: 'movsy_netflix', status: 'ready' }, '*');
console.log('Netflix player controller injected');
