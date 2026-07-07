import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface LinkRequest {
  id: string;
  guardian_id: string;
  patient_id: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  updated_at: string;
}

export const useLinkRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("link_requests")
        .select("*")
        .or(`guardian_id.eq.${user.id},patient_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests((data as LinkRequest[]) || []);
    } catch (error) {
      console.error("Error fetching link requests:", error);
      toast.error("Failed to load link requests");
    } finally {
      setIsLoading(false);
    }
  };

  const createRequest = async (patientCode: string) => {
    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    try {
      // Normalize the patient code
      const normalizedCode = patientCode.trim().toUpperCase();

      // Create request via secure RPC (server-side code validation)
      const { data: reqId, error: rpcError } = await supabase.rpc(
        "create_link_request_by_code",
        {
          p_guardian_id: user.id,
          p_patient_code: normalizedCode,
        }
      );

      if (rpcError) {
        const msg = (rpcError as any)?.message || "Failed to send link request";
        if (msg.includes("INVALID_CODE")) {
          toast.error("Invalid patient code. Please check and try again.");
        } else if (msg.includes("ALREADY_LINKED")) {
          toast.info("Already linked with this patient");
        } else if (msg.includes("CANNOT_LINK_SELF")) {
          toast.error("You cannot link to yourself");
        } else {
          toast.error("Unable to create link request");
        }
        return;
      }

      toast.success("Link request sent successfully");
      await fetchRequests();
    } catch (error: any) {
      console.error("Error creating link request:", error);
      toast.error(error.message || "Failed to send link request");
    }
  };

  const updateRequestStatus = async (requestId: string, status: "approved" | "denied") => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("link_requests")
        .update({ status })
        .eq("id", requestId);

      if (error) throw error;

      toast.success(`Link request ${status}`);
      await fetchRequests();
    } catch (error) {
      console.error("Error updating link request:", error);
      toast.error("Failed to update link request");
    }
  };

  const deleteRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("link_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;

      setRequests((prev) => prev.filter((req) => req.id !== requestId));
      toast.success("Request cancelled");
    } catch (error) {
      console.error("Error deleting request:", error);
      toast.error("Failed to cancel request");
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchRequests();

    // Set up real-time subscription
    const channel = supabase
      .channel("link-requests-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "link_requests",
          filter: `guardian_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new as LinkRequest, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((req) =>
                req.id === payload.new.id ? (payload.new as LinkRequest) : req
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) => prev.filter((req) => req.id !== payload.old.id));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "link_requests",
          filter: `patient_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setRequests((prev) => [payload.new as LinkRequest, ...prev]);
            toast.info("New link request received", {
              description: "Check your notifications to approve or deny",
            });
          } else if (payload.eventType === "UPDATE") {
            setRequests((prev) =>
              prev.map((req) =>
                req.id === payload.new.id ? (payload.new as LinkRequest) : req
              )
            );
          } else if (payload.eventType === "DELETE") {
            setRequests((prev) => prev.filter((req) => req.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    requests,
    isLoading,
    createRequest,
    updateRequestStatus,
    deleteRequest,
    refresh: fetchRequests,
  };
};
