import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Search, Clock, Pill, Loader2, Shield, TrendingUp, Activity, Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, isSameDay } from "date-fns";

const GuardianPatientMedications = () => {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const { user } = useAuth();
  const [medications, setMedications] = useState<any[]>([]);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [todayDoses, setTodayDoses] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [monthlyLogs, setMonthlyLogs] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || !user) return;

      setIsLoading(true);
      
      // Verify guardian has access to this patient
      const { data: linkData } = await supabase
        .from("guardian_patient_links")
        .select("*")
        .eq("guardian_id", user.id)
        .eq("patient_id", patientId)
        .eq("status", "active")
        .single();

      if (!linkData) {
        navigate("/guardian-dashboard");
        return;
      }

      // Fetch patient profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", patientId)
        .single();
      setPatientProfile(profile);

      // Fetch medications
      const { data: medsData } = await supabase
        .from("medications")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });
      setMedications(medsData || []);

      // Fetch adherence rate
      const { data: adherenceData } = await supabase.rpc("calculate_adherence_rate", {
        p_patient_id: patientId,
      });
      setAdherenceRate(adherenceData || 0);

      // Fetch today's schedule
      const { data: scheduleData } = await supabase.rpc("get_todays_schedule", {
        p_patient_id: patientId,
      });
      setTodayDoses(scheduleData || []);

      // Fetch monthly logs for calendar
      const startDate = startOfMonth(selectedDate || new Date());
      const endDate = endOfMonth(selectedDate || new Date());
      const { data: logsData } = await supabase
        .from("medication_logs")
        .select("*")
        .eq("patient_id", patientId)
        .gte("scheduled_time", startDate.toISOString())
        .lte("scheduled_time", endDate.toISOString());
      setMonthlyLogs(logsData || []);

      setIsLoading(false);
    };

    fetchData();

    // Real-time subscriptions
    const channel = supabase
      .channel('guardian-patient-overview')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medication_logs',
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [patientId, user, navigate, selectedDate]);

  const filteredMedications = medications.filter(med =>
    med.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMedications = filteredMedications.filter(m => m.is_active);
  const inactiveMedications = filteredMedications.filter(m => !m.is_active);

  const formatFrequency = (freq: string) => {
    return freq.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const todayTaken = todayDoses.filter(d => d.status === 'taken').length;
  const todayTotal = todayDoses.length;
  const todayPercentage = todayTotal > 0 ? Math.round((todayTaken / todayTotal) * 100) : 0;

  // Calendar day styling based on adherence
  const getDayAdherence = (date: Date) => {
    const dayLogs = monthlyLogs.filter(log => 
      isSameDay(new Date(log.scheduled_time), date)
    );
    if (dayLogs.length === 0) return null;
    const taken = dayLogs.filter(log => log.status === 'taken').length;
    const percentage = (taken / dayLogs.length) * 100;
    return percentage;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/guardian-dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {patientProfile?.first_name} {patientProfile?.last_name}
              </h1>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                <Shield className="w-3 h-3 mr-1" />
                View Only
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">Real-time medication monitoring and analytics</p>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="rounded-xl border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardDescription>Adherence Rate (30 days)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">{Math.round(adherenceRate)}%</p>
                <TrendingUp className={`w-6 h-6 ${adherenceRate >= 80 ? 'text-accent' : 'text-destructive'}`} />
              </div>
              <Progress value={adherenceRate} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardDescription>Today's Progress</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{todayTaken}/{todayTotal}</p>
              <Progress value={todayPercentage} className="h-2 mt-2" />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-border/50 shadow-md">
            <CardHeader className="pb-3">
              <CardDescription>Active Medications</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-3xl font-bold">{activeMedications.length}</p>
                <Pill className="w-6 h-6 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Medications and Analytics */}
        <Tabs defaultValue="medications" className="w-full">
          <TabsList className="grid w-full grid-cols-2 rounded-xl">
            <TabsTrigger value="medications" className="rounded-lg">Medications</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="medications" className="space-y-6 mt-6">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search medications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-xl"
              />
            </div>

            {/* Active Medications */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">
                Active Medications ({activeMedications.length})
              </h2>
              {activeMedications.length === 0 ? (
                <Card className="rounded-xl border-border/50 shadow-lg">
                  <CardContent className="py-12 text-center">
                    <Pill className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No active medications</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {activeMedications.map((medication) => (
                    <Card
                      key={medication.id}
                      className="rounded-xl border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer hover:border-primary"
                      onClick={() => navigate(`/guardian-dashboard/patient/${patientId}/medication/${medication.id}`)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-2xl">
                              💊
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg text-foreground mb-1">
                                {medication.name}
                              </h3>
                              <p className="text-sm text-muted-foreground mb-2">
                                {medication.dosage} {medication.unit} • {formatFrequency(medication.frequency)}
                              </p>
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-primary" />
                                <span className="text-sm text-muted-foreground">
                                  {medication.dose_times && medication.dose_times.length > 0
                                    ? `${medication.dose_times.length} doses: ${medication.dose_times.slice(0, 2).join(', ')}${medication.dose_times.length > 2 ? '...' : ''}`
                                    : `Next at ${medication.time}`}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Badge className="bg-accent/10 text-accent border-accent/20 border">
                            Active
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Inactive Medications */}
            {inactiveMedications.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground">
                  Inactive Medications ({inactiveMedications.length})
                </h2>
                <div className="grid gap-4">
                  {inactiveMedications.map((medication) => (
                    <Card
                      key={medication.id}
                      className="rounded-xl border-border/50 shadow-lg hover:shadow-xl transition-all cursor-pointer opacity-60 hover:opacity-100"
                      onClick={() => navigate(`/guardian-dashboard/patient/${patientId}/medication/${medication.id}`)}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-2xl">
                              💊
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg text-muted-foreground mb-1">
                                {medication.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {medication.dosage} {medication.unit} • {formatFrequency(medication.frequency)}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-muted text-muted-foreground">
                            Paused
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            {/* Today's Schedule */}
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Today's Schedule
                </CardTitle>
                <CardDescription>Real-time medication tracking for today</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayDoses.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No medications scheduled for today</p>
                ) : (
                  todayDoses.map((dose, index) => (
                    <div
                      key={`${dose.medication_id}-${index}`}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          dose.status === 'taken' 
                            ? 'bg-accent/10 text-accent' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {dose.status === 'taken' ? '✓' : '○'}
                        </div>
                        <div>
                          <p className="font-medium">{dose.medication_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {dose.dosage} {dose.unit} at {dose.scheduled_time}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          dose.status === 'taken'
                            ? 'bg-accent/10 text-accent border-accent/20'
                            : 'bg-muted text-muted-foreground'
                        }
                      >
                        {dose.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Adherence Calendar */}
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Adherence Calendar
                </CardTitle>
                <CardDescription>Monthly adherence overview</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                  modifiers={{
                    excellent: (date) => {
                      const adherence = getDayAdherence(date);
                      return adherence !== null && adherence >= 80;
                    },
                    good: (date) => {
                      const adherence = getDayAdherence(date);
                      return adherence !== null && adherence >= 50 && adherence < 80;
                    },
                    poor: (date) => {
                      const adherence = getDayAdherence(date);
                      return adherence !== null && adherence < 50;
                    },
                  }}
                  modifiersClassNames={{
                    excellent: "bg-accent/20 text-accent font-bold",
                    good: "bg-warning/20 text-warning font-bold",
                    poor: "bg-destructive/20 text-destructive font-bold",
                  }}
                />
                <div className="flex items-center justify-center gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-accent/20"></div>
                    <span className="text-muted-foreground">≥80%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-warning/20"></div>
                    <span className="text-muted-foreground">50-79%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-destructive/20"></div>
                    <span className="text-muted-foreground">&lt;50%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Adherence Insights */}
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Adherence Insights</CardTitle>
                <CardDescription>Last 30 days performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                  <div>
                    <p className="text-sm text-muted-foreground">Overall Adherence</p>
                    <p className="text-2xl font-bold">{Math.round(adherenceRate)}%</p>
                  </div>
                  <div className={`text-4xl ${adherenceRate >= 80 ? 'text-accent' : adherenceRate >= 50 ? 'text-warning' : 'text-destructive'}`}>
                    {adherenceRate >= 80 ? '🎯' : adherenceRate >= 50 ? '⚠️' : '❌'}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Today's Progress</span>
                    <span className="font-medium">{todayPercentage}%</span>
                  </div>
                  <Progress value={todayPercentage} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GuardianPatientMedications;