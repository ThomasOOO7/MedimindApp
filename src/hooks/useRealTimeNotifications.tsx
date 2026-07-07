import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "./usePushNotifications";
import { toast } from "sonner";
import { playNotificationSound, playCriticalAlertSound } from "@/lib/notificationSound";

export const useRealTimeNotifications = () => {
  const { user } = useAuth();
  const { sendLocalNotification, permission, requestPermission } = usePushNotifications();

  useEffect(() => {
    if (!user) return;

    console.log(`[RealTimeNotifications] Setting up for user: ${user.id}`);

    // Don't auto-request permission - let users enable it from settings
    // This prevents error messages when switching tabs

    // Listen for new notifications
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const notification = payload.new;
          console.log(`[RealTimeNotifications] New notification received:`, notification);

          // Format message without manual timezone conversions to avoid double-shifting times
          let displayMessage = notification.message;
          if (notification.metadata) {
            // For now we trust the time string coming from the backend message itself
            // to avoid discrepancies like showing 4:47 AM instead of 10:17 AM.
            // If we need prettier formatting later, we should store a clear local-time
            // string in metadata and display it directly without extra math.
          }

          // Show in-app toast notification with appropriate sound
          if (notification.type === "missed_dose") {
            playCriticalAlertSound(); // Critical alert with triple beep
            toast.error(notification.title, {
              description: displayMessage,
              duration: 10000,
            });
          } else if (notification.type === "medication_reminder") {
            playNotificationSound('info'); // Pleasant info sound
            toast.info(notification.title, {
              description: displayMessage,
              duration: 8000,
            });
          } else if (notification.type === "medication_confirmation") {
            playNotificationSound('success'); // Success sound
            toast.success(notification.title, {
              description: displayMessage,
              duration: 5000,
            });
          } else if (notification.type === "refill_reminder") {
            playNotificationSound('warning'); // Warning sound
            toast.warning(notification.title, {
              description: displayMessage,
              duration: 8000,
            });
          } else {
            playNotificationSound('info'); // Default info sound
            toast(notification.title, {
              description: displayMessage,
              duration: 5000,
            });
          }
          
          // Send browser notification if permitted
          if (permission === "granted") {
            sendLocalNotification(notification.title, {
              body: displayMessage,
              tag: notification.type,
              requireInteraction: notification.type === "missed_dose",
              icon: "/favicon.ico",
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, permission, sendLocalNotification, requestPermission]);
};
