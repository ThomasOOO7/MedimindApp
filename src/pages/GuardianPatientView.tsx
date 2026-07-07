import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const GuardianPatientView = () => {
  const navigate = useNavigate();
  const { patientId, medicationId } = useParams();
  const { user } = useAuth();
  const [medication, setMedication] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!patientId || !medicationId || !user) return;

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

      // Fetch medication
      const { data: medData } = await supabase
        .from("medications")
        .select("*")
        .eq("id", medicationId)
        .eq("patient_id", patientId)
        .single();
      setMedication(medData);

      // Fetch logs
      const { data: logsData } = await supabase
        .from("medication_logs")
        .select("*")
        .eq("medication_id", medicationId)
        .order("scheduled_time", { ascending: false })
        .limit(10);
      setLogs(logsData || []);

      // Calculate adherence
      if (logsData && logsData.length > 0) {
        const takenLogs = logsData.filter(l => l.status === "taken").length;
        setAdherenceRate(Math.round((takenLogs / logsData.length) * 100));
      }

      setIsLoading(false);
    };

    fetchData();

    // Real-time subscriptions
    const medicationsChannel = supabase
      .channel('guardian-patient-medications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medications',
          filter: `id=eq.${medicationId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel('guardian-patient-logs')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medication_logs',
          filter: `medication_id=eq.${medicationId}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(medicationsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [patientId, medicationId, user, navigate]);

  const formatFrequency = (freq: string) => {
    return freq.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
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

  if (!medication) {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 text-center">
          <p className="text-muted-foreground">Medication not found</p>
          <Button onClick={() => navigate("/guardian-dashboard")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/guardian-dashboard/patient/${patientId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-3xl font-bold text-foreground">{medication.name}</h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Shield className="w-3 h-3 mr-1" />
                  View Only
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {patientProfile?.first_name} {patientProfile?.last_name}'s medication • {medication.dosage} {medication.unit} • {formatFrequency(medication.frequency)}
              </p>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <Card className="rounded-xl border-border/50 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-4xl">
                  💊
                </div>
                <div>
                  <Badge variant="outline" className={medication.is_active ? "bg-accent/10 text-accent border-accent/20 mb-2" : "bg-muted text-muted-foreground mb-2"}>
                    {medication.is_active ? "Active" : "Paused"}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    Next dose at {medication.time}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{adherenceRate}%</p>
                <p className="text-sm text-muted-foreground">Adherence Rate</p>
              </div>
            </div>
            <Progress value={adherenceRate} className="h-2" />
          </CardContent>
        </Card>

        {/* Details Tabs */}
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="schedule" className="rounded-lg">Schedule</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg">History</TabsTrigger>
            <TabsTrigger value="info" className="rounded-lg">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Current Schedule</CardTitle>
                <CardDescription>Medication reminder times</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {medication.dose_times && medication.dose_times.length > 0 ? (
                    medication.dose_times.map((time: string, index: number) => (
                      <div key={index} className="flex items-center justify-between p-4 rounded-lg border border-border">
                        <div className="flex items-center gap-3">
                          <Clock className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-medium">{time}</p>
                            <p className="text-sm text-muted-foreground">
                              Dose {index + 1} • {formatFrequency(medication.frequency)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Clock className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-medium">{medication.time}</p>
                          <p className="text-sm text-muted-foreground">{formatFrequency(medication.frequency)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {medication.instructions && (
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Special Instructions</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {medication.instructions}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Adherence Calendar</CardTitle>
                <CardDescription>Patient's medication history</CardDescription>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {logs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No history available yet</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3">
                        {log.status === "taken" ? (
                          <CheckCircle className="w-5 h-5 text-accent" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-destructive" />
                        )}
                        <div>
                          <p className="font-medium">
                            {format(new Date(log.scheduled_time), 'MMM dd, yyyy')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {log.status === "taken" && log.actual_time
                              ? `Taken at ${format(new Date(log.actual_time), 'hh:mm a')}`
                              : log.status === "missed"
                              ? "Missed dose"
                              : "Skipped"}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          log.status === "taken"
                            ? "bg-accent/10 text-accent border-accent/20"
                            : "bg-destructive/10 text-destructive border-destructive/20"
                        }
                      >
                        {log.status}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info" className="space-y-4">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Medication Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">
                      {format(new Date(medication.start_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">
                      {medication.end_date ? format(new Date(medication.end_date), 'MMM dd, yyyy') : "Ongoing"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Dosage</p>
                    <p className="font-medium">{medication.dosage} {medication.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Frequency</p>
                    <p className="font-medium">{formatFrequency(medication.frequency)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GuardianPatientView;
