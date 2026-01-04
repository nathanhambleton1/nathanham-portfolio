import { useEffect } from 'react';

let lockCount = 0;

export default function useLockBodyScroll(active: boolean, options?: { scrollToTop?: boolean }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (active) {
      // Optionally scroll to top before locking so header becomes visible
      if (options?.scrollToTop && typeof window !== 'undefined') {
        try {
          window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch (e) {}
      }

      lockCount = Math.max(0, lockCount) + 1;
      try {
        document.body.style.overflow = 'hidden';
      } catch (e) {}
    }

    return () => {
      if (active) {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) {
          try {
            document.body.style.overflow = '';
          } catch (e) {}
        }
      }
    };
  }, [active, options?.scrollToTop]);
}
