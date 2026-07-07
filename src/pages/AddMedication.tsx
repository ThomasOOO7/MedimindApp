import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Camera, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMedications } from "@/hooks/useMedications";

const medicationSchema = z.object({
  name: z.string()
    .min(1, "Medication name is required")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z0-9\s\-\.]+$/, "Name contains invalid characters"),
  dosage: z.string()
    .min(1, "Dosage is required")
    .max(20, "Dosage must be less than 20 characters")
    .regex(/^[0-9]+$/, "Dosage must be a number"),
  unit: z.enum(["mg", "ml", "tablet", "capsule", "drops", "spray", "patch"]),
  frequency: z.enum(["daily", "twice_daily", "three_times_daily", "four_times_daily", "weekly", "as_needed"]),
  doseTimes: z.array(z.string().min(1, "Time is required")).min(1, "At least one time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  instructions: z.string()
    .max(500, "Instructions must be less than 500 characters")
    .optional(),
});

type MedicationForm = z.infer<typeof medicationSchema>;

const getTimesCount = (frequency: string): number => {
  switch (frequency) {
    case "twice_daily": return 2;
    case "three_times_daily": return 3;
    case "four_times_daily": return 4;
    default: return 1;
  }
};

const AddMedication = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addMedication } = useMedications();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<MedicationForm>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      name: "",
      dosage: "",
      unit: "mg",
      frequency: "daily",
      doseTimes: [""],
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
      instructions: "",
    }
  });

  const selectedFrequency = form.watch("frequency");

  // Update dose times array when frequency changes
  useEffect(() => {
    const requiredTimes = getTimesCount(selectedFrequency);
    const currentTimes = form.getValues("doseTimes");
    
    if (currentTimes.length !== requiredTimes) {
      const newTimes = Array(requiredTimes).fill("").map((_, i) => currentTimes[i] || "");
      form.setValue("doseTimes", newTimes);
    }
  }, [selectedFrequency]);

  // Sanitize extracted text from OCR
  const sanitizeTextField = (text: string, maxLength: number): string => {
    return text
      .trim()
      .slice(0, maxLength)
      .replace(/[^a-zA-Z0-9\s\-\.]/g, '')
      .replace(/\s+/g, ' ');
  };

  // Enhanced auto-fill from scanned prescription with better parsing
  useEffect(() => {
    const scannedText = location.state?.scannedText;
    if (scannedText) {
      const textLower = scannedText.toLowerCase();
      const lines = scannedText.split('\n').filter(line => line.trim());
      
      // Extract medication name (first meaningful line with letters, excluding common prescription words)
      const excludeWords = ['prescription', 'dr.', 'doctor', 'date', 'patient', 'rx', 'sig'];
      const medicationName = lines.find(line => {
        const lineLower = line.toLowerCase();
        return line.length > 3 && 
               /[a-zA-Z]/.test(line) && 
               !excludeWords.some(word => lineLower.includes(word)) &&
               !/^\d+/.test(line); // Not starting with numbers
      });
      
      // Extract dosage with better unit detection
      const dosageMatch = scannedText.match(/(\d+(?:\.\d+)?)\s*(mg|ml|tablet[s]?|capsule[s]?|drop[s]?|spray[s]?|patch(?:es)?)/i);
      
      // Extract frequency patterns
      const frequencyPatterns = [
        { regex: /four times (?:a |per )?day|4x daily|qid|4 times daily/i, value: "four_times_daily" as const },
        { regex: /three times (?:a |per )?day|3x daily|tid|3 times daily/i, value: "three_times_daily" as const },
        { regex: /twice (?:a |per )?day|2x daily|bid|twice daily/i, value: "twice_daily" as const },
        { regex: /once (?:a |per )?day|1x daily|qd|daily|once daily/i, value: "daily" as const },
        { regex: /weekly|once (?:a |per )?week|every week/i, value: "weekly" as const },
        { regex: /as needed|prn|when required/i, value: "as_needed" as const },
      ];
      
      // Extract timing (morning, afternoon, evening, night, bedtime)
      const timePatterns = [
        { regex: /morning|breakfast|am|8:?00?|09:?00?/i, time: "08:00" },
        { regex: /afternoon|lunch|12:?00?|13:?00?|14:?00?/i, time: "13:00" },
        { regex: /evening|dinner|18:?00?|19:?00?|20:?00?/i, time: "19:00" },
        { regex: /night|bedtime|before (?:sleep|bed)|22:?00?|23:?00?/i, time: "22:00" },
      ];
      
      // Extract duration (days, weeks, months)
      const durationMatch = scannedText.match(/(?:for|duration|take for)\s*(\d+)\s*(day[s]?|week[s]?|month[s]?)/i);
      
      // Apply medication name
      if (medicationName) {
        const sanitizedName = sanitizeTextField(medicationName, 100);
        if (sanitizedName) {
          form.setValue("name", sanitizedName);
        }
      }
      
      // Apply dosage and unit
      if (dosageMatch) {
        const sanitizedDosage = dosageMatch[1].slice(0, 20);
        form.setValue("dosage", sanitizedDosage);
        let unit = dosageMatch[2].toLowerCase().replace(/s$/, ''); // Remove plural 's'
        if (unit === 'tablets') unit = 'tablet';
        if (unit === 'capsules') unit = 'capsule';
        if (unit === 'drops') unit = 'drops';
        if (unit === 'sprays') unit = 'spray';
        if (unit === 'patches') unit = 'patch';
        
        if (["mg", "ml", "tablet", "capsule", "drops", "spray", "patch"].includes(unit)) {
          form.setValue("unit", unit as any);
        }
      }
      
      // Apply frequency
      const detectedFrequency = frequencyPatterns.find(pattern => pattern.regex.test(textLower));
      if (detectedFrequency) {
        form.setValue("frequency", detectedFrequency.value);
      }
      
      // Apply timing based on detected times
      const detectedTimes = timePatterns.filter(pattern => pattern.regex.test(textLower));
      if (detectedTimes.length > 0) {
        const timesCount = getTimesCount(form.getValues("frequency"));
        const times = detectedTimes.slice(0, timesCount).map(t => t.time);
        // Fill remaining times if needed
        while (times.length < timesCount) {
          times.push("");
        }
        form.setValue("doseTimes", times);
      }
      
      // Apply duration (calculate end date)
      if (durationMatch) {
        const amount = parseInt(durationMatch[1]);
        const unit = durationMatch[2].toLowerCase();
        const startDate = new Date();
        let endDate = new Date();
        
        if (unit.includes('day')) {
          endDate.setDate(startDate.getDate() + amount);
        } else if (unit.includes('week')) {
          endDate.setDate(startDate.getDate() + (amount * 7));
        } else if (unit.includes('month')) {
          endDate.setMonth(startDate.getMonth() + amount);
        }
        
        form.setValue("endDate", endDate.toISOString().split('T')[0]);
      }
      
      toast.success("Prescription scanned and parsed successfully!");
      toast.info("Please review all fields carefully before saving.");
    }
  }, [location.state]);

  const onSubmit = async (data: MedicationForm) => {
    if (!user?.id) {
      toast.error("You must be logged in to add medications");
      return;
    }

    setIsLoading(true);
    try {
      await addMedication({
        patient_id: user.id,
        name: data.name,
        dosage: data.dosage,
        unit: data.unit,
        frequency: data.frequency,
        time: data.doseTimes[0], // Keep first time for backward compatibility
        dose_times: data.doseTimes.length > 1 ? data.doseTimes : null,
        start_date: data.startDate,
        end_date: data.endDate || null,
        instructions: data.instructions || null,
        is_active: true,
      });
      
      toast.success("Medication added successfully!");
      navigate("/medications");
    } catch (error: any) {
      toast.error(error.message || "Failed to add medication");
    } finally {
      setIsLoading(false);
    }
  };

  const frequencyOptions = [
    { value: "daily", label: "Once daily" },
    { value: "twice_daily", label: "Twice daily" },
    { value: "three_times_daily", label: "Three times daily" },
    { value: "four_times_daily", label: "Four times daily" },
    { value: "weekly", label: "Weekly" },
    { value: "as_needed", label: "As needed" },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Add Medication</h1>
            <p className="text-muted-foreground">Enter medication details or scan a prescription</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => navigate("/scan-prescription")}>
            <CardHeader className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Camera className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>Scan Prescription</CardTitle>
              <CardDescription>Use your camera to scan and auto-fill medication details</CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-primary/5 border-primary">
            <CardHeader className="text-center">
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>Fill in the form below to add medication</CardDescription>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Medication Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medication Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Lisinopril" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dosage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dosage</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 10" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mg">mg</SelectItem>
                            <SelectItem value="ml">ml</SelectItem>
                            <SelectItem value="tablet">tablet(s)</SelectItem>
                            <SelectItem value="capsule">capsule(s)</SelectItem>
                            <SelectItem value="drops">drops</SelectItem>
                            <SelectItem value="spray">spray(s)</SelectItem>
                            <SelectItem value="patch">patch</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {frequencyOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel>Medication Times</FormLabel>
                  {form.watch("doseTimes").map((_, index) => (
                    <FormField
                      key={index}
                      control={form.control}
                      name={`doseTimes.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm text-muted-foreground">
                            {form.watch("doseTimes").length > 1 ? `Dose ${index + 1} Time` : "Time"}
                          </FormLabel>
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormDescription>
                    {getTimesCount(selectedFrequency) > 1 
                      ? `Set ${getTimesCount(selectedFrequency)} times for your medication schedule`
                      : "Set the time for your medication reminder"
                    }
                  </FormDescription>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Instructions (Optional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="e.g., Take with food, avoid alcohol"
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isLoading}>
                    {isLoading ? "Saving..." : "Add Medication"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AddMedication;
