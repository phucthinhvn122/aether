import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

const THRESHOLD = 96;

/** Follows new content while the user is at the bottom; stops following when they scroll up. */
export function useStickToBottom(ref: RefObject<HTMLElement | null>, deps: unknown[], resetKey: unknown) {
  const stick = useRef(true);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
    stick.current = true;
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < THRESHOLD;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [ref]);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [resetKey, scrollToBottom]);

  useLayoutEffect(() => {
    if (stick.current) {
      const el = ref.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, deps);

  return scrollToBottom;
}
