import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("Starting refill reminders check");

    // Get medications that need refill reminders (ending within 3 days)
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const { data: medications, error: medError } = await supabase
      .from("medications")
      .select("id, name, patient_id, end_date, dosage, unit")
      .eq("is_active", true)
      .not("end_date", "is", null)
      .lte("end_date", threeDaysFromNow.toISOString().split('T')[0])
      .gte("end_date", new Date().toISOString().split('T')[0]);

    if (medError) {
      console.error("Error fetching medications:", medError);
      throw medError;
    }

    let notificationCount = 0;

    // Create refill reminder notifications
    for (const med of medications || []) {
      const daysUntilEnd = Math.ceil(
        (new Date(med.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      // Check if notification already sent today
      const { data: existingNotif } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", med.patient_id)
        .eq("type", "refill_reminder")
        .eq("metadata->>medication_id", med.id)
        .gte("created_at", new Date().toISOString().split('T')[0])
        .single();

      if (existingNotif) {
        console.log(`Refill reminder already sent today for medication ${med.id}`);
        continue;
      }

      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: med.patient_id,
          title: "Refill Reminder",
          message: `Your medication "${med.name}" (${med.dosage} ${med.unit}) is running out in ${daysUntilEnd} day(s). Time to refill!`,
          type: "refill_reminder",
          metadata: {
            medication_id: med.id,
            days_remaining: daysUntilEnd,
          },
        });

      if (notifError) {
        console.error(`Error creating refill reminder for ${med.id}:`, notifError);
      } else {
        notificationCount++;
        console.log(`Refill reminder sent for medication ${med.id}`);
      }
    }

    console.log(`Refill reminders check complete: ${notificationCount} notifications sent`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${notificationCount} refill reminders`,
        medicationsChecked: medications?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-refill-reminders:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
