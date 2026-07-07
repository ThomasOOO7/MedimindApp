import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Phone, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmergencyContact {
  name: string;
  phone: string;
}

export const EmergencyContactButton = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchEmergencyContacts = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("emergency_contact_name, emergency_contact_phone, healthcare_provider")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        const contactsList: EmergencyContact[] = [];
        if (data?.emergency_contact_name && data?.emergency_contact_phone) {
          contactsList.push({
            name: data.emergency_contact_name,
            phone: data.emergency_contact_phone,
          });
        }
        if (data?.healthcare_provider) {
          contactsList.push({
            name: data.healthcare_provider,
            phone: "Contact via provider portal",
          });
        }

        setContacts(contactsList);
      } catch (error) {
        console.error("Error fetching emergency contacts:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmergencyContacts();
  }, [user]);

  const handleCall = (phone: string) => {
    if (phone.includes("portal")) {
      toast.info("Please contact your healthcare provider through their portal");
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Phone className="w-4 h-4" />
          Emergency
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Emergency Contacts</DialogTitle>
          <DialogDescription>
            Quick access to your emergency contacts and healthcare providers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No emergency contacts configured. Add them in your profile settings.
            </p>
          ) : (
            contacts.map((contact, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  </div>
                </div>
                {!contact.phone.includes("portal") && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleCall(contact.phone)}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
