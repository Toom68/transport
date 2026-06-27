import { useEffect, useRef } from 'react';
import { useWeatherStore } from '@/store/weatherStore';
import { isRaining } from '@/types/weather';

interface RainOverlayProps {
  intensity?: number; // 0..1 multiplier on opacity
}

// Chroma-keys the green-screen rain video in real-time on a canvas and
// composites it over the window view. The first 8 seconds of the source
// video are an intro slate, so we start playback at 8s.
export function RainOverlay({ intensity = 1 }: RainOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const condition = useWeatherStore((s) => s.condition);
  const visible = isRaining(condition);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  // Main render loop — always mounted so refs are valid when rain starts.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;

      if (visibleRef.current && video.readyState >= 2 && !video.paused) {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(video, 0, 0, W, H);

        try {
          const imageData = ctx.getImageData(0, 0, W, H);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            const isGreen = g > 80 && g > r * 1.4 && g > b * 1.4;

            if (isGreen) {
              data[i + 3] = 0;
            } else {
              const greenness = (g - Math.max(r, b)) / 255;
              if (greenness > 0) {
                data[i + 3] = Math.round(data[i + 3] * (1 - greenness * 2));
                data[i + 1] = Math.min(g, (r + b) / 2 + 20);
              }
            }
          }

          ctx.putImageData(imageData, 0, 0);
        } catch {
          // getImageData can fail if canvas is tainted — skip this frame.
        }
      } else {
        ctx.clearRect(0, 0, W, H);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  // Control video playback based on visibility.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (visible) {
      video.currentTime = 8;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [visible]);

  // Loop the video, always skipping the intro.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      // If we somehow drift back before the skip point, jump forward.
      if (video.currentTime < 8) {
        video.currentTime = 8;
      }
    };

    const onEnded = () => {
      video.currentTime = 8;
      video.play().catch(() => {});
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('ended', onEnded);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  return (
    <>
      <video
        ref={videoRef}
        src="/videos/rain-overlay.mp4"
        muted
        loop
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          top: 0,
          left: 0,
        }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          width: '100%',
          height: '100%',
          opacity: visible ? intensity : 0,
          mixBlendMode: 'screen',
        }}
      />
    </>
  );
}
