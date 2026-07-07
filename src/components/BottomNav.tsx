import { NavLink } from "react-router-dom";
import { Home, Pill, BarChart3, Bell, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const BottomNav = () => {
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserType = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching user type:", error);
        return;
      }
      
      setUserType(data?.user_type || null);
    };

    fetchUserType();
  }, [user]);

  // Don't render navigation until userType is loaded
  if (!userType) {
    return null;
  }

  const navItems = userType === "guardian" 
    ? [
        { title: "Home", path: "/guardian-dashboard", icon: Home },
        { title: "Patients", path: "/link-guardian", icon: Users },
        { title: "Notifications", path: "/notifications", icon: Bell },
        { title: "Settings", path: "/settings", icon: User }
      ]
    : [
        { title: "Home", path: "/dashboard", icon: Home },
        { title: "Medications", path: "/medications", icon: Pill },
        { title: "Analytics", path: "/analytics", icon: BarChart3 },
        { title: "Notifications", path: "/notifications", icon: Bell },
        { title: "Settings", path: "/settings", icon: User }
      ];
  
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 border-t border-border backdrop-blur-sm supports-[backdrop-filter]:bg-card/60">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <item.icon className={cn("w-5 h-5 transition-transform", isActive && "scale-110")} />
                  {item.path === "/notifications" && unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full" />
                  )}
                </div>
                <span className={cn("text-xs font-medium transition-opacity", isActive ? "opacity-100" : "opacity-70")}>
                  {item.title}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
