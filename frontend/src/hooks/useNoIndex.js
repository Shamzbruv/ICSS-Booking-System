// hooks/useNoIndex.js — Adds noindex,nofollow to internal app routes at runtime.
// Usage: call useNoIndex() at the top of any page component that should NOT be indexed.
// Public routes (/:slug booking pages) do NOT call this.
import { useEffect } from 'react';

export function useNoIndex() {
  useEffect(() => {
    // Inject or update the robots meta tag for this route
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    const prev = meta.content;
    meta.content = 'noindex, nofollow';

    // Restore on unmount (important for SPA navigation between routes)
    return () => {
      if (prev) {
        meta.content = prev;
      } else {
        meta.remove();
      }
    };
  }, []);
}
