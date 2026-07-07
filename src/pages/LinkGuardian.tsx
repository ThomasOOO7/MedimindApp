import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Copy, UserPlus, Users, Shield, X, Key, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useGuardianLinks } from "@/hooks/useGuardianLinks";
import { useLinkRequests } from "@/hooks/useLinkRequests";
import DashboardLayout from "@/components/DashboardLayout";

const LinkGuardian = () => {
  const { user } = useAuth();
  const { links, isLoading, removeLink } = useGuardianLinks();
  const { requests, createRequest, updateRequestStatus, deleteRequest } = useLinkRequests();
  const [userType, setUserType] = useState<string | null>(null);
  const [patientCode, setPatientCode] = useState<string>("");
  const [guardianCode, setGuardianCode] = useState("");
  const [linkedProfiles, setLinkedProfiles] = useState<any[]>([]);
  const [requestProfiles, setRequestProfiles] = useState<any[]>([]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;

      // Fetch user type and patient code
      const { data: profile } = await supabase
        .from("profiles")
        .select("user_type, patient_code")
        .eq("id", user.id)
        .single();

      setUserType(profile?.user_type || null);
      setPatientCode(profile?.patient_code || "");

      // Fetch linked profiles
      const linkedIds = links
        .filter((link) => link.status === "active")
        .map((link) => (link.guardian_id === user.id ? link.patient_id : link.guardian_id));

      if (linkedIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .in("id", linkedIds);

        setLinkedProfiles(data || []);
      }

      // Fetch request profiles
      const requestIds = requests.map((req) => 
        req.guardian_id === user.id ? req.patient_id : req.guardian_id
      );

      if (requestIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .in("id", requestIds);

        setRequestProfiles(data || []);
      }
    };

    fetchUserData();

    // Real-time subscriptions
    const profilesChannel = supabase
      .channel('link-guardian-profiles')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          fetchUserData();
        }
      )
      .subscribe();

    const linksChannel = supabase
      .channel('link-guardian-links')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'guardian_patient_links',
        },
        () => {
          fetchUserData();
        }
      )
      .subscribe();

    const requestsChannel = supabase
      .channel('link-guardian-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'link_requests',
        },
        () => {
          fetchUserData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(linksChannel);
      supabase.removeChannel(requestsChannel);
    };
  }, [links, requests, user]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(patientCode);
    toast.success("Patient code copied!");
  };

  const handleSendRequest = async () => {
    if (!guardianCode.trim()) {
      toast.error("Please enter a patient code");
      return;
    }
    await createRequest(guardianCode.toUpperCase());
    setGuardianCode("");
  };

  const handleRemoveConnection = async (linkId: string) => {
    try {
      await removeLink(linkId);
    } catch (error) {
      console.error("Error removing connection:", error);
    }
  };

  const activeLinks = links.filter((link) => link.status === "active");
  const pendingRequests = requests.filter((req) => req.status === "pending");
  const myPendingRequests = pendingRequests.filter((req) => 
    userType === "guardian" ? req.guardian_id === user?.id : req.patient_id === user?.id
  );

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Guardian Linking
          </h1>
          <p className="text-muted-foreground mt-1">Connect with family members or caretakers</p>
        </div>

        <Card className="rounded-xl border-primary/20 bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-primary mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">Privacy & Control</h3>
                <p className="text-sm text-muted-foreground">
                  {userType === "patient" 
                    ? "You have complete control over what guardians can see. You can adjust permissions or remove guardians at any time."
                    : "Patients must approve your link request before you can monitor their medications."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {userType === "patient" ? (
          <Card className="rounded-xl border-border/50 shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Your Patient Code
              </CardTitle>
              <CardDescription>Share this code with guardians who want to link with you</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-4">
                <div className="bg-gradient-to-br from-primary/10 to-secondary/10 p-8 rounded-xl border border-primary/20">
                  <div className="text-5xl font-bold text-primary tracking-widest font-mono">
                    {patientCode || "Loading..."}
                  </div>
                </div>
                <Button 
                  onClick={handleCopyCode} 
                  className="w-full rounded-lg"
                  disabled={!patientCode}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Code
                </Button>
                <p className="text-xs text-muted-foreground">
                  Guardians can use this code to send you a link request
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border-border/50 shadow-lg bg-gradient-to-br from-card to-card/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                Link with Patient
              </CardTitle>
              <CardDescription>Enter a patient's code to send a link request</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="patientCode">Patient Code</Label>
                <Input
                  id="patientCode"
                  type="text"
                  placeholder="ABCD12"
                  value={guardianCode}
                  onChange={(e) => setGuardianCode(e.target.value.toUpperCase())}
                  className="text-center font-mono text-lg rounded-lg"
                  maxLength={6}
                />
              </div>
              <Button 
                onClick={handleSendRequest} 
                className="w-full rounded-lg"
                disabled={guardianCode.length !== 6}
              >
                Send Link Request
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Connected ({activeLinks.length})
            </CardTitle>
            <CardDescription>Manage your connections</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </>
            ) : activeLinks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No connections yet</p>
            ) : (
              activeLinks.map((link) => {
                const profile = linkedProfiles.find(
                  (p) => p.id === (link.guardian_id === user?.id ? link.patient_id : link.guardian_id)
                );
                if (!profile) return null;

                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {profile.first_name?.[0]}{profile.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {profile.first_name} {profile.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {link.guardian_id === user?.id ? "Patient" : "Guardian"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveConnection(link.id)}
                      className="text-destructive hover:text-destructive rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {myPendingRequests.length > 0 && (
          <Card className="rounded-xl border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>
                {userType === "patient" ? "Pending Requests" : "Sent Requests"} ({myPendingRequests.length})
              </CardTitle>
              <CardDescription>
                {userType === "patient" 
                  ? "Approve or deny guardian link requests" 
                  : "Waiting for patient approval"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {myPendingRequests.map((req) => {
                const profile = requestProfiles.find(
                  (p) => p.id === (userType === "guardian" ? req.patient_id : req.guardian_id)
                );
                if (!profile) return null;

                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between p-4 rounded-xl border border-border bg-gradient-to-r from-card to-card/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                        <span className="text-lg font-semibold text-primary">
                          {profile.first_name?.[0]}{profile.last_name?.[0]}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">
                          {profile.first_name} {profile.last_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(req.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {userType === "patient" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateRequestStatus(req.id, "approved")}
                            className="rounded-lg"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateRequestStatus(req.id, "denied")}
                            className="rounded-lg text-destructive"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Deny
                          </Button>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="rounded-full">Pending</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive rounded-lg"
                            onClick={() => deleteRequest(req.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LinkGuardian;
