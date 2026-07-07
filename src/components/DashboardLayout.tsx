import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import BottomNav from "@/components/BottomNav";
import { useMediaQuery } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const isMobile = useMediaQuery("(max-width: 768px)");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {!isMobile && <AppSidebar />}
        
        <div className="flex-1 flex flex-col w-full">
          {!isMobile && (
            <header className="h-14 border-b border-border bg-card flex items-center px-4 sticky top-0 z-40 backdrop-blur-sm bg-card/95">
              <SidebarTrigger />
              <div className="ml-4">
                <h1 className="text-lg font-semibold text-foreground">MediMind</h1>
              </div>
            </header>
          )}
          
          <main className="flex-1 overflow-auto pb-20 md:pb-4">
            {children}
          </main>
          
          {isMobile && <BottomNav />}
        </div>
      </div>
    </SidebarProvider>
  );
};

export default DashboardLayout;
