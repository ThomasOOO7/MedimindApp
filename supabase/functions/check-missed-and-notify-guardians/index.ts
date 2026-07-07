import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        },
      }
    );

    console.log('Starting missed dose check and guardian notifications');

    // Helper function to format time to 12-hour format with AM/PM
    const formatTo12Hour = (timeStr: string): string => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
    };

    // Convert UTC to IST (UTC+5:30)
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const istNow = new Date(now.getTime() + istOffset);
    
    // Get current time in HH:MM format (IST)
    const currentHours = istNow.getUTCHours();
    const currentMinutes = istNow.getUTCMinutes();
    const currentTime = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}`;
    
    // Check for doses that are EXACTLY 5 minutes overdue
    const fiveMinutesAgo = new Date(istNow.getTime() - 5 * 60 * 1000);
    const fiveMinHours = fiveMinutesAgo.getUTCHours();
    const fiveMinMinutes = fiveMinutesAgo.getUTCMinutes();
    const fiveMinutesAgoTime = `${String(fiveMinHours).padStart(2, '0')}:${String(fiveMinMinutes).padStart(2, '0')}`;

    console.log(`Current IST time: ${currentTime}, Checking for doses at exactly: ${fiveMinutesAgoTime}`);

    // Get all active patients with their medications
    const { data: patients, error: patientsError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_type', 'patient');

    if (patientsError) {
      console.error('Error fetching patients:', patientsError);
      throw patientsError;
    }

    let missedDosesLogged = 0;
    let guardiansNotified = 0;

    for (const patient of patients) {
      // Get today's schedule for this patient
      const { data: schedule, error: scheduleError } = await supabase.rpc(
        'get_todays_schedule',
        { p_patient_id: patient.id }
      );

      if (scheduleError) {
        console.error(`Error getting schedule for patient ${patient.id}:`, scheduleError);
        continue;
      }

      if (!schedule || schedule.length === 0) continue;

      for (const med of schedule) {
        const scheduledTime = med.scheduled_time; // This is HH:MM:SS format
        const scheduledTimeShort = scheduledTime.substring(0, 5); // Convert HH:MM:SS to HH:MM

        // Check if medication is exactly 5 minutes overdue
        if (scheduledTimeShort === fiveMinutesAgoTime) {
          // Build scheduled datetime in IST then convert to UTC for storage
          const scheduledDateTimeIST = new Date(istNow);
          const [hours, minutes] = scheduledTime.split(':');
          scheduledDateTimeIST.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          // Convert IST back to UTC for database storage
          const scheduledDateTime = new Date(scheduledDateTimeIST.getTime() - istOffset);

          // Check if this dose has already been logged as TAKEN within a safe window
          const windowStart = new Date(scheduledDateTime.getTime() - 10 * 60 * 1000);
          const windowEnd = new Date(scheduledDateTime.getTime() + 10 * 60 * 1000);

          const { data: takenLogs, error: takenLogsError } = await supabase
            .from('medication_logs')
            .select('id, status, scheduled_time')
            .eq('medication_id', med.medication_id)
            .eq('patient_id', patient.id)
            .eq('status', 'taken')
            .gte('scheduled_time', windowStart.toISOString())
            .lte('scheduled_time', windowEnd.toISOString());

          if (takenLogsError) {
            console.error('Error checking taken logs:', takenLogsError);
            continue;
          }

          // If any TAKEN log exists in this time window, skip marking as missed
          if (takenLogs && takenLogs.length > 0) {
            console.log(`Dose already taken for ${med.medication_name}, skipping missed check`);
            continue;
          }

          // Check if a MISSED log already exists for this exact scheduled_time
          const { data: existingLog, error: logCheckError } = await supabase
            .from('medication_logs')
            .select('id, status')
            .eq('medication_id', med.medication_id)
            .eq('patient_id', patient.id)
            .eq('scheduled_time', scheduledDateTime.toISOString())
            .eq('status', 'missed')
            .maybeSingle();

          if (logCheckError) {
            console.error('Error checking existing log:', logCheckError);
            continue;
          }

          // Only proceed if no MISSED log exists yet
          if (!existingLog) {
              const { error: insertError } = await supabase
                .from('medication_logs')
                .insert({
                  medication_id: med.medication_id,
                  patient_id: patient.id,
                  scheduled_time: scheduledDateTime.toISOString(),
                  status: 'missed',
                  actual_time: null,
                });

              if (insertError) {
                console.error('Error logging missed dose:', insertError);
                continue;
              } else {
                missedDosesLogged++;
                console.log(`✓ Logged missed dose for ${med.medication_name} at ${scheduledTime}`);
              }
            }

            // Check if patient was already notified about this specific dose (within last 30 seconds to prevent duplicates)
            const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);
            
            const { data: existingPatientNotif } = await supabase
              .from('notifications')
              .select('id')
              .eq('user_id', patient.id)
              .eq('type', 'missed_dose')
              .eq('metadata->>medication_id', med.medication_id)
              .eq('metadata->>scheduled_time', scheduledTime)
              .gte('created_at', thirtySecondsAgo.toISOString())
              .maybeSingle();

            // Send patient notification about missed dose only if not already sent
            if (!existingPatientNotif) {
              const formattedTime = formatTo12Hour(scheduledTimeShort);
              const { error: patientNotifError } = await supabase
                .from('notifications')
                .insert({
                  user_id: patient.id,
                  title: '⚠️ Medication Missed',
                  message: `You missed your ${med.medication_name} dose scheduled for ${formattedTime}. Please take it as soon as possible.`,
                  type: 'missed_dose',
                  metadata: {
                    medication_id: med.medication_id,
                    scheduled_time: scheduledTime,
                    missed_at: istNow.toISOString() // Use IST time
                  }
                });

              if (patientNotifError) {
                console.error('Error sending patient notification:', patientNotifError);
              } else {
                console.log(`✓ Notified patient about missed dose: ${med.medication_name}`);
              }
            } else {
              console.log(`Patient already notified about this missed dose`);
            }

            // Get active guardians for this patient
            const { data: guardians, error: guardiansError } = await supabase
              .from('guardian_patient_links')
              .select('guardian_id')
              .eq('patient_id', patient.id)
              .eq('status', 'active');

            if (guardiansError) {
              console.error('Error fetching guardians:', guardiansError);
              continue;
            }

            // Get patient name for notifications
            const { data: patientProfile } = await supabase
              .from('profiles')
              .select('first_name, last_name')
              .eq('id', patient.id)
              .single();

            const patientName = patientProfile
              ? `${patientProfile.first_name} ${patientProfile.last_name}`
              : 'Patient';

            // Send notifications to guardians
            for (const guardian of guardians || []) {
              // Check if guardian was already notified about this specific dose (within last 30 seconds to prevent duplicates)
              const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

              const { data: existingNotif, error: notifCheckError } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', guardian.guardian_id)
                .eq('type', 'missed_dose')
                .eq('metadata->>patient_id', patient.id)
                .eq('metadata->>medication_id', med.medication_id)
                .eq('metadata->>scheduled_time', scheduledTime)
                .gte('created_at', thirtySecondsAgo.toISOString())
                .maybeSingle();

              if (notifCheckError) {
                console.error('Error checking existing guardian notification:', notifCheckError);
                continue;
              }

              if (!existingNotif) {
                const formattedTime = formatTo12Hour(scheduledTimeShort);
                const { error: notifError } = await supabase
                  .from('notifications')
                  .insert({
                    user_id: guardian.guardian_id,
                    title: '⚠️ Missed Dose Alert',
                    message: `${patientName} missed ${med.medication_name} (${med.dosage} ${med.unit}) scheduled for ${formattedTime}`,
                    type: 'missed_dose',
                    metadata: {
                      patient_id: patient.id,
                      medication_id: med.medication_id,
                      medication_name: med.medication_name,
                      scheduled_time: scheduledTime,
                      missed_at: istNow.toISOString() // Use IST time
                    }
                  });

                if (notifError) {
                  console.error('Error creating guardian notification:', notifError);
                } else {
                  guardiansNotified++;
                  console.log(`✓ Notified guardian about ${patientName} missing ${med.medication_name}`);
                }
              } else {
                console.log(`Guardian already notified about this missed dose`);
              }
            }
          }
        }
      }

    console.log(`Check complete: ${missedDosesLogged} missed doses logged, ${guardiansNotified} guardians notified`);

    return new Response(
      JSON.stringify({
        success: true,
        missedDosesLogged,
        guardiansNotified,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in check-missed-and-notify-guardians:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
