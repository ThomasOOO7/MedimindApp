import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract and verify JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { patientId } = await req.json();
    
    // Verify the user has permission to access this patient's data
    if (user.id !== patientId) {
      // Check if user is an authorized guardian
      const { data: linkExists, error: linkError } = await supabase
        .from("guardian_patient_links")
        .select("id")
        .eq("guardian_id", user.id)
        .eq("patient_id", patientId)
        .eq("status", "active")
        .maybeSingle();
      
      if (linkError || !linkExists) {
        return new Response(
          JSON.stringify({ error: "Forbidden: You do not have access to this patient's data" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get patient's adherence data
    const { data: adherenceData } = await supabase.rpc("calculate_adherence_rate", {
      p_patient_id: patientId,
      p_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      p_end_date: new Date().toISOString().split("T")[0],
    });

    // Get recent medication history
    const { data: recentHistory } = await supabase.rpc("get_medication_history", {
      p_patient_id: patientId,
      p_days_back: 30,
    });

    // Get active medications
    const { data: medications } = await supabase
      .from("medications")
      .select("name, dosage, frequency")
      .eq("patient_id", patientId)
      .eq("is_active", true);

    // Build context for AI
    const adherenceRate = adherenceData || 0;
    const medicationList = medications?.map((m) => `${m.name} (${m.dosage}, ${m.frequency})`).join(", ") || "None";
    
    const missedDoses = recentHistory?.filter((h: any) => h.status === "missed").length || 0;
    const takenDoses = recentHistory?.filter((h: any) => h.status === "taken").length || 0;
    const totalDoses = missedDoses + takenDoses;

    const prompt = `You are a healthcare AI assistant analyzing medication adherence data for a patient. Provide 2-3 personalized, actionable insights to help improve medication adherence.

Patient Data:
- Current Medications: ${medicationList}
- 30-Day Adherence Rate: ${adherenceRate}%
- Doses Taken: ${takenDoses}/${totalDoses}
- Missed Doses: ${missedDoses}

Guidelines:
1. Be empathetic and encouraging
2. Provide specific, actionable advice
3. Focus on patterns and improvements
4. Keep insights concise (2-3 sentences each)
5. If adherence is high, acknowledge success and encourage maintenance

Format your response as a JSON array of insight objects with "title" and "description" fields.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a helpful healthcare AI assistant. Always respond with valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Invalid AI response");
    }

    let insights;
    try {
      const parsed = JSON.parse(content);
      // Handle different response formats
      insights = parsed.insights || parsed.recommendations || parsed;
      if (!Array.isArray(insights)) {
        insights = [insights];
      }
    } catch (e) {
      // Fallback insights
      insights = [
        {
          title: "Keep Up the Good Work",
          description: `Your current adherence rate is ${adherenceRate}%. ${
            adherenceRate >= 80
              ? "This is excellent! Consistent medication adherence is key to managing your health effectively."
              : "There's room for improvement. Consider setting reminders to help you stay on track."
          }`,
        },
      ];
    }

    return new Response(
      JSON.stringify({ insights, adherenceRate, totalDoses, missedDoses }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Unable to generate health insights at this time. Please try again later.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
