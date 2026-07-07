import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Activity, Bell, Users, Shield } from "lucide-react";

const onboardingSlides = [
  {
    icon: Activity,
    title: "Never Miss a Dose",
    description: "Smart medication reminders keep you on track with customizable notifications and easy confirmation."
  },
  {
    icon: Bell,
    title: "Real-Time Monitoring",
    description: "Connect with guardians who can monitor your medication adherence and receive instant alerts."
  },
  {
    icon: Users,
    title: "Family Connection",
    description: "Link with family members or caretakers for peace of mind and better health outcomes."
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "Your health data is encrypted and secure. Control who sees what with granular privacy settings."
  }
];

const Welcome = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  const nextSlide = () => {
    if (currentSlide < onboardingSlides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      navigate("/signup");
    }
  };

  const skip = () => {
    navigate("/signup");
  };

  const CurrentIcon = onboardingSlides[currentSlide].icon;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary mb-2">MediMind</h1>
          <p className="text-muted-foreground">Your medication management companion</p>
        </div>

        <Card className="p-8 backdrop-blur-sm bg-card/95 shadow-xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <CurrentIcon className="w-12 h-12 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">
                {onboardingSlides[currentSlide].title}
              </h2>
              <p className="text-muted-foreground text-lg">
                {onboardingSlides[currentSlide].description}
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              {onboardingSlides.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentSlide 
                      ? "w-8 bg-primary" 
                      : "w-2 bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button
            variant="ghost"
            onClick={skip}
            className="flex-1 h-12 text-base"
          >
            Skip
          </Button>
          <Button
            onClick={nextSlide}
            className="flex-1 h-12 text-base"
          >
            {currentSlide < onboardingSlides.length - 1 ? "Next" : "Get Started"}
          </Button>
        </div>

        <div className="text-center mt-6">
          <Button
            variant="link"
            onClick={() => navigate("/login")}
            className="text-muted-foreground"
          >
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
