import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ("Notification" in window && "serviceWorker" in navigator) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!isSupported) {
      // Silently fail if push notifications are not supported (e.g. in embedded preview)
      console.warn("Push notifications are not supported in this environment");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        toast.success("Notifications enabled!");
        
        // Subscribe to push notifications
        await subscribeToPush();
        return true;
      } else {
        toast.info("You can enable notifications later in your browser settings");
        return false;
      }
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  const subscribeToPush = async () => {
    if (!user) return;

    try {
      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;
      
      // For now, just enable local notifications
      // Push notifications with VAPID keys can be added later
      const subscription = null;

      // Store subscription in Supabase (when available)
      if (subscription) {
        await supabase.from("push_subscriptions").upsert({
          user_id: user.id,
          subscription: subscription as any,
          updated_at: new Date().toISOString(),
        });
      }
      
      console.log("Local notifications enabled");
    } catch (error) {
      console.error("Error subscribing to push:", error);
    }
  };

  const sendLocalNotification = (title: string, options?: NotificationOptions) => {
    if (permission === "granted" && isSupported) {
      new Notification(title, {
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        ...options,
      });
    }
  };

  return {
    permission,
    isSupported,
    requestPermission,
    sendLocalNotification,
  };
};

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
