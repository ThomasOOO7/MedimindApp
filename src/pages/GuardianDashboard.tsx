import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, TrendingUp, TrendingDown, Minus, AlertCircle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useGuardianLinks } from "@/hooks/useGuardianLinks";
import { useNotifications } from "@/hooks/useNotifications";
import DashboardLayout from "@/components/DashboardLayout";
import { formatDistanceToNow } from "date-fns";
import { MedicalChatbot } from "@/components/MedicalChatbot";
import { MessageSquare } from "lucide-react";
import { useRealTimeNotifications } from "@/hooks/useRealTimeNotifications";

interface PatientSummary {
  patient_id: string;
  patient_name: string;
  adherence_rate: number;
  today_taken: number;
  today_total: number;
  last_update: string | null;
}

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const GuardianDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { links, isLoading: isLoadingLinks } = useGuardianLinks();
  const { notifications } = useNotifications();
  const [patientSummaries, setPatientSummaries] = useState<PatientSummary[]>([]);
  const [isLoadingSummaries, setIsLoadingSummaries] = useState(true);
  const [guardianName, setGuardianName] = useState<string>("");
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  
  // Enable real-time notifications
  useRealTimeNotifications();

  const fetchGuardianProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      if (data) {
        setGuardianName(`${data.first_name} ${data.last_name}`);
      }
    } catch (error) {
      console.error("Error fetching guardian profile:", error);
    }
  };

  const fetchPatientSummaries = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc("get_guardian_patients_summary", {
        p_guardian_id: user.id,
      });

      if (error) throw error;
      setPatientSummaries(data || []);
    } catch (error) {
      console.error("Error fetching patient summaries:", error);
    } finally {
      setIsLoadingSummaries(false);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchGuardianProfile();
    fetchPatientSummaries();

    // Single consolidated channel for all guardian updates
    const channel = supabase
      .channel("guardian-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guardian_patient_links",
          filter: `guardian_id=eq.${user.id}`,
        },
        () => {
          fetchPatientSummaries();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "medication_logs",
        },
        (payload) => {
          // Only refresh if log belongs to a linked patient
          const linkedPatientIds = links.map(l => l.patient_id);
          if (payload.new && linkedPatientIds.includes((payload.new as any).patient_id)) {
            fetchPatientSummaries();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, links]);

  const getTrendIcon = (adherenceRate: number) => {
    if (adherenceRate >= 80) return <TrendingUp className="w-4 h-4 text-accent" />;
    if (adherenceRate >= 60) return <Minus className="w-4 h-4 text-muted-foreground" />;
    return <TrendingDown className="w-4 h-4 text-destructive" />;
  };

  const getStatusColor = (todayTaken: number, todayTotal: number) => {
    if (todayTotal === 0) return "bg-muted text-muted-foreground";
    const percentage = (todayTaken / todayTotal) * 100;
    if (percentage >= 80) return "bg-accent/10 text-accent border-accent/20";
    if (percentage >= 50) return "bg-warning/10 text-warning border-warning/20";
    return "bg-destructive/10 text-destructive border-destructive/20";
  };

  const activeLinks = links.filter((link) => link.status === "active");
  const averageAdherence =
    patientSummaries.length > 0
      ? Math.round(
          patientSummaries.reduce((acc, p) => acc + p.adherence_rate, 0) / patientSummaries.length
        )
      : 0;
  const totalDosesToday = {
    taken: patientSummaries.reduce((acc, p) => acc + p.today_taken, 0),
    total: patientSummaries.reduce((acc, p) => acc + p.today_total, 0),
  };

  const recentAlerts = notifications
    .filter((n) => n.type === "missed_dose" || n.type === "medication_confirmation")
    .slice(0, 5);

  const missedDoses = notifications
    .filter((n) => n.type === "missed_dose")
    .slice(0, 10);

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Greeting Section */}
        <Card className="rounded-xl border-border/50 shadow-lg bg-gradient-to-br from-primary/5 via-background to-secondary/5">
          <CardContent className="pt-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              {getTimeBasedGreeting()}, {guardianName || "Guardian"}! 👋
            </h1>
            <p className="text-muted-foreground">
              Here's an overview of your patients' medication adherence. Stay informed and help them stay on track.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Dashboard Overview
            </h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Monitor your loved ones' medication adherence</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              onClick={() => setIsChatbotOpen(true)}
              size="lg"
              variant="outline"
              className="gap-2 hover:shadow-md transition-all duration-300 rounded-xl flex-1 sm:flex-initial"
            >
              <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Medical AI</span>
            </Button>
            <Button 
              onClick={() => navigate("/link-guardian")} 
              size="lg" 
              className="gap-2 bg-gradient-to-r from-primary to-secondary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 rounded-xl flex-1 sm:flex-initial"
            >
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Link Patient</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>Total Patients</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activeLinks.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Active connections</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>Average Adherence</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{averageAdherence}%</p>
              <p className="text-xs text-muted-foreground mt-1">Across all patients</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>Today's Doses</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {totalDosesToday.taken}/{totalDosesToday.total}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Doses taken today</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Linked Patients
            </CardTitle>
            <CardDescription>Real-time medication status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingLinks || isLoadingSummaries ? (
              <>
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </>
            ) : patientSummaries.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-2">No patients linked yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Connect with patients to start monitoring their medication adherence
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate("/link-guardian")}
                >
                  Link Your First Patient
                </Button>
              </div>
            ) : (
              patientSummaries.map((patient) => (
                <div
                  key={patient.patient_id}
                  className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border border-border hover:bg-muted/50 transition-all cursor-pointer hover:border-primary"
                  onClick={() => navigate(`/guardian-dashboard/patient/${patient.patient_id}`)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-primary font-semibold">
                        {patient.patient_name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{patient.patient_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {patient.last_update
                          ? `Updated ${formatDistanceToNow(new Date(patient.last_update), { addSuffix: true })}`
                          : "No recent activity"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="flex-1 md:w-40">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{Math.round(patient.adherence_rate)}%</span>
                        {getTrendIcon(patient.adherence_rate)}
                      </div>
                      <Progress value={patient.adherence_rate} className="h-2" />
                    </div>

                    <Badge variant="outline" className={`${getStatusColor(patient.today_taken, patient.today_total)} rounded-full`}>
                      {patient.today_taken}/{patient.today_total} Today
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="rounded-xl border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-destructive" />
                Patient Alerts - Missed Doses
              </CardTitle>
              <CardDescription>Patients who missed or delayed medications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {missedDoses.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                    <AlertCircle className="w-6 h-6 text-accent" />
                  </div>
                  <p className="text-muted-foreground">All patients are on track! 🎉</p>
                </div>
              ) : (
                missedDoses.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center flex-shrink-0">
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {alert.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates from your patients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentAlerts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No recent alerts</p>
              ) : (
                recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        alert.type === "missed_dose" ? "bg-destructive/10" : "bg-accent/10"
                      }`}
                    >
                      <AlertCircle
                        className={`w-4 h-4 ${
                          alert.type === "missed_dose" ? "text-destructive" : "text-accent"
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {alert.title}
                      </p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <MedicalChatbot open={isChatbotOpen} onOpenChange={setIsChatbotOpen} />
    </DashboardLayout>
  );
};

export default GuardianDashboard;
