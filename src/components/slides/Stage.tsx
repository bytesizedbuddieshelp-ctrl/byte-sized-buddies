import type { ComponentChildren } from 'preact';
import type { Slide } from '../../lib/slides';
import { SlideCanvas, SlideFrame } from './SlideCanvas';

interface StageProps {
  slide: Slide;
  lessonName: string;
  imageUrl: (file: string) => string;
  blank: boolean;
  tryText?: string | null;
  children?: ComponentChildren;
}

// One slide as big as the window allows, on black, with nothing else on screen.
// The audience window and the single-window mode both use it.
export function Stage({ slide, lessonName, imageUrl, blank, tryText, children }: StageProps) {
  return (
    <div class="stage">
      <div class="stage-frame">
        <SlideFrame>
          <SlideCanvas slide={slide} lessonName={lessonName} imageUrl={imageUrl} timerText={tryText ?? undefined} />
        </SlideFrame>
        {blank && <div class="stage-blank" />}
      </div>
      {children}
    </div>
  );
}
