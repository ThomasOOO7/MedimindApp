import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendOTPRequest {
  email: string;
  isResend?: boolean;
}

// Generate 6-digit OTP
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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
    const { email, isResend = false }: SendOTPRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check rate limiting for resends
    if (isResend) {
      const { data: existingOTPs } = await supabase
        .from("otp_verifications")
        .select("*")
        .eq("email", email)
        .gte("last_resend_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });

      if (existingOTPs && existingOTPs.length >= 3) {
        return new Response(
          JSON.stringify({ error: "Maximum resend limit reached. Please try again after 1 hour." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashOTP(otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in database
    const { error: dbError } = await supabase
      .from("otp_verifications")
      .insert({
        email,
        otp_hash: otpHash,
        expires_at: expiresAt.toISOString(),
        last_resend_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error("Database error:", dbError);
      throw new Error("Failed to store OTP");
    }

    // Get verification link
    const appUrl = Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovableproject.com') || 
                   `${supabaseUrl}`;
    const verificationLink = `${appUrl}/verify-email?email=${encodeURIComponent(email)}`;

    // Send email with OTP and verification link
    const emailResponse = await resend.emails.send({
      from: "MediMind <onboarding@resend.dev>",
      to: [email],
      subject: "Verify Your MediMind Account",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .otp-box { background: #f3f4f6; border: 2px dashed #2563eb; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
              .otp-code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2563eb; }
              .button { display: inline-block; background: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
              .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏥 Welcome to MediMind!</h1>
              </div>
              <div class="content">
                <h2>Verify Your Account</h2>
                <p>Thank you for registering with MediMind. Please verify your email address to get started.</p>
                
                <div class="otp-box">
                  <p style="margin: 0; font-size: 14px; color: #6b7280;">Your verification code:</p>
                  <div class="otp-code">${otp}</div>
                  <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280;">Valid for 10 minutes</p>
                </div>

                <p><strong>Option 1:</strong> Enter the 6-digit code above in the verification screen.</p>
                <p><strong>Option 2:</strong> Click the button below to verify instantly.</p>

                <center>
                  <a href="${verificationLink}" class="button">Verify Email Address</a>
                </center>

                <div class="warning">
                  ⚠️ <strong>Security Notice:</strong> This code expires in 10 minutes. Never share this code with anyone.
                </div>

                <p style="color: #6b7280; font-size: 14px;">If you didn't create a MediMind account, please ignore this email.</p>
              </div>
              <div class="footer">
                <p>© 2025 MediMind. All rights reserved.</p>
                <p>Medication management made simple and secure.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP sent successfully",
        expiresAt: expiresAt.toISOString() 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-otp-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send OTP" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);