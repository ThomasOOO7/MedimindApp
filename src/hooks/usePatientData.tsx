import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Medication = Database["public"]["Tables"]["medications"]["Row"];

interface PatientData {
  profile: Profile | null;
  medications: Medication[];
  adherenceRate: number;
  todayDoses: { taken: number; total: number };
}

export const usePatientData = (patientId: string) => {
  const [data, setData] = useState<PatientData>({
    profile: null,
    medications: [],
    adherenceRate: 0,
    todayDoses: { taken: 0, total: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchPatientData = async () => {
    if (!patientId) return;

    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", patientId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Fetch medications
      const { data: medications, error: medsError } = await supabase
        .from("medications")
        .select("*")
        .eq("patient_id", patientId)
        .eq("is_active", true);

      if (medsError) throw medsError;

      // Calculate adherence using Supabase function
      const { data: adherenceData } = await supabase.rpc("calculate_adherence_rate", {
        p_patient_id: patientId,
        p_start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        p_end_date: new Date().toISOString().split("T")[0],
      });

      // Get today's schedule
      const { data: todaySchedule } = await supabase.rpc("get_todays_schedule", {
        p_patient_id: patientId,
      });

      const todayDoses = {
        taken: (todaySchedule || []).filter((m: any) => m.status === "taken").length,
        total: (todaySchedule || []).length,
      };

      setData({
        profile,
        medications: medications || [],
        adherenceRate: adherenceData || 0,
        todayDoses,
      });
    } catch (error) {
      console.error("Error fetching patient data:", error);
      toast.error("Failed to load patient data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();

    // Set up real-time subscriptions
    const medicationsChannel = supabase
      .channel(`patient-medications-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          fetchPatientData();
        }
      )
      .subscribe();

    const logsChannel = supabase
      .channel(`patient-logs-${patientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_logs",
          filter: `patient_id=eq.${patientId}`,
        },
        () => {
          fetchPatientData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(medicationsChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [patientId]);

  return {
    ...data,
    isLoading,
    refresh: fetchPatientData,
  };
};
