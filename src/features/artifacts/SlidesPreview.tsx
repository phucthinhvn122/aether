import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/cn';
import { Markdown } from '../markdown/Markdown';
import { splitSlides, type SlideSource } from './slides';

export const SLIDE_WIDTH = 960;
export const SLIDE_HEIGHT = 540;
const BODY_FONT_MAX = 24;
const BODY_FONT_MIN = 13;

/** One 960×540 slide. The body font shrinks until the content fits. */
export function Slide({ slide, index, total }: { slide: SlideSource; index: number; total: number }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(slide.cover ? 26 : BODY_FONT_MAX);

  useLayoutEffect(() => {
    setFontSize(slide.cover ? 26 : BODY_FONT_MAX);
  }, [slide.body, slide.cover]);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && fontSize > BODY_FONT_MIN) setFontSize((s) => s - 1);
  }, [fontSize, slide.body]);

  return (
    <div className={cn('slide paper-theme', slide.cover && 'slide-cover')} data-slide={index}>
      <div className="slide-accent" />
      <div className="slide-content">
        {slide.title && (
          <>
            <div className="slide-title">{slide.title}</div>
            <div className="slide-rule" />
          </>
        )}
        {slide.body && (
          <div ref={bodyRef} className="slide-body" style={{ fontSize }}>
            <Markdown content={slide.body} />
          </div>
        )}
      </div>
      {!slide.cover && (
        <div className="slide-number">
          {index + 1} / {total}
        </div>
      )}
    </div>
  );
}

export function SlidesPreview({ content }: { content: string }) {
  const slides = useMemo(() => splitSlides(content), [content]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = width ? Math.min(width / SLIDE_WIDTH, 1) : 0;

  return (
    <div className="flex flex-col items-center gap-4 bg-muted/40 px-3 py-4 sm:px-6">
      <div ref={rootRef} className="flex w-full max-w-[960px] flex-col gap-4">
        {scale > 0 &&
          slides.map((slide, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-lg border border-line shadow-sm"
              style={{ width: SLIDE_WIDTH * scale, height: SLIDE_HEIGHT * scale }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <Slide slide={slide} index={i} total={slides.length} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
