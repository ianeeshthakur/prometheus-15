import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import './HlsPlayer.css';

// Real HLS player -- docs/frontend.md §5's remaining "real WHEP/HLS playback" item.
// Uses hls.js for browsers without native HLS support (everything except Safari),
// falling back to the <video> tag's native HLS for Safari (canPlayType). This is a
// genuinely real player: given a real, reachable .m3u8 URL producing real segments,
// it plays real video. What it can't do is make a stream exist -- there is no
// reachable real ingest host from this environment (docs/backend.md §12.7.1), and
// server/'s own local transcode path needs a real rtsp_url on the camera plus a real
// ffmpeg binary on the server host (GET /api/health/'s ffmpeg_available flag) to
// produce anything to play. When either is missing, this shows a real error state
// instead of a placeholder that could be mistaken for a working feed.
function HlsPlayer({ src, onError }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | playing | error
  const [errorDetail, setErrorDetail] = useState('');

  useEffect(() => {
    if (!src) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    setStatus('loading');
    setErrorDetail('');

    let hls;
    const handlePlaying = () => setStatus('playing');
    video.addEventListener('playing', handlePlaying);

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari: native HLS support, no hls.js needed.
      video.src = src;
      video.addEventListener('error', () => {
        const msg = 'Playback failed -- the stream may not exist yet or has no segments.';
        setStatus('error');
        setErrorDetail(msg);
        if (onError) onError(msg);
      });
    } else if (Hls.isSupported()) {
      hls = new Hls({ maxLoadingRetry: 2 });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          const msg = `${data.type}: ${data.details}`;
          setStatus('error');
          setErrorDetail(msg);
          if (onError) onError(msg);
        }
      });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      setStatus('error');
      setErrorDetail('This browser supports neither native HLS nor Media Source Extensions.');
    }

    return () => {
      video.removeEventListener('playing', handlePlaying);
      if (hls) hls.destroy();
    };
  }, [src, onError]);

  return (
    <div className="hls-player-wrap">
      <video ref={videoRef} className="hls-player-video" autoPlay muted playsInline controls />
      {status === 'loading' && <div className="hls-player-overlay">Connecting…</div>}
      {status === 'error' && (
        <div className="hls-player-overlay hls-player-error">
          <span>Playback failed</span>
          <small>{errorDetail}</small>
        </div>
      )}
    </div>
  );
}

export default HlsPlayer;
