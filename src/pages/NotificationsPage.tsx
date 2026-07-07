import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCircle, AlertCircle, Info, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

const NotificationsPage = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const [activeTab, setActiveTab] = useState("all");

  const filteredNotifications = notifications.filter((notif) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !notif.is_read;
    return notif.type === activeTab;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "medication_reminder":
      case "reminder":
        return <Bell className="w-5 h-5 text-primary" />;
      case "medication_confirmation":
      case "success":
        return <CheckCircle className="w-5 h-5 text-accent" />;
      case "missed_dose":
      case "alert":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      default:
        return <Info className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <Badge className="bg-destructive rounded-full">{unreadCount}</Badge>
              )}
            </h1>
            <p className="text-muted-foreground mt-1">Stay updated with your medication reminders and alerts</p>
          </div>
          {unreadCount > 0 && (
            <Button 
              variant="outline" 
              className="gap-2 rounded-xl"
              onClick={markAllAsRead}
            >
              <Check className="w-4 h-4" />
              Mark All Read
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="all" className="rounded-lg">All</TabsTrigger>
            <TabsTrigger value="unread" className="rounded-lg">Unread ({unreadCount})</TabsTrigger>
            <TabsTrigger value="medication_reminder" className="rounded-lg">Reminders</TabsTrigger>
            <TabsTrigger value="missed_dose" className="rounded-lg">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-3 mt-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <Card className="rounded-xl border-border/50 shadow-lg">
                <CardContent className="py-12 text-center">
                  <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications to display</p>
                </CardContent>
              </Card>
            ) : (
              filteredNotifications.map((notification) => (
                <Card
                  key={notification.id}
                  className={`transition-all cursor-pointer hover:border-primary rounded-xl border-border/50 shadow-md hover:shadow-lg animate-fade-in ${
                    !notification.is_read ? "border-l-4 border-l-primary bg-primary/5" : ""
                  }`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        notification.type.includes("reminder") ? "bg-primary/10" :
                        notification.type === "medication_confirmation" ? "bg-accent/10" :
                        notification.type === "missed_dose" ? "bg-destructive/10" :
                        "bg-muted"
                      }`}>
                        {getIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className={`font-semibold ${!notification.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                              {notification.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default NotificationsPage;
