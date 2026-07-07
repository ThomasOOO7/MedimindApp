import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useMedications } from "@/hooks/useMedications";
import { supabase } from "@/integrations/supabase/client";

const medicationSchema = z.object({
  name: z.string().min(1, "Medication name is required").max(100, "Name must be less than 100 characters"),
  dosage: z.string().min(1, "Dosage is required").max(20, "Dosage must be less than 20 characters"),
  unit: z.enum(["mg", "ml", "tablet", "capsule", "drops", "spray", "patch"]),
  frequency: z.enum(["daily", "twice_daily", "three_times_daily", "four_times_daily", "weekly", "as_needed"]),
  doseTimes: z.array(z.string().min(1, "Time is required")).min(1, "At least one time is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
  instructions: z.string().max(500, "Instructions must be less than 500 characters").optional(),
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

const EditMedication = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { updateMedication } = useMedications();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

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

  // Fetch medication data
  useEffect(() => {
    const fetchMedication = async () => {
      if (!id || !user) return;

      try {
        const { data, error } = await supabase
          .from("medications")
          .select("*")
          .eq("id", id)
          .eq("patient_id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          form.reset({
            name: data.name,
            dosage: data.dosage,
            unit: data.unit,
            frequency: data.frequency,
            doseTimes: data.dose_times || [data.time],
            startDate: data.start_date,
            endDate: data.end_date || "",
            instructions: data.instructions || "",
          });
        }
      } catch (error) {
        console.error("Error fetching medication:", error);
        toast.error("Failed to load medication");
        navigate("/medications");
      } finally {
        setIsFetching(false);
      }
    };

    fetchMedication();
  }, [id, user]);

  // Update dose times array when frequency changes
  useEffect(() => {
    const requiredTimes = getTimesCount(selectedFrequency);
    const currentTimes = form.getValues("doseTimes");
    
    if (currentTimes.length !== requiredTimes) {
      const newTimes = Array(requiredTimes).fill("").map((_, i) => currentTimes[i] || "");
      form.setValue("doseTimes", newTimes);
    }
  }, [selectedFrequency]);

  const onSubmit = async (data: MedicationForm) => {
    if (!user || !id) {
      toast.error("You must be logged in to edit medications");
      return;
    }

    setIsLoading(true);

    try {
      await updateMedication(id, {
        name: data.name,
        dosage: data.dosage,
        unit: data.unit,
        frequency: data.frequency,
        dose_times: data.doseTimes,
        time: data.doseTimes[0],
        start_date: data.startDate,
        end_date: data.endDate || null,
        instructions: data.instructions || null,
      });

      toast.success("Medication updated successfully");
      navigate("/medications");
    } catch (error) {
      console.error("Error updating medication:", error);
      toast.error("Failed to update medication");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Medication</h1>
            <p className="text-muted-foreground">Update your medication details</p>
          </div>
        </div>

        <Card className="rounded-xl border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle>Medication Information</CardTitle>
            <CardDescription>Update the details of your medication</CardDescription>
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
                        <Input placeholder="e.g., Aspirin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dosage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dosage</FormLabel>
                        <FormControl>
                          <Input type="text" placeholder="e.g., 500" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mg">mg (milligrams)</SelectItem>
                            <SelectItem value="ml">ml (milliliters)</SelectItem>
                            <SelectItem value="tablet">Tablet</SelectItem>
                            <SelectItem value="capsule">Capsule</SelectItem>
                            <SelectItem value="drops">Drops</SelectItem>
                            <SelectItem value="spray">Spray</SelectItem>
                            <SelectItem value="patch">Patch</SelectItem>
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
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="daily">Once Daily</SelectItem>
                          <SelectItem value="twice_daily">Twice Daily</SelectItem>
                          <SelectItem value="three_times_daily">Three Times Daily</SelectItem>
                          <SelectItem value="four_times_daily">Four Times Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="as_needed">As Needed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <FormLabel>Dose Times</FormLabel>
                  {form.watch("doseTimes").map((_, index) => (
                    <FormField
                      key={index}
                      control={form.control}
                      name={`doseTimes.${index}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input 
                              type="time" 
                              {...field}
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                  <FormDescription>
                    Specify the times you need to take this medication
                  </FormDescription>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormDescription>
                          Leave empty for ongoing medication
                        </FormDescription>
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
                          placeholder="e.g., Take with food, Avoid dairy products, etc."
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
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => navigate(-1)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="flex-1"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      "Update Medication"
                    )}
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

export default EditMedication;
