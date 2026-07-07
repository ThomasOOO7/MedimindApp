import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Medication = Database["public"]["Tables"]["medications"]["Row"];

export const useMedications = () => {
  const { user } = useAuth();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMedications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("medications")
        .select("*")
        .eq("patient_id", user.id)
        .order("time", { ascending: true });

      if (error) throw error;

      setMedications(data || []);
    } catch (error) {
      console.error("Error fetching medications:", error);
      toast.error("Failed to load medications");
    } finally {
      setIsLoading(false);
    }
  };

  const addMedication = async (medication: Database["public"]["Tables"]["medications"]["Insert"]) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("medications")
        .insert({
          ...medication,
          patient_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setMedications((prev) => [...prev, data]);
      toast.success("Medication added successfully");
      return data;
    } catch (error) {
      console.error("Error adding medication:", error);
      toast.error("Failed to add medication");
      throw error;
    }
  };

  const updateMedication = async (id: string, updates: Database["public"]["Tables"]["medications"]["Update"]) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("medications")
        .update(updates)
        .eq("id", id)
        .eq("patient_id", user.id)
        .select()
        .single();

      if (error) throw error;

      setMedications((prev) =>
        prev.map((med) => (med.id === id ? data : med))
      );
      toast.success("Medication updated");
      return data;
    } catch (error) {
      console.error("Error updating medication:", error);
      toast.error("Failed to update medication");
      throw error;
    }
  };

  const deleteMedication = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("medications")
        .delete()
        .eq("id", id)
        .eq("patient_id", user.id);

      if (error) throw error;

      setMedications((prev) => prev.filter((med) => med.id !== id));
      toast.success("Medication deleted");
    } catch (error) {
      console.error("Error deleting medication:", error);
      toast.error("Failed to delete medication");
      throw error;
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchMedications();

    // Set up real-time subscription for medications
    const channel = supabase
      .channel("medications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Medication change:", payload);
          if (payload.eventType === "INSERT") {
            setMedications((prev) => [...prev, payload.new as Medication]);
            toast.success("New medication added");
          } else if (payload.eventType === "UPDATE") {
            setMedications((prev) =>
              prev.map((med) =>
                med.id === payload.new.id ? (payload.new as Medication) : med
              )
            );
          } else if (payload.eventType === "DELETE") {
            setMedications((prev) => prev.filter((med) => med.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    medications,
    isLoading,
    addMedication,
    updateMedication,
    deleteMedication,
    refresh: fetchMedications,
  };
};
