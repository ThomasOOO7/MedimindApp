import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, User, Heart } from "lucide-react";

const signupSchema = z.object({
  userType: z.enum(["patient", "guardian"]),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  phone: z.string().max(20).optional(),
  dateOfBirth: z.string().optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  acceptTerms: z.boolean().refine(val => val === true, "You must accept the terms")
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

type SignupForm = z.infer<typeof signupSchema>;

const Signup = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"patient" | "guardian" | null>(null);

  const form = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      userType: "patient",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      dateOfBirth: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false
    }
  });

  const onSubmit = async (data: SignupForm) => {
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/${data.userType === 'patient' ? 'dashboard' : 'guardian-dashboard'}`;
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            user_type: data.userType,
            first_name: data.firstName,
            last_name: data.lastName,
            phone: data.phone,
            date_of_birth: data.dateOfBirth
          }
        }
      });

      if (error) throw error;

      // Send OTP email
      try {
        const { error: otpError } = await supabase.functions.invoke("send-otp-email", {
          body: { email: data.email, isResend: false }
        });

        if (otpError) {
          console.error("Failed to send OTP:", otpError);
          toast.error("Account created but failed to send verification email. Please contact support.");
        }
      } catch (otpError) {
        console.error("OTP send error:", otpError);
      }

      // Check if email confirmation is required
      if (authData.user && !authData.session) {
        toast.success("Account created! Please check your email for verification code and link.");
        navigate("/verify-email", { state: { email: data.email, userType: data.userType } });
      } else if (authData.session) {
        // Auto-confirmed, navigate directly
        toast.success("Account created successfully!");
        navigate(data.userType === 'patient' ? '/dashboard' : '/guardian-dashboard');
      }
    } catch (error: any) {
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please sign in instead.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const passwordStrength = () => {
    const password = form.watch("password");
    if (!password) return 0;
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 25;
    return strength;
  };

  const strength = passwordStrength();

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
        <Card className="w-full max-w-2xl p-8 backdrop-blur-sm bg-card/95 shadow-2xl rounded-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-3">
              Welcome to MediMind
            </h1>
            <p className="text-muted-foreground text-lg">Choose how you'd like to join</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button
              onClick={() => {
                setSelectedRole("patient");
                form.setValue("userType", "patient");
              }}
              className="group relative overflow-hidden rounded-2xl p-8 border-2 border-border hover:border-primary transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <User className="w-10 h-10 text-primary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground">I'm a Patient</h3>
                <p className="text-muted-foreground text-center text-sm">
                  Manage your medications, track doses, and stay on schedule
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                setSelectedRole("guardian");
                form.setValue("userType", "guardian");
              }}
              className="group relative overflow-hidden rounded-2xl p-8 border-2 border-border hover:border-secondary transition-all duration-300 hover:shadow-xl hover:shadow-secondary/20 bg-gradient-to-br from-secondary/5 to-transparent"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary to-secondary/60 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <Heart className="w-10 h-10 text-secondary-foreground" />
                </div>
                <h3 className="text-2xl font-semibold text-foreground">I'm a Guardian</h3>
                <p className="text-muted-foreground text-center text-sm">
                  Monitor loved ones, receive alerts, and support their health journey
                </p>
              </div>
            </button>
          </div>

          <div className="text-center mt-8">
            <Button
              variant="link"
              onClick={() => navigate("/login")}
              className="text-muted-foreground hover:text-foreground"
            >
              Already have an account? Sign in
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md p-8 backdrop-blur-sm bg-card/95 shadow-2xl rounded-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary mb-4 shadow-lg">
            {selectedRole === "patient" ? (
              <User className="w-8 h-8 text-white" />
            ) : (
              <Heart className="w-8 h-8 text-white" />
            )}
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent mb-2">
            Sign Up as {selectedRole === "patient" ? "Patient" : "Guardian"}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRole(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            Change role
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Thomas" {...field} className="rounded-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Shelby" {...field} className="rounded-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="thomas123@gmail.com" {...field} className="rounded-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone (Optional)</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+91-00000-00000" {...field} className="rounded-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth (Optional)</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} className="rounded-lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        className="rounded-lg pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  {field.value && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[25, 50, 75, 100].map((threshold) => (
                          <div
                            key={threshold}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                              strength >= threshold 
                                ? "bg-gradient-to-r from-primary to-secondary" 
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {strength < 50 ? "Weak" : strength < 75 ? "Medium" : "Strong"} password
                      </p>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        className="rounded-lg pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="acceptTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-normal">
                      I accept the Terms of Service and Privacy Policy
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 rounded-lg bg-gradient-to-r from-primary to-secondary hover:shadow-lg hover:shadow-primary/30 transition-all duration-300" 
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </Form>

        <div className="text-center mt-6">
          <Button
            variant="link"
            onClick={() => navigate("/login")}
            className="text-muted-foreground hover:text-foreground"
          >
            Already have an account? Sign in
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Signup;
