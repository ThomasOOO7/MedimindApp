import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Moon, Sun, Monitor, User, Bell, HelpCircle, Save, Camera, LogOut, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const SettingsPage = () => {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [profile, setProfile] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: user?.email || "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    healthcareProvider: "",
  });
  const [userType, setUserType] = useState<string | null>(null);
  const [patientCode, setPatientCode] = useState<string>("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [notifications, setNotifications] = useState({
    reminders: true,
    sounds: true,
    missedDoseAlerts: true,
    guardianAlerts: true,
    pushNotifications: permission === "granted",
  });
  const [feedback, setFeedback] = useState({ subject: "", message: "" });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, phone, user_type, patient_code, emergency_contact_name, emergency_contact_phone, healthcare_provider")
        .eq("id", user.id)
        .single();
      
      if (data && !error) {
        setProfile({
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          phone: data.phone || "",
          email: user.email || "",
          emergencyContactName: data.emergency_contact_name || "",
          emergencyContactPhone: data.emergency_contact_phone || "",
          healthcareProvider: data.healthcare_provider || "",
        });
        setUserType(data.user_type);
        setPatientCode(data.patient_code || "");
      }
    };

    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile.firstName,
          last_name: profile.lastName,
          phone: profile.phone,
          emergency_contact_name: profile.emergencyContactName,
          emergency_contact_phone: profile.emergencyContactPhone,
          healthcare_provider: profile.healthcareProvider,
        })
        .eq("id", user?.id);

      if (error) throw error;
      toast.success("Profile updated successfully");
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const handlePushNotificationToggle = async (checked: boolean) => {
    if (checked && permission !== "granted") {
      const granted = await requestPermission();
      setNotifications({ ...notifications, pushNotifications: granted });
    } else {
      setNotifications({ ...notifications, pushNotifications: checked });
    }
  };

  const handleSubmitFeedback = () => {
    if (!feedback.subject || !feedback.message) {
      toast.error("Please fill in all fields");
      return;
    }
    toast.success("Feedback submitted! We'll get back to you soon.");
    setFeedback({ subject: "", message: "" });
  };

  const handleCopyCode = async () => {
    if (patientCode) {
      await navigator.clipboard.writeText(patientCode);
      setCodeCopied(true);
      toast.success("Patient code copied to clipboard!");
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4 rounded-xl">
            <TabsTrigger value="profile" className="rounded-lg">
              <User className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="theme" className="rounded-lg">
              <Sun className="w-4 h-4 mr-2" />
              Theme
            </TabsTrigger>
            <TabsTrigger value="notifications" className="rounded-lg">
              <Bell className="w-4 h-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="help" className="rounded-lg">
              <HelpCircle className="w-4 h-4 mr-2" />
              Help
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-6">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="w-20 h-20">
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-2xl">
                      {profile.firstName?.[0]}{profile.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <Button variant="outline" className="gap-2 rounded-lg">
                    <Camera className="w-4 h-4" />
                    Change Photo
                  </Button>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={profile.email} disabled className="rounded-lg" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="rounded-lg"
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="healthcareProvider">Healthcare Provider</Label>
                  <Input
                    id="healthcareProvider"
                    placeholder="Dr. Smith, City Hospital"
                    value={profile.healthcareProvider}
                    onChange={(e) => setProfile({ ...profile, healthcareProvider: e.target.value })}
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Caretaker Name</Label>
                  <Input
                    id="emergencyContactName"
                    placeholder="Caretaker Name"
                    value={profile.emergencyContactName}
                    onChange={(e) => setProfile({ ...profile, emergencyContactName: e.target.value })}
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
                  <Input
                    id="emergencyContactPhone"
                    type="tel"
                    placeholder="+91 -00000-00000"
                    value={profile.emergencyContactPhone}
                    onChange={(e) => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                    className="rounded-lg"
                  />
                </div>

                {userType === "patient" && patientCode && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <Label htmlFor="patientCode">Your Patient Code</Label>
                      <p className="text-sm text-muted-foreground mb-2">
                        Share this code with your guardian to link your accounts
                      </p>
                      <div className="flex gap-2">
                        <Input
                          id="patientCode"
                          value={patientCode}
                          readOnly
                          className="rounded-lg font-mono text-lg font-bold"
                        />
                        <Button
                          onClick={handleCopyCode}
                          variant="outline"
                          className="gap-2 rounded-lg"
                        >
                          {codeCopied ? (
                            <>
                              <Check className="w-4 h-4" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <Button onClick={handleSaveProfile} className="w-full gap-2 rounded-lg">
                  <Save className="w-4 h-4" />
                  Save Changes
                </Button>

                <Separator />

                <Button 
                  onClick={handleLogout} 
                  variant="destructive" 
                  className="w-full gap-2 rounded-lg"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="theme" className="space-y-4 mt-6">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Theme Selection</CardTitle>
                <CardDescription>Choose your preferred theme</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  onClick={() => setTheme("light")}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === "light" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <Sun className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Light</h3>
                      <p className="text-sm text-muted-foreground">Clean and bright interface</p>
                    </div>
                  </div>
                  {theme === "light" && <Badge className="rounded-full">Active</Badge>}
                </div>

                <div
                  onClick={() => setTheme("dark")}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <Moon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Dark</h3>
                      <p className="text-sm text-muted-foreground">Easy on the eyes</p>
                    </div>
                  </div>
                  {theme === "dark" && <Badge className="rounded-full">Active</Badge>}
                </div>

                <div
                  onClick={() => setTheme("system")}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    theme === "system" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <Monitor className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">System</h3>
                      <p className="text-sm text-muted-foreground">Matches device theme</p>
                    </div>
                  </div>
                  {theme === "system" && <Badge className="rounded-full">Active</Badge>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4 mt-6">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Manage how you receive alerts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Medication Reminders</h4>
                    <p className="text-sm text-muted-foreground">Get notified when it's time to take medication</p>
                  </div>
                  <Switch
                    checked={notifications.reminders}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, reminders: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Notification Sounds</h4>
                    <p className="text-sm text-muted-foreground">Play sound with notifications</p>
                  </div>
                  <Switch
                    checked={notifications.sounds}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, sounds: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Missed Dose Alerts</h4>
                    <p className="text-sm text-muted-foreground">Alert when a dose is missed</p>
                  </div>
                  <Switch
                    checked={notifications.missedDoseAlerts}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, missedDoseAlerts: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Guardian Alerts</h4>
                    <p className="text-sm text-muted-foreground">Receive updates from guardians</p>
                  </div>
                  <Switch
                    checked={notifications.guardianAlerts}
                    onCheckedChange={(checked) => setNotifications({ ...notifications, guardianAlerts: checked })}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Push Notifications</h4>
                    <p className="text-sm text-muted-foreground">
                      {isSupported 
                        ? "Receive notifications even when app is closed" 
                        : "Not supported in your browser"}
                    </p>
                  </div>
                  <Switch
                    disabled={!isSupported}
                    checked={notifications.pushNotifications}
                    onCheckedChange={handlePushNotificationToggle}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="help" className="space-y-4 mt-6">
            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>Find answers to common questions</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>How do I add a medication?</AccordionTrigger>
                    <AccordionContent>
                      Click the "Add Medication" button on your dashboard, then fill in the medication details or scan your prescription.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-2">
                    <AccordionTrigger>How do I link a guardian?</AccordionTrigger>
                    <AccordionContent>
                      Go to the Guardian Linking page and send an invitation via email, SMS, or share a code.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Can I edit my medication schedule?</AccordionTrigger>
                    <AccordionContent>
                      Yes, go to the Medications page, select a medication, and click Edit to modify the schedule.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Send Feedback</CardTitle>
                <CardDescription>We'd love to hear from you</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="What's this about?"
                    value={feedback.subject}
                    onChange={(e) => setFeedback({ ...feedback, subject: e.target.value })}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us more..."
                    value={feedback.message}
                    onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                    rows={5}
                    className="rounded-lg"
                  />
                </div>
                <Button onClick={handleSubmitFeedback} className="w-full rounded-lg">
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
