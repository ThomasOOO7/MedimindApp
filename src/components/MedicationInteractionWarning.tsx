import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

interface MedicationInteractionWarningProps {
  medications: Array<{ id: string; name: string }>;
}

export const MedicationInteractionWarning = ({ medications }: MedicationInteractionWarningProps) => {
  // This is a placeholder for future drug interaction checking
  // In production, this would integrate with a drug interaction API
  
  const hasMultipleMedications = medications.length > 1;
  
  if (!hasMultipleMedications) return null;

  return (
    <Alert variant="default" className="border-warning/50 bg-warning/5">
      <AlertTriangle className="h-4 w-4 text-warning" />
      <AlertTitle>Multiple Medications</AlertTitle>
      <AlertDescription>
        You're taking {medications.length} medications. If you experience unusual symptoms or side effects, 
        consult your healthcare provider immediately. Always inform your doctor about all medications you're taking.
      </AlertDescription>
    </Alert>
  );
};
