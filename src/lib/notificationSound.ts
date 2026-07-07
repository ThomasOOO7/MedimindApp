// Notification sound utility for playing audio alerts

let audioContext: AudioContext | null = null;

// Initialize audio context on first use
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

/**
 * Play a notification sound using Web Audio API
 * @param type - Type of notification (success, error, warning, info)
 */
export const playNotificationSound = (type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  try {
    const ctx = getAudioContext();
    
    // Create oscillator for the beep sound
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Different frequencies for different notification types
    const frequencies = {
      success: [523.25, 659.25], // C5, E5 - pleasant ascending
      error: [493.88, 392.00], // B4, G4 - descending alert
      warning: [587.33, 587.33], // D5, D5 - repeated tone
      info: [523.25, 659.25], // C5, E5 - default pleasant
    };
    
    const [freq1, freq2] = frequencies[type];
    
    // First tone
    oscillator.frequency.setValueAtTime(freq1, ctx.currentTime);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
    
    // Second tone (slightly delayed)
    setTimeout(() => {
      const oscillator2 = ctx.createOscillator();
      const gainNode2 = ctx.createGain();
      
      oscillator2.connect(gainNode2);
      gainNode2.connect(ctx.destination);
      
      oscillator2.frequency.setValueAtTime(freq2, ctx.currentTime);
      gainNode2.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      oscillator2.start(ctx.currentTime);
      oscillator2.stop(ctx.currentTime + 0.15);
    }, 100);
  } catch (error) {
    console.warn('Failed to play notification sound:', error);
  }
};

/**
 * Play a critical alert sound (for missed medications, emergencies)
 */
export const playCriticalAlertSound = () => {
  try {
    const ctx = getAudioContext();
    
    // Play three urgent beeps
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 - urgent
        gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.2);
      }, i * 250);
    }
  } catch (error) {
    console.warn('Failed to play critical alert sound:', error);
  }
};
