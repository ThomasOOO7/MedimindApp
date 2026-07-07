-- Create OTP verification table
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  resend_count INTEGER DEFAULT 0,
  last_resend_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create index for faster email lookups
CREATE INDEX idx_otp_email ON public.otp_verifications(email);
CREATE INDEX idx_otp_expires_at ON public.otp_verifications(expires_at);

-- RLS policies (restrictive - only edge functions can access)
CREATE POLICY "Service role can manage OTPs"
  ON public.otp_verifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_verifications
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Create trigger to cleanup on insert (housekeeping)
CREATE OR REPLACE FUNCTION public.trigger_cleanup_expired_otps()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM cleanup_expired_otps();
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_otps_trigger
  AFTER INSERT ON public.otp_verifications
  EXECUTE FUNCTION trigger_cleanup_expired_otps();