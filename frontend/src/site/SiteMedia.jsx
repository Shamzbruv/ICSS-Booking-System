import { useCallback, useEffect, useRef, useState } from 'react';
import s from './TenantWebsite.module.css';
import { isSafeMediaUrl } from './siteSchema';

function prefersLightMedia() {
  if (typeof window === 'undefined') return false;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData;
  return Boolean(reduced || saveData);
}

/**
 * Image that never shows a broken icon: the theme gradient sits behind it and
 * the <img> hides itself if the file can't load.
 */
export function SmartImage({ src, alt = '', className = '', fallback, eager = false, style, field }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  const usable = isSafeMediaUrl(src) && !failed;
  return (
    <div data-site-field={field} className={`${s.smartImage} ${className}`} style={{ background: fallback, ...style }}>
      {usable && (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={eager ? 'high' : undefined}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}

/** Background layer for hero / banners: photo, video, slideshow or plain colour. */
export function HeroBackground({ props, fallback }) {
  const { mediaType = 'image', imageUrl, mobileImageUrl, videoUrl, posterUrl, slides = [] } = props;
  const [lightMode] = useState(prefersLightMedia);
  const [slideIndex, setSlideIndex] = useState(0);
  const [videoFailed, setVideoFailed] = useState(false);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const validSlides = slides.map((slide) => slide?.url).filter(isSafeMediaUrl).filter((url) => !failedImages.has(url));
  const markFailed = (url) => setFailedImages((prev) => new Set(prev).add(url));

  useEffect(() => { setVideoFailed(false); }, [videoUrl]);

  useEffect(() => {
    if (mediaType !== 'slideshow' || validSlides.length < 2 || lightMode) return undefined;
    const timer = window.setInterval(() => setSlideIndex((i) => (i + 1) % validSlides.length), 6000);
    return () => window.clearInterval(timer);
  }, [mediaType, validSlides.length, lightMode]);

  if (mediaType === 'color') return <div className={s.heroMedia} style={{ background: fallback }} />;

  if (mediaType === 'slideshow' && validSlides.length) {
    return (
      <div className={s.heroMedia} style={{ background: fallback }}>
        {validSlides.map((url, index) => (
          <img key={`${url}-${index}`} src={url} alt="" className={`${s.heroSlide} ${index === slideIndex ? s.heroSlideActive : ''}`}
            loading={index === 0 ? 'eager' : 'lazy'} decoding="async" onError={() => markFailed(url)} />
        ))}
      </div>
    );
  }

  const poster = isSafeMediaUrl(posterUrl) ? posterUrl : (isSafeMediaUrl(imageUrl) ? imageUrl : undefined);
  if (mediaType === 'video' && isSafeMediaUrl(videoUrl) && !lightMode && !videoFailed) {
    return (
      <div className={s.heroMedia} style={{ background: fallback }}>
        <video
          key={videoUrl}
          className={s.heroVideo}
          src={videoUrl}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          onError={() => setVideoFailed(true)}
        />
      </div>
    );
  }

  const desktop = mediaType === 'video' ? poster : imageUrl;
  return (
    <div className={s.heroMedia} style={{ background: fallback }}>
      {isSafeMediaUrl(desktop) && !failedImages.has(desktop) && (
        <picture>
          {isSafeMediaUrl(mobileImageUrl) && <source media="(max-width: 700px)" srcSet={mobileImageUrl} />}
          <img src={desktop} alt="" className={s.heroImage} loading="eager" decoding="async" fetchpriority="high" onError={() => markFailed(desktop)} />
        </picture>
      )}
    </div>
  );
}

/** Full-screen gallery viewer with keyboard + swipe navigation. */
export function Lightbox({ images, index, onClose, onIndex }) {
  const touchStart = useRef(null);
  const count = images.length;
  const go = useCallback((delta) => onIndex((index + delta + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [go, onClose]);

  const image = images[index];
  if (!image) return null;
  return (
    <div className={s.lightbox} role="dialog" aria-modal="true" aria-label="Photo viewer"
      onClick={onClose}
      onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (touchStart.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <button type="button" className={s.lightboxClose} aria-label="Close" onClick={onClose}>×</button>
      {count > 1 && <button type="button" className={`${s.lightboxNav} ${s.lightboxPrev}`} aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>}
      <figure className={s.lightboxFigure} onClick={(e) => e.stopPropagation()}>
        <img src={image.url} alt={image.caption || ''} />
        {(image.caption || count > 1) && (
          <figcaption>{image.caption}{count > 1 && <span>{index + 1} / {count}</span>}</figcaption>
        )}
      </figure>
      {count > 1 && <button type="button" className={`${s.lightboxNav} ${s.lightboxNext}`} aria-label="Next photo" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>}
    </div>
  );
}

/**
 * Theme music. Browsers only allow sound after a visitor interacts, so we try
 * to start, and otherwise wait for the first tap / click / key press.
 */
export function MusicPlayer({ music, accentStyle, suppressAutoplay, command }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const userPausedRef = useRef(false);

  useEffect(() => {
    try { userPausedRef.current = sessionStorage.getItem('icss_site_music_paused') === '1'; } catch { /* storage unavailable */ }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = Math.min(1, Math.max(0, Number(music.volume ?? 0.35)));
  }, [music.volume]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => { setPlaying(true); setBlocked(false); }).catch(() => setBlocked(true));
  }, []);

  useEffect(() => {
    if (suppressAutoplay || !music.autoplay || userPausedRef.current) return undefined;
    play();
    const startOnInteraction = () => {
      if (!userPausedRef.current && audioRef.current?.paused) play();
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((name) => window.addEventListener(name, startOnInteraction, { once: true, passive: true }));
    return () => events.forEach((name) => window.removeEventListener(name, startOnInteraction));
  }, [music.url, music.autoplay, suppressAutoplay, play]);

  // Builder preview can start/stop playback explicitly.
  useEffect(() => {
    if (!command) return;
    if (command.play) play();
    else { audioRef.current?.pause(); setPlaying(false); }
  }, [command, play]);

  const toggle = (event) => {
    event.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      userPausedRef.current = false;
      try { sessionStorage.removeItem('icss_site_music_paused'); } catch { /* ignore */ }
      play();
    } else {
      audio.pause();
      setPlaying(false);
      userPausedRef.current = true;
      try { sessionStorage.setItem('icss_site_music_paused', '1'); } catch { /* ignore */ }
    }
  };

  return (
    <div className={`${s.musicPlayer} ${blocked && !playing ? s.musicPlayerPulse : ''}`} style={accentStyle}>
      <audio ref={audioRef} src={music.url} loop preload="none" onPause={() => setPlaying(false)} onPlay={() => setPlaying(true)} />
      <button type="button" onClick={toggle} aria-label={playing ? 'Pause music' : 'Play music'}>
        <span className={s.musicIcon} aria-hidden="true">{playing ? '❚❚' : '♫'}</span>
        <span className={s.musicBars} data-playing={playing ? 'true' : 'false'} aria-hidden="true"><i /><i /><i /></span>
        <span className={s.musicLabel}>{playing ? (music.title || 'Now playing') : (music.title ? `Play · ${music.title}` : 'Play music')}</span>
      </button>
    </div>
  );
}
