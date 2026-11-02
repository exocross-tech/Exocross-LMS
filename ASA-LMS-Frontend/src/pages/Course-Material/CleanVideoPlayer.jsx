import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
} from "lucide-react";
import "./CleanVideoPlayer.css";

// Helper to format seconds to mm:ss or hh:mm:ss
const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
  }
  return `${m}:${s < 10 ? "0" : ""}${s}`;
};

export const CleanVideoPlayer = ({ videoId, title = "Course Video" }) => {
  const containerRef = useRef(null);
  const iframeHolderRef = useRef(null);
  const playerRef = useRef(null);
  const progressTimerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isEnded, setIsEnded] = useState(false);

  // Initialize YouTube Player via IFrame API
  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;

    const setupPlayer = () => {
      if (!isMounted || !iframeHolderRef.current || playerRef.current) return;

      try {
        playerRef.current = new window.YT.Player(iframeHolderRef.current, {
          videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (!isMounted) return;
              setIsReady(true);
              try {
                const dur = event.target.getDuration();
                if (dur && !isNaN(dur)) setDuration(dur);
                const vol = event.target.getVolume();
                if (typeof vol === "number") setVolume(vol);
              } catch (e) {
                // ignore
              }
            },
            onStateChange: (event) => {
              if (!isMounted) return;
              // YT.PlayerState: UNSTARTED (-1), ENDED (0), PLAYING (1), PAUSED (2), BUFFERING (3), CUED (5)
              if (event.data === 1) {
                setIsPlaying(true);
                setIsBuffering(false);
                setIsEnded(false);
              } else if (event.data === 2) {
                setIsPlaying(false);
                setIsBuffering(false);
              } else if (event.data === 3) {
                setIsBuffering(true);
              } else if (event.data === 0) {
                setIsPlaying(false);
                setIsBuffering(false);
                setIsEnded(true);
              }
            },
            onError: (err) => {
              console.warn("YouTube player error:", err);
            },
          },
        });
      } catch (err) {
        console.error("Failed to initialize YT.Player:", err);
      }
    };

    // Load API if not already present
    if (!window.YT || !window.YT.Player) {
      if (!document.getElementById("yt-iframe-api-script")) {
        const tag = document.createElement("script");
        tag.id = "yt-iframe-api-script";
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName("script")[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }

      const existingCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (existingCallback) existingCallback();
        setupPlayer();
      };
    } else {
      setupPlayer();
    }

    return () => {
      isMounted = false;
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        try {
          playerRef.current.destroy();
        } catch (e) {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId]);

  // Track current time while playing
  useEffect(() => {
    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
          try {
            const curr = playerRef.current.getCurrentTime() || 0;
            const dur = playerRef.current.getDuration() || 0;
            setCurrentTime(curr);
            if (dur && dur !== duration) setDuration(dur);
          } catch (e) {
            // ignore
          }
        }
      }, 250);
    } else {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, duration]);

  // Controls visibility timeout
  const resetControlsTimer = useCallback(() => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 2500);
    }
  }, [isPlaying]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  const handleTogglePlay = () => {
    if (!playerRef.current) return;
    try {
      if (isEnded) {
        playerRef.current.seekTo(0);
        playerRef.current.playVideo();
        setIsEnded(false);
      } else if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.warn("Playback error:", e);
    }
    resetControlsTimer();
  };

  const handleSeek = (e) => {
    if (!playerRef.current || !duration) return;
    const newProgress = parseFloat(e.target.value);
    const targetSeconds = (newProgress / 100) * duration;
    setCurrentTime(targetSeconds);
    try {
      playerRef.current.seekTo(targetSeconds, true);
    } catch (err) {
      // ignore
    }
    resetControlsTimer();
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    if (!playerRef.current) return;
    try {
      if (val === 0) {
        playerRef.current.mute();
        setIsMuted(true);
      } else {
        if (isMuted) {
          playerRef.current.unMute();
          setIsMuted(false);
        }
        playerRef.current.setVolume(val);
      }
    } catch (err) {
      // ignore
    }
    resetControlsTimer();
  };

  const handleToggleMute = () => {
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
        if (volume === 0) setVolume(50);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (err) {
      // ignore
    }
    resetControlsTimer();
  };

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
      }).catch((e) => console.warn("Fullscreen request error:", e));
    } else {
      document.exitFullscreen?.().then(() => {
        setIsFullscreen(false);
      }).catch((e) => console.warn("Exit fullscreen error:", e));
    }
    resetControlsTimer();
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={`cm-clean-player-container ${isFullscreen ? "is-fullscreen" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* VIEWPORT WITH SCALED/CROPPED IFRAME TO HIDE YOUTUBE TITLE, LOGO, SHARE & BOTTOM WATERMARK */}
      <div className="cm-clean-player-viewport">
        <div className="cm-clean-iframe-crop-box">
          <div ref={iframeHolderRef} className="cm-clean-iframe-element" />
        </div>
      </div>

      {/* TRANSPARENT CLICK SHIELD: CAPTURES HOVER & CLICKS SO BROWSER NEVER HOVERS ON YT LINKS */}
      <div
        className="cm-clean-click-shield"
        onClick={handleTogglePlay}
        onDoubleClick={handleToggleFullscreen}
        title={isPlaying ? "Click to Pause" : "Click to Play"}
      />

      {/* CENTER BIG PLAY / REPLAY BUTTON OVERLAY (SHOWN WHEN PAUSED OR ENDED) */}
      {!isPlaying && (
        <div className="cm-clean-center-play-overlay" onClick={handleTogglePlay}>
          <div className="cm-clean-center-play-btn" title={isEnded ? "Replay Video" : "Play Video"}>
            {isEnded ? <RotateCcw size={32} /> : <Play size={32} fill="#ffffff" />}
          </div>
        </div>
      )}

      {/* BUFFERING SPINNER */}
      {isBuffering && (
        <div className="cm-clean-buffering-overlay">
          <div className="cm-clean-buffering-spinner" />
        </div>
      )}

      {/* CUSTOM NORMAL VIDEO CONTROLS BAR */}
      <div
        className={`cm-clean-controls-bar ${controlsVisible || !isPlaying ? "is-visible" : "is-hidden"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* PROGRESS / TIMELINE BAR */}
        <div className="cm-clean-timeline-wrapper">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progressPercent || 0}
            onChange={handleSeek}
            className="cm-clean-timeline-input"
            style={{
              background: `linear-gradient(to right, #00f0ff 0%, #00f0ff ${progressPercent}%, rgba(255, 255, 255, 0.2) ${progressPercent}%, rgba(255, 255, 255, 0.2) 100%)`,
            }}
          />
        </div>

        {/* BOTTOM CONTROLS ROW */}
        <div className="cm-clean-controls-row">
          <div className="cm-clean-controls-left">
            {/* PLAY / PAUSE BUTTON */}
            <button
              type="button"
              className="cm-clean-ctrl-btn"
              onClick={handleTogglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} fill="#ffffff" />}
            </button>

            {/* TIME DISPLAY */}
            <div className="cm-clean-time-text">
              <span>{formatTime(currentTime)}</span>
              <span className="cm-clean-time-sep">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="cm-clean-controls-right">
            {/* VOLUME / MUTE */}
            <div className="cm-clean-volume-group">
              <button
                type="button"
                className="cm-clean-ctrl-btn"
                onClick={handleToggleMute}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="cm-clean-volume-slider"
                style={{
                  background: `linear-gradient(to right, #00f0ff 0%, #00f0ff ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.2) ${isMuted ? 0 : volume}%, rgba(255, 255, 255, 0.2) 100%)`,
                }}
              />
            </div>

            {/* FULLSCREEN */}
            <button
              type="button"
              className="cm-clean-ctrl-btn"
              onClick={handleToggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CleanVideoPlayer;
