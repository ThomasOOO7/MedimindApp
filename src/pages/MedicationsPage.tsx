import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Filter, Clock, CheckCircle, MoreVertical, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMedications } from "@/hooks/useMedications";
import { useMedicationLogs } from "@/hooks/useMedicationLogs";
import { toast } from "sonner";

const MedicationsPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("active");
  const { medications, isLoading, deleteMedication } = useMedications();
  const { logs } = useMedicationLogs();

  const filteredMedications = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return medications.filter((m) => {
      const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Determine if medication has ended
      let isEnded = false;
      if (m.end_date) {
        const endDate = new Date(m.end_date);
        endDate.setHours(0, 0, 0, 0);
        isEnded = endDate < today;
      }

      // Determine if all doses for today are taken using logs only
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const logsForMedToday = logs.filter(
        (log) =>
          log.medication_id === m.id &&
          new Date(log.scheduled_time) >= todayStart &&
          new Date(log.scheduled_time) <= todayEnd
      );

      const hasTakenToday = logsForMedToday.some((log) => log.status === "taken");
 
      if (activeTab === "active") {
        // Show only medications that are active for today and not yet taken
        if (!m.is_active || isEnded) return false;
        if (hasTakenToday) return false;
        return true;
      }
 
      if (activeTab === "completed") {
        // Show completed/ended medications
        if (!m.is_active || isEnded) return true;
        if (hasTakenToday && m.is_active) return true;
        return false;
      }
 
      // "all" tab just filters by search
      return true;
    });
  }, [medications, logs, searchQuery, activeTab]);

  // Active/completed lists are derived inside filteredMedications using logs


  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this medication?")) {
      try {
        await deleteMedication(id);
        toast.success("Medication deleted successfully");
      } catch (error) {
        toast.error("Failed to delete medication");
      }
    }
  };

  const formatFrequency = (freq: string) => {
    return freq.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-accent/10 text-accent border-accent/20";
      case "paused":
        return "bg-warning/10 text-warning border-warning/20";
      case "completed":
        return "bg-muted text-muted-foreground";
      default:
        return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Medications</h1>
            <p className="text-muted-foreground mt-1">Manage your medication schedule</p>
          </div>
          <Button onClick={() => navigate("/add-medication")} size="lg" className="gap-2">
            <Plus className="w-5 h-5" />
            Add Medication
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search medications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active">Active ({medications.filter((m) => {
               const today = new Date();
               today.setHours(0, 0, 0, 0);
 
               if (!m.is_active) return false;
               if (m.end_date) {
                 const endDate = new Date(m.end_date);
                 endDate.setHours(0, 0, 0, 0);
                 if (endDate < today) return false;
               }
 
               const todayStart = new Date();
               todayStart.setHours(0, 0, 0, 0);
               const todayEnd = new Date();
               todayEnd.setHours(23, 59, 59, 999);
 
               const logsForMedToday = logs.filter(
                 (log) =>
                   log.medication_id === m.id &&
                   new Date(log.scheduled_time) >= todayStart &&
                   new Date(log.scheduled_time) <= todayEnd
               );
 
               const hasTakenToday = logsForMedToday.some((log) => log.status === "taken");
 
               if (hasTakenToday) return false;
               return true;
             }).length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({medications.filter((m) => {
               const today = new Date();
               today.setHours(0, 0, 0, 0);
 
               if (!m.is_active) return true;
               if (m.end_date) {
                 const endDate = new Date(m.end_date);
                 endDate.setHours(0, 0, 0, 0);
                 if (endDate < today) return true;
               }
 
               const todayStart = new Date();
               todayStart.setHours(0, 0, 0, 0);
               const todayEnd = new Date();
               todayEnd.setHours(23, 59, 59, 999);
 
               const logsForMedToday = logs.filter(
                 (log) =>
                   log.medication_id === m.id &&
                   new Date(log.scheduled_time) >= todayStart &&
                   new Date(log.scheduled_time) <= todayEnd
               );
 
               const hasTakenToday = logsForMedToday.some((log) => log.status === "taken");
 
               if (hasTakenToday && m.is_active) return true;
               return false;
             }).length})</TabsTrigger>
            <TabsTrigger value="all">All ({medications.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4 mt-6">
            {isLoading ? (
              <Card>
                <CardContent className="py-12 flex justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </CardContent>
              </Card>
            ) : filteredMedications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No medications found</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => navigate("/add-medication")}
                  >
                    Add Your First Medication
                  </Button>
                </CardContent>
              </Card>
            ) : (
              filteredMedications.map((medication) => (
                <Card
                  key={medication.id}
                  className="hover:border-primary transition-colors cursor-pointer"
                  onClick={() => navigate(`/medication/${medication.id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl">
                          💊
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-foreground">
                              {medication.name}
                            </h3>
                            <Badge variant="outline" className={medication.is_active ? "bg-accent/10 text-accent border-accent/20" : "bg-muted text-muted-foreground"}>
                              {medication.is_active ? "Active" : "Completed"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {medication.dosage} {medication.unit} • {formatFrequency(medication.frequency)}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              {medication.time}
                            </div>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/medication/${medication.id}`);
                          }}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/medication/${medication.id}/edit`);
                          }}>
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => handleDelete(medication.id, e)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default MedicationsPage;
