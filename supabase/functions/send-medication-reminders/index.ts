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
    const now = new Date();
    console.log("Starting medication reminder check at", now.toISOString());
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Convert UTC to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istNow = new Date(now.getTime() + istOffset);
    
    // Get current time in HH:MM format (IST) for comparison
    const currentHours = istNow.getUTCHours();
    const currentMinutes = istNow.getUTCMinutes();
    const currentTimeStr = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}:00`;
    
    // Also check for medications from previous minute (to catch any that were missed)
    const oneMinuteAgo = new Date(istNow.getTime() - 60 * 1000);
    const prevHours = oneMinuteAgo.getUTCHours();
    const prevMinutes = oneMinuteAgo.getUTCMinutes();
    const prevTimeStr = `${String(prevHours).padStart(2, '0')}:${String(prevMinutes).padStart(2, '0')}:00`;
    
    console.log(`Current IST time: ${currentTimeStr}, Previous minute: ${prevTimeStr}`);

    // Get active medications
    const { data: medications, error: medsError } = await supabase
      .from('medications')
      .select('id, patient_id, name, dosage, unit, time, dose_times, end_date, start_date')
      .eq('is_active', true);

    if (medsError) {
      console.error('Error fetching medications:', medsError);
      throw medsError;
    }

    console.log(`Found ${medications?.length || 0} active medications`);

    let notificationsSent = 0;

    for (const med of medications || []) {
      // Skip expired medications
      if (med.end_date) {
        const endDate = new Date(med.end_date + 'T00:00:00Z');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (endDate < today) {
          console.log(`Skipping expired medication: ${med.name}`);
          continue;
        }
      }

      // Skip future medications
      if (med.start_date) {
        const startDate = new Date(med.start_date + 'T00:00:00Z');
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        if (startDate > today) {
          console.log(`Skipping future medication: ${med.name}`);
          continue;
        }
      }

      // Check if any dose time matches current time OR previous minute
      const doseTimes = med.dose_times && med.dose_times.length > 0 ? med.dose_times : [med.time];
      
      for (const doseTime of doseTimes) {
        // Compare just HH:MM (ignore seconds)
        const scheduledTime = doseTime.substring(0, 5);
        const currentTime = currentTimeStr.substring(0, 5);
        const prevTime = prevTimeStr.substring(0, 5);
        
        if (scheduledTime === currentTime || scheduledTime === prevTime) {
          // Check if notification was already sent in the last 2 minutes
          const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
          
          const { data: recentNotif, error: notifCheckError } = await supabase
            .from('notifications')
            .select('id')
            .eq('user_id', med.patient_id)
            .eq('type', 'medication_reminder')
            .eq('metadata->>medication_id', med.id)
            .eq('metadata->>scheduled_time', doseTime)
            .gte('created_at', twoMinutesAgo.toISOString())
            .maybeSingle();

          if (notifCheckError) {
            console.error('Error checking recent notifications:', notifCheckError);
            continue;
          }

          if (!recentNotif) {
            // Create notification with proper timestamp
            const { error: insertError } = await supabase
              .from('notifications')
              .insert({
                user_id: med.patient_id,
                title: '💊 Time to Take Your Medication',
                message: `It's time to take ${med.name} (${med.dosage} ${med.unit})`,
                type: 'medication_reminder',
                metadata: {
                  medication_id: med.id,
                  scheduled_time: doseTime,
                  reminder_sent_at: now.toISOString()
                }
              });

            if (insertError) {
              console.error('Error creating notification:', insertError);
            } else {
              notificationsSent++;
              console.log(`✓ Sent reminder for ${med.name} at ${doseTime}`);
            }
          } else {
            console.log(`Skipping ${med.name} - notification already sent recently`);
          }
        }
      }
    }

    const responseData = {
      success: true,
      message: `Processed ${medications?.length || 0} medications, sent ${notificationsSent} reminders`,
      notificationsSent,
    };
    
    console.log("Reminder check complete:", responseData);
    
    return new Response(
      JSON.stringify(responseData),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-medication-reminders:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
