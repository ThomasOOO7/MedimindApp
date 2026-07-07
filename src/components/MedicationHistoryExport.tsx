import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface MedicationLog {
  id: string;
  medication_id: string;
  scheduled_time: string;
  actual_time: string | null;
  status: string;
  notes: string | null;
  side_effects: string | null;
}

interface MedicationHistoryExportProps {
  logs: MedicationLog[];
  medicationName: string;
}

export const MedicationHistoryExport = ({ logs, medicationName }: MedicationHistoryExportProps) => {
  const exportToCSV = () => {
    try {
      const headers = ["Date", "Scheduled Time", "Actual Time", "Status", "Notes", "Side Effects"];
      const rows = logs.map(log => [
        format(new Date(log.scheduled_time), 'yyyy-MM-dd'),
        format(new Date(log.scheduled_time), 'HH:mm'),
        log.actual_time ? format(new Date(log.actual_time), 'HH:mm') : 'N/A',
        log.status,
        log.notes || '',
        log.side_effects || ''
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `${medicationName.replace(/\s+/g, '_')}_history_${format(new Date(), 'yyyy-MM-dd')}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("Medication history exported successfully");
    } catch (error) {
      console.error("Error exporting history:", error);
      toast.error("Failed to export medication history");
    }
  };

  return (
    <Button onClick={exportToCSV} variant="outline" size="sm" className="w-full">
      <Download className="w-4 h-4 mr-2" />
      Export History (CSV)
    </Button>
  );
};
