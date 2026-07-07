import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, Clock, CheckCircle, Edit, Pause, Trash2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useMedications } from "@/hooks/useMedications";
import { useMedicationLogs } from "@/hooks/useMedicationLogs";
import { format } from "date-fns";
import { TakeMedicationDialog } from "@/components/TakeMedicationDialog";
import { MedicationHistoryExport } from "@/components/MedicationHistoryExport";

const MedicationDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { medications, deleteMedication, updateMedication } = useMedications();
  const { logs, logMedicationTaken } = useMedicationLogs();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [showTakeDialog, setShowTakeDialog] = useState(false);
  const [isTakingMedication, setIsTakingMedication] = useState(false);

  const medication = medications.find(m => m.id === id);

  useEffect(() => {
    if (logs.length > 0) {
      const totalLogs = logs.filter(l => l.medication_id === id).length;
      const takenLogs = logs.filter(l => l.medication_id === id && l.status === "taken").length;
      setAdherenceRate(totalLogs > 0 ? Math.round((takenLogs / totalLogs) * 100) : 0);
    }
  }, [logs, id]);

  const medicationLogs = logs.filter(l => l.medication_id === id).slice(0, 10);

  // Check if medication was already taken today
  const isTakenToday = () => {
    const today = new Date().toDateString();
    return logs.some(
      (log) =>
        log.medication_id === id &&
        log.status === "taken" &&
        new Date(log.scheduled_time).toDateString() === today
    );
  };

  // Check if medication has expired
  const isMedicationExpired = () => {
    if (!medication?.end_date) return false;
    const endDate = new Date(medication.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today;
  };

  // Check if we're within 30 minutes before any scheduled time
  const isWithinTimeWindow = () => {
    if (!medication) return false;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const times = medication.dose_times && medication.dose_times.length > 0 
      ? medication.dose_times 
      : [medication.time];
    
    return times.some(timeStr => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const scheduledTime = hours * 60 + minutes;
      const timeDiff = scheduledTime - currentTime;
      
      // Show button if within 30 minutes before or after scheduled time
      return timeDiff >= -30 && timeDiff <= 30;
    });
  };

  const handleTakeMedication = async (notes?: string, sideEffects?: string) => {
    if (!medication || isTakingMedication) return;
    
    setIsTakingMedication(true);
    try {
      const now = new Date();
      await logMedicationTaken(medication.id, now, notes, sideEffects);
      setShowTakeDialog(false);
    } catch (error) {
      toast.error("Failed to log medication");
    } finally {
      setIsTakingMedication(false);
    }
  };

  const handlePause = async () => {
    if (!medication) return;
    try {
      await updateMedication(medication.id, { is_active: !medication.is_active });
      toast.success(medication.is_active ? "Medication paused" : "Medication resumed");
    } catch (error) {
      toast.error("Failed to update medication");
    }
  };

  const handleDelete = async () => {
    if (!medication) return;
    if (confirm("Are you sure you want to delete this medication?")) {
      try {
        await deleteMedication(medication.id);
        toast.success("Medication deleted");
        navigate("/medications");
      } catch (error) {
        toast.error("Failed to delete medication");
      }
    }
  };

  const formatFrequency = (freq: string) => {
    return freq.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  if (!medication) {
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
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/medications")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">{medication.name}</h1>
              <p className="text-muted-foreground">{medication.dosage} {medication.unit} • {formatFrequency(medication.frequency)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => navigate(`/medication/${id}/edit`)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handlePause}>
              <Pause className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleDelete} className="text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <Card>
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
            {isMedicationExpired() ? (
              <div className="w-full mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm font-medium text-destructive text-center">
                  ⚠️ This medication has expired. Please update the end date to continue.
                </p>
                <Button 
                  onClick={() => navigate(`/medication/${id}/edit`)} 
                  variant="destructive" 
                  className="w-full mt-3"
                >
                  Update End Date
                </Button>
              </div>
            ) : medication.is_active ? (
              <>
                {!isWithinTimeWindow() && !isTakenToday() && (
                  <div className="w-full mt-4 p-3 rounded-lg bg-muted/50 text-center">
                    <p className="text-sm text-muted-foreground">
                      Button will appear 30 minutes before scheduled time
                    </p>
                  </div>
                )}
                {isWithinTimeWindow() && !isTakenToday() && (
                  <Button 
                    onClick={() => setShowTakeDialog(true)} 
                    className="w-full mt-4"
                    disabled={isTakingMedication}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {isTakingMedication ? "Logging..." : "Mark as Taken"}
                  </Button>
                )}
                {isTakenToday() && (
                  <Button disabled className="w-full mt-4 opacity-50">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ✓ Taken Today
                  </Button>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Details Tabs */}
        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="info">Info</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Schedule</CardTitle>
                <CardDescription>Your medication reminder times</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {medication.dose_times && medication.dose_times.length > 0 ? (
                    medication.dose_times.map((time, index) => (
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
            <Card>
              <CardHeader>
                <CardTitle>Adherence Calendar</CardTitle>
                <CardDescription>View your medication history</CardDescription>
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

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Activity</CardTitle>
                  <MedicationHistoryExport logs={medicationLogs} medicationName={medication.name} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {medicationLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No history available yet</p>
                ) : (
                  medicationLogs.map((log) => (
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
            <Card>
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

            <Card>
              <CardHeader>
                <CardTitle>Drug Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This section will display detailed drug information, potential interactions, and side effects.
                </p>
                <Button variant="outline" className="w-full">
                  View Full Drug Information
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <TakeMedicationDialog
          open={showTakeDialog}
          onOpenChange={setShowTakeDialog}
          medicationName={medication.name}
          onConfirm={handleTakeMedication}
        />
      </div>
    </DashboardLayout>
  );
};

export default MedicationDetail;
