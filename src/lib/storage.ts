// Persistent storage utilities for app preferences
const STORAGE_KEYS = {
  STAY_SIGNED_IN: 'medimind_stay_signed_in',
  NOTIFICATION_PREFS: 'medimind_notification_prefs',
} as const;

export const storage = {
  // Stay Signed In preference
  getStaySignedIn: (): boolean => {
    try {
      const value = localStorage.getItem(STORAGE_KEYS.STAY_SIGNED_IN);
      return value === 'true';
    } catch {
      return false;
    }
  },
  
  setStaySignedIn: (value: boolean): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.STAY_SIGNED_IN, String(value));
    } catch (error) {
      console.error('Failed to save stay signed in preference:', error);
    }
  },
  
  // Notification preferences
  getNotificationPrefs: () => {
    try {
      const prefs = localStorage.getItem(STORAGE_KEYS.NOTIFICATION_PREFS);
      return prefs ? JSON.parse(prefs) : null;
    } catch {
      return null;
    }
  },
  
  setNotificationPrefs: (prefs: any): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATION_PREFS, JSON.stringify(prefs));
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    }
  },
  
  clearAll: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  },
};
