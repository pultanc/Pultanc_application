/**
 * Web Haptic Feedback Utility
 * Provides native vibration / tactile feedback on mobile devices for gestures,
 * swipe navigation, button presses, and transitions.
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'swipe' | 'success' | 'warning' | 'error';

export const triggerHaptic = (type: HapticType = 'light') => {
  if (typeof window === 'undefined' || !('navigator' in window)) return;

  try {
    if (typeof navigator.vibrate === 'function') {
      switch (type) {
        case 'light':
          navigator.vibrate(10);
          break;
        case 'selection':
          navigator.vibrate(8);
          break;
        case 'swipe':
          navigator.vibrate(15);
          break;
        case 'medium':
          navigator.vibrate(25);
          break;
        case 'heavy':
          navigator.vibrate(40);
          break;
        case 'success':
          navigator.vibrate([15, 60, 20]);
          break;
        case 'warning':
          navigator.vibrate([25, 70, 25]);
          break;
        case 'error':
          navigator.vibrate([40, 50, 40, 50, 40]);
          break;
        default:
          navigator.vibrate(10);
      }
    }
  } catch (err) {
    // Graceful fallback for devices or browsers where vibration API is restricted
    console.debug('Haptics not supported or restricted:', err);
  }
};
