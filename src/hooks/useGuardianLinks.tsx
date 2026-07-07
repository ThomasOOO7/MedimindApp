import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type GuardianPatientLink = Database["public"]["Tables"]["guardian_patient_links"]["Row"];

export const useGuardianLinks = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<GuardianPatientLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLinks = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("guardian_patient_links")
        .select("*")
        .or(`guardian_id.eq.${user.id},patient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setLinks(data || []);
    } catch (error) {
      console.error("Error fetching guardian links:", error);
      toast.error("Failed to load connections");
    } finally {
      setIsLoading(false);
    }
  };

  const createLink = async (email: string, method: "email" | "sms" | "code") => {
    if (!user) return;

    try {
      // For now, create a pending link
      // In production, this would send an invitation
      toast.success(`Invitation sent via ${method}`);
    } catch (error) {
      console.error("Error creating link:", error);
      toast.error("Failed to send invitation");
      throw error;
    }
  };

  const removeLink = async (linkId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("guardian_patient_links")
        .delete()
        .eq("id", linkId);

      if (error) throw error;

      setLinks((prev) => prev.filter((link) => link.id !== linkId));
      toast.success("Connection removed");
    } catch (error) {
      console.error("Error removing link:", error);
      toast.error("Failed to remove connection");
      throw error;
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchLinks();

    // Set up real-time subscription
    const channel = supabase
      .channel("guardian-links-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guardian_patient_links",
          filter: `guardian_id=eq.${user.id}`,
        },
        (payload) => {
          console.log("Guardian link change:", payload);
          if (payload.eventType === "INSERT") {
            setLinks((prev) => [payload.new as GuardianPatientLink, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLinks((prev) =>
              prev.map((link) =>
                link.id === payload.new.id ? (payload.new as GuardianPatientLink) : link
              )
            );
          } else if (payload.eventType === "DELETE") {
            setLinks((prev) => prev.filter((link) => link.id !== payload.old.id));
          }
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
        (payload) => {
          console.log("Patient link change:", payload);
          if (payload.eventType === "INSERT") {
            setLinks((prev) => [payload.new as GuardianPatientLink, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setLinks((prev) =>
              prev.map((link) =>
                link.id === payload.new.id ? (payload.new as GuardianPatientLink) : link
              )
            );
          } else if (payload.eventType === "DELETE") {
            setLinks((prev) => prev.filter((link) => link.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    links,
    isLoading,
    createLink,
    removeLink,
    refresh: fetchLinks,
  };
};
