import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { LinkRequestNotification } from "@/components/LinkRequestNotification";
import { useRealTimeNotifications } from "@/hooks/useRealTimeNotifications";
import Welcome from "./pages/Welcome";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import VerifyEmail from "./pages/VerifyEmail";
import ProfileSetup from "./pages/ProfileSetup";
import PatientDashboard from "./pages/PatientDashboard";
import GuardianDashboard from "./pages/GuardianDashboard";
import MedicationsPage from "./pages/MedicationsPage";
import AddMedication from "./pages/AddMedication";
import EditMedication from "./pages/EditMedication";
import ScanPrescription from "./pages/ScanPrescription";
import MedicationDetail from "./pages/MedicationDetail";
import LinkGuardian from "./pages/LinkGuardian";
import AnalyticsPage from "./pages/AnalyticsPage";
import NotificationsPage from "./pages/NotificationsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import GuardianPatientMedications from "./pages/GuardianPatientMedications";
import GuardianPatientView from "./pages/GuardianPatientView";

const queryClient = new QueryClient();

const AppContent = () => {
  // Enable real-time notifications globally
  useRealTimeNotifications();
  
  return (
    <>
      <LinkRequestNotification />
      <Routes>
              <Route path="/" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/profile-setup" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><PatientDashboard /></ProtectedRoute>} />
              <Route path="/guardian-dashboard" element={<ProtectedRoute><GuardianDashboard /></ProtectedRoute>} />
              <Route path="/medications" element={<ProtectedRoute><MedicationsPage /></ProtectedRoute>} />
              <Route path="/add-medication" element={<ProtectedRoute><AddMedication /></ProtectedRoute>} />
              <Route path="/medication/:id/edit" element={<ProtectedRoute><EditMedication /></ProtectedRoute>} />
              <Route path="/scan-prescription" element={<ProtectedRoute><ScanPrescription /></ProtectedRoute>} />
              <Route path="/medication/:id" element={<ProtectedRoute><MedicationDetail /></ProtectedRoute>} />
              <Route path="/link-guardian" element={<ProtectedRoute><LinkGuardian /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/guardian-dashboard/patient/:patientId" element={<ProtectedRoute><GuardianPatientMedications /></ProtectedRoute>} />
              <Route path="/guardian-dashboard/patient/:patientId/medication/:medicationId" element={<ProtectedRoute><GuardianPatientView /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner 
        position="top-center"
        expand={true}
        richColors
        closeButton
        toastOptions={{
          style: {
            marginTop: '60px',
          },
          className: 'toast-mobile',
        }}
      />
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
