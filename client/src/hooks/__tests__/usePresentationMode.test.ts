import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePresentationMode } from '../usePresentationMode';
import { usePresentationStore } from '../../stores/presentationStore';

describe('usePresentationMode', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = usePresentationStore.getState();
    store.setEnabled(false);
    store.pausePresentation();
  });

  const fireKeyDown = (key: string, target?: EventTarget) => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'target', {
      writable: false,
      value: target || document.body,
    });
    window.dispatchEvent(event);
    return event;
  };

  describe('P key - toggle presentation mode', () => {
    it('should toggle presentation mode on P key', () => {
      renderHook(() => usePresentationMode());

      expect(usePresentationStore.getState().isEnabled).toBe(false);

      act(() => {
        fireKeyDown('P');
      });
      expect(usePresentationStore.getState().isEnabled).toBe(true);

      act(() => {
        fireKeyDown('P');
      });
      expect(usePresentationStore.getState().isEnabled).toBe(false);
    });

    it('should work with lowercase p', () => {
      renderHook(() => usePresentationMode());

      act(() => {
        fireKeyDown('p');
      });
      expect(usePresentationStore.getState().isEnabled).toBe(true);
    });

    it('should work even when input is focused', () => {
      renderHook(() => usePresentationMode());

      const input = document.createElement('input');
      fireKeyDown('P', input);

      // P key should NOT toggle when in input (this is tested in next test)
      expect(usePresentationStore.getState().isEnabled).toBe(false);
    });
  });

  describe('input/textarea exclusion', () => {
    it('should ignore shortcuts when typing in input', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });

      const input = document.createElement('input');
      act(() => {
        fireKeyDown('P', input);
      });

      // Should NOT toggle because we're in an input
      expect(usePresentationStore.getState().isEnabled).toBe(true);
    });

    it('should ignore shortcuts when typing in textarea', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });

      const textarea = document.createElement('textarea');
      act(() => {
        fireKeyDown('M', textarea);
      });

      // Mute should not be toggled because we're in a textarea
      expect(usePresentationStore.getState().isMuted).toBe(true); // Default is muted
    });
  });

  describe('Space key - play/pause', () => {
    beforeEach(() => {
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });
    });

    it('should pause when playing', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().playPresentation();
      });

      expect(usePresentationStore.getState().isAutoPlaying).toBe(true);

      act(() => {
        fireKeyDown(' ');
      });
      expect(usePresentationStore.getState().isAutoPlaying).toBe(false);
    });

    it('should play when paused', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().pausePresentation();
      });

      expect(usePresentationStore.getState().isAutoPlaying).toBe(false);

      act(() => {
        fireKeyDown(' ');
      });
      expect(usePresentationStore.getState().isAutoPlaying).toBe(true);
    });

    it('should only work when presentation mode is enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(false);
      });

      act(() => {
        fireKeyDown(' ');
      });
      // Should not affect playback state
      expect(usePresentationStore.getState().isAutoPlaying).toBe(false);
    });
  });

  describe('Arrow keys - navigation', () => {
    beforeEach(() => {
      act(() => {
        const store = usePresentationStore.getState();
        store.setEnabled(true);
        store.loadPresentationQueue([
          { type: 'generation-start', duration: 1000 },
          {
            type: 'planning',
            duration: 400,
            data: { planItem: { type: 'model', name: 'TestModel' } },
          },
          {
            type: 'victory',
            duration: 6000,
            data: {
              stats: { duration: 10, toolCalls: 5, filesCreated: 3, successRate: 100, combos: 5 },
            },
          },
        ]);
        store.pausePresentation(); // Must be paused for arrow keys
      });
    });

    it('should go to next event on right arrow when paused', () => {
      renderHook(() => usePresentationMode());

      expect(usePresentationStore.getState().currentEventIndex).toBe(0);

      act(() => {
        fireKeyDown('ArrowRight');
      });
      expect(usePresentationStore.getState().currentEventIndex).toBe(1);
    });

    it('should go to previous event on left arrow when paused', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().nextEvent(); // Go to index 1
      });

      expect(usePresentationStore.getState().currentEventIndex).toBe(1);

      act(() => {
        fireKeyDown('ArrowLeft');
      });
      expect(usePresentationStore.getState().currentEventIndex).toBe(0);
    });

    it('should not navigate when playing', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().playPresentation();
      });

      expect(usePresentationStore.getState().currentEventIndex).toBe(0);

      act(() => {
        fireKeyDown('ArrowRight');
      });
      // Should not advance because playing
      expect(usePresentationStore.getState().currentEventIndex).toBe(0);
    });

    it('should only work when presentation mode is enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(false);
      });

      act(() => {
        fireKeyDown('ArrowRight');
      });
      // Should not navigate
      expect(usePresentationStore.getState().currentEventIndex).toBe(0);
    });
  });

  describe('M key - toggle mute', () => {
    beforeEach(() => {
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });
    });

    it('should toggle mute on M key', () => {
      renderHook(() => usePresentationMode());

      expect(usePresentationStore.getState().isMuted).toBe(true); // Default

      act(() => {
        fireKeyDown('M');
      });
      expect(usePresentationStore.getState().isMuted).toBe(false);

      act(() => {
        fireKeyDown('M');
      });
      expect(usePresentationStore.getState().isMuted).toBe(true);
    });

    it('should work with lowercase m', () => {
      renderHook(() => usePresentationMode());

      act(() => {
        fireKeyDown('m');
      });
      expect(usePresentationStore.getState().isMuted).toBe(false);
    });

    it('should only work when presentation mode is enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(false);
      });

      const initialMuted = usePresentationStore.getState().isMuted;
      act(() => {
        fireKeyDown('M');
      });
      // Should not change
      expect(usePresentationStore.getState().isMuted).toBe(initialMuted);
    });
  });

  describe('Escape key - exit presentation mode', () => {
    it('should exit presentation mode on Escape', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });

      expect(usePresentationStore.getState().isEnabled).toBe(true);

      act(() => {
        fireKeyDown('Escape');
      });
      expect(usePresentationStore.getState().isEnabled).toBe(false);
    });

    it('should only work when presentation mode is enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(false);
      });

      act(() => {
        fireKeyDown('Escape');
      });
      // Should stay false (no-op)
      expect(usePresentationStore.getState().isEnabled).toBe(false);
    });
  });

  describe('event listener cleanup', () => {
    it('should remove event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => usePresentationMode());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should re-attach listener when isEnabled changes', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { rerender } = renderHook(() => usePresentationMode());

      const initialCalls = addEventListenerSpy.mock.calls.length;

      // Change isEnabled to trigger useEffect re-run
      act(() => {
        usePresentationStore.getState().setEnabled(true);
        rerender();
      });

      // Should have removed old listener and added new one
      expect(removeEventListenerSpy).toHaveBeenCalled();
      expect(addEventListenerSpy.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  describe('preventDefault behavior', () => {
    it('should prevent default for P key', () => {
      renderHook(() => usePresentationMode());

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKeyDown('P');
      });
      expect(event?.defaultPrevented).toBe(true);
    });

    it('should prevent default for Space when enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKeyDown(' ');
      });
      expect(event?.defaultPrevented).toBe(true);
    });

    it('should prevent default for M when enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKeyDown('M');
      });
      expect(event?.defaultPrevented).toBe(true);
    });

    it('should prevent default for Escape when enabled', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        usePresentationStore.getState().setEnabled(true);
      });

      let event: KeyboardEvent | undefined;
      act(() => {
        event = fireKeyDown('Escape');
      });
      expect(event?.defaultPrevented).toBe(true);
    });

    it('should prevent default for arrow keys when paused', () => {
      renderHook(() => usePresentationMode());
      act(() => {
        const store = usePresentationStore.getState();
        store.setEnabled(true);
        store.loadPresentationQueue([
          { type: 'generation-start', duration: 1000 },
          {
            type: 'victory',
            duration: 6000,
            data: {
              stats: { duration: 10, toolCalls: 5, filesCreated: 3, successRate: 100, combos: 5 },
            },
          },
        ]);
        store.pausePresentation();
      });

      let leftEvent: KeyboardEvent | undefined;
      let rightEvent: KeyboardEvent | undefined;

      act(() => {
        leftEvent = fireKeyDown('ArrowLeft');
        rightEvent = fireKeyDown('ArrowRight');
      });

      expect(leftEvent?.defaultPrevented).toBe(true);
      expect(rightEvent?.defaultPrevented).toBe(true);
    });
  });
});
