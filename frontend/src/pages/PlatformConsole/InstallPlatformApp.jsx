import { useEffect, useRef, useState } from 'react';
import s from './PlatformConsole.module.css';

export default function InstallPlatformApp() {
  const promptRef = useRef(null);
  const helpRef = useRef(null);
  const [installed, setInstalled] = useState(() =>
    window.matchMedia('(display-mode: standalone)').matches || Boolean(navigator.standalone));

  useEffect(() => {
    const capturePrompt = event => { event.preventDefault(); promptRef.current = event; };
    const onInstalled = () => { promptRef.current = null; setInstalled(true); };
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', onInstalled);

    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = '/platform.webmanifest';
    document.head.appendChild(manifest);
    const appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    const oldIcon = appleIcon?.getAttribute('href');
    appleIcon?.setAttribute('href', '/admin/icons/apple-touch-icon-v2.png');
    const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const oldTitle = appleTitle?.content;
    if (appleTitle) appleTitle.content = 'ICSS Platform';

    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/platform-sw.js', { scope: '/platform', updateViaCache: 'none' })
        .catch(error => console.warn('Platform app setup unavailable:', error.message));
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', onInstalled);
      manifest.remove();
      if (appleIcon && oldIcon !== null) appleIcon.setAttribute('href', oldIcon);
      if (appleTitle) appleTitle.content = oldTitle;
    };
  }, []);

  async function install() {
    const event = promptRef.current;
    if (!event) { helpRef.current?.showModal(); return; }
    promptRef.current = null;
    try {
      await event.prompt();
      if ((await event.userChoice).outcome === 'accepted') setInstalled(true);
    } catch {
      helpRef.current?.showModal();
    }
  }

  if (installed) return null;
  return <>
    <button className={s.installApp} type="button" onClick={install}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m-5-5 5 5 5-5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
      <span>Install platform app</span>
    </button>
    <dialog ref={helpRef} className={s.installDialog} aria-labelledby="platformInstallTitle">
      <img src="/admin/icons/app-192-v2.png" alt="" width="64" height="64" />
      <h2 id="platformInstallTitle">Your console, one tap away</h2>
      <p>Add ICSS Platform to your home screen for quick access to tenants, payments and platform tools.</p>
      <p><strong>Android or computer:</strong> open your browser menu and choose Install app or Add to Home screen.</p>
      <p><strong>iPhone or iPad:</strong> open this page in Safari, tap Share, then Add to Home Screen and Add.</p>
      <p>Sign in with your usual platform account. An internet connection is needed to manage the platform.</p>
      <form method="dialog"><button className={s.btnPrimary}>Got it</button></form>
    </dialog>
  </>;
}
