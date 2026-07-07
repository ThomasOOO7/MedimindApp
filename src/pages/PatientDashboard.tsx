import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CheckCircle, Clock, XCircle, Flame, Shield, Sparkles, Loader2, Pill, Users, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useMedications } from "@/hooks/useMedications";
import { useMedicationLogs } from "@/hooks/useMedicationLogs";
import { format, parse } from "date-fns";
import { EmergencyContactButton } from "@/components/EmergencyContactButton";
import { MedicationInteractionWarning } from "@/components/MedicationInteractionWarning";
import { MedicalChatbot } from "@/components/MedicalChatbot";
import { MessageSquare } from "lucide-react";
import { useRealTimeNotifications } from "@/hooks/useRealTimeNotifications";

interface HealthInsight {
  title: string;
  description: string;
}

interface TodayMedication {
  medication_id: string;
  medication_name: string;
  dosage: string;
  unit: string;
  scheduled_time: string;
  status: string;
  image_url: string | null;
}

const getTimeBasedGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const PatientDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { medications, isLoading: isLoadingMeds } = useMedications();
  const { logs, logMedicationTaken } = useMedicationLogs();
  const [todaySchedule, setTodaySchedule] = useState<TodayMedication[]>([]);
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [insights, setInsights] = useState<HealthInsight[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(true);
  const [linkedGuardians, setLinkedGuardians] = useState<any[]>([]);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [takingMedications, setTakingMedications] = useState<Set<string>>(new Set());
  
  // Enable real-time notifications
  useRealTimeNotifications();

  const fetchTodaySchedule = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc("get_todays_schedule", {
        p_patient_id: user.id,
      });

      if (error) throw error;
      
      // Filter out medications from expired prescriptions
      const filteredSchedule = (data || []).filter((med: TodayMedication) => {
        const medication = medications.find(m => m.id === med.medication_id);
        if (!medication?.end_date) return true;
        
        const endDate = new Date(medication.end_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        return endDate >= today;
      });
      
      setTodaySchedule(filteredSchedule);
    } catch (error) {
      console.error("Error fetching schedule:", error);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const fetchAdherence = async () => {
    if (!user) return;

    try {
      const { data: adherenceData } = await supabase.rpc("calculate_adherence_rate", {
        p_patient_id: user.id,
        p_start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        p_end_date: new Date().toISOString().split("T")[0],
      });

      const { data: streakData } = await supabase.rpc("calculate_current_streak", {
        p_patient_id: user.id,
      });

      setAdherenceRate(adherenceData || 0);
      setCurrentStreak(streakData || 0);
    } catch (error) {
      console.error("Error fetching adherence:", error);
    }
  };

  const fetchHealthInsights = async () => {
    if (!user) return;
    
    setIsLoadingInsights(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-health-insights", {
        body: { patientId: user.id },
      });

      if (error) throw error;

      if (data?.insights) {
        setInsights(data.insights);
      }
    } catch (error: any) {
      console.error("Error fetching health insights:", error);
    } finally {
      setIsLoadingInsights(false);
    }
  };

  const handleTakeMedication = async (medicationId: string, scheduledTime: string) => {
    const key = `${medicationId}-${scheduledTime}`;
    
    // Prevent double-clicks for this dose
    if (takingMedications.has(key)) return;
    
    setTakingMedications(prev => new Set(prev).add(key));
    
    try {
      // Parse HH:mm:ss into a UTC-based Date so server date matches CURRENT_DATE
      const now = new Date();
      const [hours, minutes, seconds] = scheduledTime.split(":").map(Number);
      const scheduledDateUtc = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        hours,
        minutes,
        seconds || 0
      ));
      
      await logMedicationTaken(medicationId, scheduledDateUtc);
      
      toast.success("Medication logged successfully!");
      
      // Refresh schedule and adherence so progress + Upcoming/Taken update
      await Promise.all([
        fetchTodaySchedule(),
        fetchAdherence()
      ]);
    } catch (error) {
      console.error("Error taking medication:", error);
      toast.error("Failed to log medication");
    } finally {
      setTakingMedications(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const fetchLinkedGuardians = async () => {
    if (!user) return;

    try {
      const { data: links, error } = await supabase
        .from("guardian_patient_links")
        .select(`
          id,
          guardian_id,
          status,
          created_at,
          profiles:profiles!guardian_patient_links_guardian_id_fkey (
            first_name,
            last_name
          )
        `)
        .eq("patient_id", user.id)
        .eq("status", "active");

      if (error) throw error;
      
      if (links) {
        setLinkedGuardians(links);
      }
    } catch (error) {
      console.error("Error fetching linked guardians:", error);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchTodaySchedule();
    fetchAdherence();
    fetchHealthInsights();
    fetchLinkedGuardians();

    // Single consolidated real-time channel for all patient updates
    const channel = supabase
      .channel("patient-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_logs",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          // Only update if it's a new log or status change
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            fetchTodaySchedule();
            fetchAdherence();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          fetchTodaySchedule();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guardian_patient_links",
          filter: `patient_id=eq.${user.id}`,
        },
        () => {
          fetchLinkedGuardians();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const todayDoses = {
    taken: todaySchedule.filter((m) => m.status === "taken").length,
    total: todaySchedule.length,
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {getTimeBasedGreeting()}!
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">Here's your medication schedule for today</p>
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
            <EmergencyContactButton />
            <Button 
              onClick={() => navigate("/add-medication")} 
              size="lg" 
              className="gap-2 bg-gradient-to-r from-primary to-secondary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 rounded-xl flex-1 sm:flex-initial"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-sm sm:text-base">Add Medication</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>Today's Progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold">
                    {todayDoses.taken}/{todayDoses.total}
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    {todayDoses.total > 0 ? Math.round((todayDoses.taken / todayDoses.total) * 100) : 0}%
                  </Badge>
                </div>
                <Progress 
                  value={todayDoses.total > 0 ? (todayDoses.taken / todayDoses.total) * 100 : 0} 
                  className="h-2" 
                />
                <p className="text-xs text-muted-foreground">
                  {todayDoses.total - todayDoses.taken} doses remaining
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>Current Streak</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent/20 to-accent/10 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{currentStreak} days</p>
                  <p className="text-xs text-muted-foreground">Keep it going!</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>Weekly Adherence</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Math.round(adherenceRate)}%</p>
                  <p className="text-xs text-muted-foreground">
                    {adherenceRate >= 80 ? "Great job!" : "Keep improving!"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate("/link-guardian")}
          >
            <CardHeader className="pb-3">
              <CardDescription>Connected Guardians</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-2xl font-bold mb-2">{linkedGuardians.length}</p>
                  {linkedGuardians.length > 0 ? (
                    <div className="space-y-2">
                      {linkedGuardians.map((link) => (
                        <div key={link.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary">
                              {link.profiles?.first_name?.[0]}{link.profiles?.last_name?.[0]}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-foreground">
                            {link.profiles?.first_name} {link.profiles?.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Click to link guardians</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Today's Medications</CardTitle>
            <CardDescription>Your scheduled doses for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {medications.length > 1 && (
              <MedicationInteractionWarning medications={medications.map(m => ({ id: m.id, name: m.name }))} />
            )}
            
            {isLoadingSchedule ? (
              <>
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </>
            ) : todaySchedule.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No medications scheduled for today</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => navigate("/add-medication")}
                >
                  Add Your First Medication
                </Button>
              </div>
            ) : (
              todaySchedule.map((med, index) => {
                const key = `${med.medication_id}-${med.scheduled_time}`;
                
                return (
                  <div
                    key={key}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-all gap-3"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                        <Pill className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground truncate">{med.medication_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {med.dosage} {med.unit} • {format(parse(med.scheduled_time, "HH:mm:ss", new Date()), "h:mm a")}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3 justify-end sm:justify-start flex-shrink-0">
                      {med.status === "taken" ? (
                        <Badge variant="outline" className="gap-1 bg-success/10 text-success border-success/20 rounded-full whitespace-nowrap shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          Taken
                        </Badge>
                      ) : (
                        <>
                          <Badge variant="outline" className="gap-1 rounded-full whitespace-nowrap hidden sm:flex shadow-sm">
                            <Clock className="w-3 h-3" />
                            Upcoming
                          </Badge>
                          <Button 
                            size="sm" 
                            className="rounded-full bg-success hover:bg-success/90 text-success-foreground shadow-md hover:shadow-lg transition-all duration-200 whitespace-nowrap border-0"
                            onClick={() => handleTakeMedication(med.medication_id, med.scheduled_time)}
                            disabled={takingMedications.has(key)}
                          >
                            {takingMedications.has(key) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                <span className="hidden sm:inline">Logging...</span>
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Take Now</span>
                              </>
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-primary/20 shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <CardTitle>AI Health Insights</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchHealthInsights}
                disabled={isLoadingInsights}
                className="rounded-full"
              >
                {isLoadingInsights ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
            <CardDescription>Personalized recommendations based on your adherence</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingInsights ? (
              <>
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </>
            ) : insights.length > 0 ? (
              insights.map((insight, index) => (
                <div
                  key={index}
                  className="p-4 rounded-xl bg-card border border-border hover:shadow-md transition-shadow"
                >
                  <h4 className="font-semibold text-foreground mb-1">{insight.title}</h4>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Start tracking your medications to receive personalized insights
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <MedicalChatbot open={isChatbotOpen} onOpenChange={setIsChatbotOpen} />
    </DashboardLayout>
  );
};

export default PatientDashboard;
