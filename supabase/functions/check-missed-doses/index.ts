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

    // Get all active patients
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_type", "patient");

    if (profilesError) throw profilesError;

    let totalChecked = 0;
    let totalMissed = 0;

    // Check each patient's schedule
    for (const profile of profiles || []) {
      const { data: schedule, error: scheduleError } = await supabase.rpc(
        "get_todays_schedule",
        { p_patient_id: profile.id }
      );

      if (scheduleError) {
        console.error(`Error fetching schedule for patient ${profile.id}:`, scheduleError);
        continue;
      }

      totalChecked++;

      const now = new Date();
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM

      for (const med of schedule || []) {
        // If medication time has passed and not taken
        if (med.scheduled_time < currentTime && med.status !== "taken") {
          // Check if already logged
          const { data: existingLog } = await supabase
            .from("medication_logs")
            .select("id")
            .eq("medication_id", med.medication_id)
            .eq("patient_id", profile.id)
            .gte("scheduled_time", new Date().toISOString().split("T")[0])
            .maybeSingle();

          if (!existingLog) {
            const scheduledDateTime = new Date();
            const [hours, minutes] = med.scheduled_time.split(":");
            scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

            // Log as missed - this will trigger the notification to guardians
            const { error: insertError } = await supabase
              .from("medication_logs")
              .insert({
                medication_id: med.medication_id,
                patient_id: profile.id,
                scheduled_time: scheduledDateTime.toISOString(),
                status: "missed",
                actual_time: null,
              });

            if (insertError) {
              console.error("Error inserting missed log:", insertError);
            } else {
              totalMissed++;
              console.log(`Logged missed dose for patient ${profile.id}, medication ${med.medication_name}`);
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Checked ${totalChecked} patients, found ${totalMissed} missed doses`,
        totalChecked,
        totalMissed,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in check-missed-doses:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
