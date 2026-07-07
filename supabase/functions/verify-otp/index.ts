import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyOTPRequest {
  email: string;
  otp: string;
}

// Hash OTP using Web Crypto API
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, otp }: VerifyOTPRequest = await req.json();

    if (!email || !otp) {
      throw new Error("Email and OTP are required");
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP format. Please enter 6 digits." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const otpHash = await hashOTP(otp);

    // Get the latest non-verified OTP for this email
    const { data: otpRecords, error: fetchError } = await supabase
      .from("otp_verifications")
      .select("*")
      .eq("email", email)
      .eq("verified", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error("Database fetch error:", fetchError);
      throw new Error("Failed to verify OTP");
    }

    if (!otpRecords || otpRecords.length === 0) {
      return new Response(
        JSON.stringify({ error: "No OTP found for this email. Please request a new one." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const otpRecord = otpRecords[0];

    // Check if OTP is expired
    if (new Date(otpRecord.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "OTP has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify OTP hash
    if (otpRecord.otp_hash !== otpHash) {
      return new Response(
        JSON.stringify({ error: "Invalid OTP. Please check and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark OTP as verified
    const { error: updateError } = await supabase
      .from("otp_verifications")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    if (updateError) {
      console.error("Database update error:", updateError);
      throw new Error("Failed to mark OTP as verified");
    }

    // Get user by email and update email_confirmed_at
    const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
    
    if (userError) {
      console.error("Error fetching users:", userError);
    } else {
      const user = userData.users.find(u => u.email === email);
      if (user && !user.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true
        });
      }
    }

    console.log("OTP verified successfully for:", email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email verified successfully!" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in verify-otp function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to verify OTP" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);