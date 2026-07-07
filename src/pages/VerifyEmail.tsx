import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "";
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleOtpChange = (value: string) => {
    setOtp(value);
  };

  const handleResend = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp-email", {
        body: { email, isResend: true }
      });

      if (error) {
        if (error.message?.includes("Maximum resend limit")) {
          toast.error("Maximum resend limit reached. Please try again after 1 hour.");
        } else {
          throw error;
        }
        return;
      }

      toast.success("New verification code sent!");
      setCountdown(60);
      setCanResend(false);
      setOtp(""); // Clear OTP input
    } catch (error: any) {
      toast.error(error.message || "Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the complete 6-digit code");
      return;
    }

    setIsVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { email, otp }
      });

      if (error) {
        if (error.message?.includes("expired")) {
          toast.error("OTP has expired. Please request a new one.");
        } else if (error.message?.includes("Invalid OTP")) {
          toast.error("Invalid code. Please check and try again.");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Email verified successfully!");
      
      // Get user session to determine navigation
      const { data: sessionData } = await supabase.auth.getSession();
      const userType = sessionData.session?.user?.user_metadata?.user_type;
      
      if (userType === 'guardian') {
        navigate("/guardian-dashboard");
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to verify code");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-8 backdrop-blur-sm bg-card/95 shadow-xl">
        <div className="flex flex-col items-center text-center space-y-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Verify Your Email</h1>
            <p className="text-muted-foreground">
              We've sent a verification code to
            </p>
            <p className="text-foreground font-medium">{email}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <Label className="text-center block mb-4 text-sm font-medium">Enter 6-digit verification code</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={handleOtpChange}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              Code expires in 10 minutes
            </p>
          </div>

          <Button 
            onClick={handleVerify} 
            className="w-full h-12"
            disabled={otp.length !== 6 || isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify Email"
            )}
          </Button>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Didn't receive the code?
            </p>
            <Button
              variant="link"
              onClick={handleResend}
              disabled={!canResend || isResending}
              className="text-primary"
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : canResend ? (
                "Resend code"
              ) : (
                `Resend in ${countdown}s`
              )}
            </Button>
          </div>

          <Button
            variant="link"
            onClick={() => navigate("/signup")}
            className="w-full text-muted-foreground"
          >
            Change email address
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default VerifyEmail;
