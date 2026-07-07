import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useLinkRequests } from "@/hooks/useLinkRequests";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus } from "lucide-react";

export const LinkRequestNotification = () => {
  const { user } = useAuth();
  const { requests, updateRequestStatus } = useLinkRequests();
  const [showDialog, setShowDialog] = useState(false);
  const [currentRequest, setCurrentRequest] = useState<any>(null);
  const [guardianProfile, setGuardianProfile] = useState<any>(null);

  // Get pending requests for current user (as patient)
  const pendingRequests = requests.filter(
    (req) => req.patient_id === user?.id && req.status === "pending"
  );

  useEffect(() => {
    const fetchGuardianProfile = async () => {
      if (pendingRequests.length > 0) {
        const request = pendingRequests[0];
        
        // Only show dialog if not already showing
        if (!showDialog || currentRequest?.id !== request.id) {
          const { data } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", request.guardian_id)
            .single();

          setGuardianProfile(data);
          setCurrentRequest(request);
          setShowDialog(true);
        }
      }
    };

    fetchGuardianProfile();
  }, [pendingRequests.length, pendingRequests[0]?.id]);

  const handleApprove = async () => {
    if (currentRequest) {
      await updateRequestStatus(currentRequest.id, "approved");
      setShowDialog(false);
      setCurrentRequest(null);
      setGuardianProfile(null);
    }
  };

  const handleDeny = async () => {
    if (currentRequest) {
      await updateRequestStatus(currentRequest.id, "denied");
      setShowDialog(false);
      setCurrentRequest(null);
      setGuardianProfile(null);
    }
  };

  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent className="rounded-xl max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <AlertDialogTitle className="text-center text-xl">
            Guardian Link Request
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {guardianProfile && (
              <>
                <span className="font-semibold text-foreground">
                  {guardianProfile.first_name} {guardianProfile.last_name}
                </span>{" "}
                wants to link with you as a guardian. They will be able to monitor your
                medication schedule and adherence.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleDeny} className="rounded-lg">
            Deny
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleApprove} className="rounded-lg bg-primary">
            Approve
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
