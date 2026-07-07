import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle } from "lucide-react";

interface TakeMedicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicationName: string;
  onConfirm: (notes?: string, sideEffects?: string) => Promise<void>;
}

export const TakeMedicationDialog = ({
  open,
  onOpenChange,
  medicationName,
  onConfirm,
}: TakeMedicationDialogProps) => {
  const [notes, setNotes] = useState("");
  const [sideEffects, setSideEffects] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm(notes || undefined, sideEffects || undefined);
      setNotes("");
      setSideEffects("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error confirming medication:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-accent" />
            Confirm Medication
          </DialogTitle>
          <DialogDescription>
            Logging <span className="font-medium">{medicationName}</span> as taken
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes about taking this medication..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="side-effects">Side Effects (Optional)</Label>
            <Textarea
              id="side-effects"
              placeholder="Any side effects you're experiencing..."
              value={sideEffects}
              onChange={(e) => setSideEffects(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Logging..." : "Confirm & Log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
