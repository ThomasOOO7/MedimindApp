import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type MedicationLog = Database["public"]["Tables"]["medication_logs"]["Row"];

export const useMedicationLogs = (patientId?: string) => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const effectivePatientId = patientId || user?.id;

  const fetchLogs = async () => {
    if (!effectivePatientId) return;

    try {
      const { data, error } = await supabase
        .from("medication_logs")
        .select("*")
        .eq("patient_id", effectivePatientId)
        .order("scheduled_time", { ascending: false })
        .limit(50);

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching medication logs:", error);
      toast.error("Failed to load medication history");
    } finally {
      setIsLoading(false);
    }
  };

  const logMedicationTaken = async (
    medicationId: string, 
    scheduledTime: Date,
    notes?: string,
    sideEffects?: string
  ) => {
    if (!effectivePatientId) return;

    try {
       // Use current device time as actual_time
       const actualTime = new Date();
       const scheduled = new Date(scheduledTime);

       // Use database function to log medication taken so that
       // get_todays_schedule and analytics stay in sync
       const { data, error } = await supabase.rpc("log_medication_taken", {
         p_medication_id: medicationId,
         p_patient_id: effectivePatientId,
         p_scheduled_time: scheduled.toISOString(),
         p_actual_time: actualTime.toISOString(),
         p_notes: notes || null,
         p_side_effects: sideEffects || null,
       });

       if (error) throw error;

       // Refresh logs from server so all views get the latest status
       await fetchLogs();

       toast.success(
         `Medication logged at ${actualTime.toLocaleTimeString("en-US", {
           hour: "2-digit",
           minute: "2-digit",
         })}`
       );
       return data;
     } catch (error) {
       console.error("Error logging medication:", error);
       toast.error("Failed to log medication");
       throw error;
     }
   };
 
   useEffect(() => {
    if (!effectivePatientId) return;

    fetchLogs();

    // Set up real-time subscription
    const channel = supabase
      .channel("medication-logs-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_logs",
          filter: `patient_id=eq.${effectivePatientId}`,
        },
        (payload) => {
          console.log("Medication log change:", payload);
          if (payload.eventType === "INSERT") {
            setLogs((prev) => [payload.new as MedicationLog, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLogs((prev) =>
              prev.map((log) =>
                log.id === payload.new.id ? (payload.new as MedicationLog) : log
              )
            );
          } else if (payload.eventType === "DELETE") {
            setLogs((prev) => prev.filter((log) => log.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [effectivePatientId]);

  return {
    logs,
    isLoading,
    logMedicationTaken,
    refresh: fetchLogs,
  };
};
