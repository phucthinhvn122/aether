import { useEffect } from 'react';

/**
 * Keeps `--app-height` equal to the visible viewport so the composer stays above
 * the on-screen keyboard in iOS Safari (which does not resize the layout viewport).
 */
export function useVisualViewport(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    const root = document.documentElement;
    const update = () => {
      const height = vv ? vv.height : window.innerHeight;
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
      root.style.setProperty('--app-offset-top', `${Math.round(vv ? vv.offsetTop : 0)}px`);
    };
    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
}
