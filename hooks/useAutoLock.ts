
import { useEffect, useRef, useCallback } from 'react';

export const useAutoLock = (isLocked: boolean, lockFn: () => void, timeoutMinutes: number = 15) => {
  const timerRef = useRef<number | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }
    if (!isLocked && timeoutMinutes > 0) {
      timerRef.current = window.setTimeout(() => {
        console.log("Auto-lock triggered due to inactivity.");
        lockFn();
      }, timeoutMinutes * 60 * 1000);
    }
  }, [isLocked, timeoutMinutes, lockFn]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetTimer();

    // Initial setup
    resetTimer();

    if (!isLocked) {
      events.forEach(event => window.addEventListener(event, handleActivity));
    }

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [isLocked, resetTimer]);
};
