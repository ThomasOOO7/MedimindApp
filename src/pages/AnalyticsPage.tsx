import { useState, useEffect, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { BarChart3, TrendingUp, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState("30");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [adherenceData, setAdherenceData] = useState<any>(null);
  const [medicationStats, setMedicationStats] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [currentStreak, setCurrentStreak] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userType, setUserType] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserType = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("id", user.id)
        .single();
      setUserType(data?.user_type || null);
    };
    fetchUserType();
  }, [user]);

  const fetchAnalytics = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const daysBack = parseInt(timeRange);
      const startDate = subDays(new Date(), daysBack).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];

      // Fetch adherence rate
      const { data: adherence } = await supabase.rpc("calculate_adherence_rate", {
        p_patient_id: user.id,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      // Fetch current streak from DB (real calculation)
      const { data: streak } = await supabase.rpc("calculate_current_streak", {
        p_patient_id: user.id,
      });
      const { data: meds } = await supabase
        .from("medications")
        .select("*")
        .eq("patient_id", user.id)
        .eq("is_active", true);

      // Calculate per-medication adherence
      const statsPromises = (meds || []).map(async (med) => {
        const { data: logs } = await supabase
          .from("medication_logs")
          .select("*")
          .eq("medication_id", med.id)
          .gte("scheduled_time", startDate);

        const total = logs?.length || 0;
        const taken = logs?.filter((l) => l.status === "taken").length || 0;
        const rate = total > 0 ? Math.round((taken / total) * 100) : 0;

        return {
          name: med.name,
          adherence: rate,
          doses: { taken, total },
        };
      });

      const stats = await Promise.all(statsPromises);
      setMedicationStats(stats);

      // Generate weekly data
      const weekStart = startOfWeek(new Date());
      const weekEnd = endOfWeek(new Date());
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

      const weeklyPromises = days.map(async (day) => {
        const dayStart = new Date(day);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const { data: dayLogs } = await supabase
          .from("medication_logs")
          .select("status, scheduled_time")
          .eq("patient_id", user.id)
          .gte("scheduled_time", dayStart.toISOString())
          .lt("scheduled_time", dayEnd.toISOString());

        const total = dayLogs?.length || 0;
        const taken = dayLogs?.filter((l) => l.status === "taken").length || 0;
        const rate = total > 0 ? Math.round((taken / total) * 100) : 0;

        return {
          day: format(day, "EEE"),
          rate,
          taken,
          total,
        };
      });

      const weekly = await Promise.all(weeklyPromises);
      setWeeklyData(weekly);

      setAdherenceData({
        overall: adherence || 0,
        thisWeek: weekly.length > 0
          ? weekly.reduce((acc, d) => acc + d.rate, 0) / weekly.length
          : 0,
      });

      setCurrentStreak(streak || 0);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && userType === "patient") {
      fetchAnalytics();

      // Live updates when medication logs change
      const channel = supabase
        .channel("analytics-updates")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "medication_logs",
            filter: `patient_id=eq.${user.id}`,
          },
          () => {
            fetchAnalytics();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, timeRange, userType]);


  if (userType === "guardian") {
    return (
      <DashboardLayout>
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Patient Analytics
            </h1>
            <p className="text-muted-foreground mt-1">View detailed analytics for your linked patients</p>
          </div>
          <Card className="rounded-xl border-border/50 shadow-lg">
            <CardContent className="py-12 text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Select a patient from your dashboard to view their detailed analytics
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Analytics & Reports
            </h1>
            <p className="text-muted-foreground mt-1">Track your medication adherence over time</p>
          </div>
          <div className="flex gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2 rounded-xl">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
              <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardDescription>Overall Adherence</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{Math.round(adherenceData?.overall || 0)}%</span>
                      <Badge variant="outline" className="gap-1 bg-accent/10 text-accent border-accent/20 rounded-full">
                        <TrendingUp className="w-3 h-3" />
                        Active
                      </Badge>
                    </div>
                    <Progress value={adherenceData?.overall || 0} className="h-2" />
                    <p className="text-xs text-muted-foreground">Last {timeRange} days</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardDescription>This Week</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{Math.round(adherenceData?.thisWeek || 0)}%</span>
                      <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 rounded-full">
                        {adherenceData?.thisWeek && adherenceData.thisWeek >= 80 ? "Excellent" : "Good"}
                      </Badge>
                    </div>
                    <Progress value={adherenceData?.thisWeek || 0} className="h-2" />
                    <p className="text-xs text-muted-foreground">Weekly average</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-xl border-border/50 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardDescription>Current Streak</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold">{currentStreak}</span>
                      <span className="text-muted-foreground">days</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Keep up the great work!</p>
                  </div>
                </CardContent>
              </Card>
            </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-xl">
            <TabsTrigger value="overview" className="rounded-lg">Overview</TabsTrigger>
            <TabsTrigger value="medications" className="rounded-lg">By Medication</TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-lg">Calendar</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-6">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Weekly Adherence Trend</CardTitle>
                <CardDescription>Your adherence rate for each day this week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="rate" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={3}
                        name="Adherence %"
                        dot={{ fill: 'hsl(var(--primary))', r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="medications" className="space-y-4">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Medication Adherence Breakdown</CardTitle>
                <CardDescription>Adherence rates for each medication</CardDescription>
              </CardHeader>
              <CardContent>
                {medicationStats.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No medication data available</p>
                ) : (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={medicationStats}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Legend />
                        <Bar 
                          dataKey="adherence" 
                          fill="hsl(var(--primary))" 
                          name="Adherence %"
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Adherence Calendar</CardTitle>
                <CardDescription>View your medication history</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border"
                />
                <div className="flex gap-4 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-accent" />
                    <span className="text-muted-foreground">All doses taken</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-destructive" />
                    <span className="text-muted-foreground">Missed doses</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AnalyticsPage;
