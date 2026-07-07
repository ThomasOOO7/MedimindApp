import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Send, Loader2, MessageSquare, AlertCircle, Pill, Stethoscope, Heart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: string[];
  relatedQuestions?: string[];
}

interface MedicalChatbotProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const quickSuggestions = [
  { icon: Pill, text: "Tell me about this medicine", category: "medicine" },
  { icon: Stethoscope, text: "What are symptoms of fever?", category: "symptoms" },
  { icon: Heart, text: "What should I do if I miss a dose?", category: "advice" },
  { icon: AlertCircle, text: "First aid for minor burns", category: "emergency" }
];

export const MedicalChatbot = ({ open, onOpenChange }: MedicalChatbotProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const storageKey = `medimind-chat-${user?.id}`;

  // Load chat history from localStorage
  useEffect(() => {
    if (user) {
      const savedHistory = localStorage.getItem(storageKey);
      if (savedHistory) {
        try {
          const parsed = JSON.parse(savedHistory);
          setMessages(parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          })));
        } catch (error) {
          console.error("Error loading chat history:", error);
        }
      }
    }
  }, [user, storageKey]);

  // Save chat history to localStorage
  useEffect(() => {
    if (user && messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, user, storageKey]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Prepare conversation history for context
      const conversationHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const { data, error } = await supabase.functions.invoke('medical-chat', {
        body: {
          message: text.trim(),
          conversationHistory
        }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || "I'm sorry, I couldn't quite put that answer together. Let's try again in a moment, and for anything urgent please contact a healthcare professional right away.",
        timestamp: new Date(),
        citations: data.citations || [],
        relatedQuestions: data.relatedQuestions || []
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message. Please try again.');
      
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm sorry, something went wrong on my side. Please try again in a moment, and if this is about an urgent medical concern, contact a doctor or local emergency services right away.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(storageKey);
    toast.success('Chat history cleared');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] sm:h-[80vh] w-[95vw] sm:w-full flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg sm:text-xl truncate">MediMind Assistant</DialogTitle>
                <CardDescription className="text-xs sm:text-sm truncate">
                  AI-powered medical information
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearHistory}
              className="text-muted-foreground hover:text-foreground text-xs sm:text-sm flex-shrink-0"
            >
              Clear
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col overflow-hidden">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <Stethoscope className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
              </div>
              <div className="text-center space-y-2 px-4">
                <h3 className="text-lg sm:text-xl font-semibold">Welcome to MediMind Assistant</h3>
                <p className="text-sm sm:text-base text-muted-foreground max-w-md">
                  I can help you with information about medicines, symptoms, first aid, and general health guidance.
                </p>
              </div>

              <Card className="w-full max-w-2xl border-warning/20 bg-warning/5">
                <CardContent className="pt-4 sm:pt-6">
                  <div className="flex gap-2 sm:gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-warning flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-xs sm:text-sm">
                      <p className="font-medium text-warning">Important Disclaimer</p>
                      <p className="text-muted-foreground">
                        This chatbot provides general medical information only. It does not diagnose conditions or prescribe treatments. 
                        Always consult a qualified healthcare professional for personalized medical advice.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="w-full max-w-2xl px-2 sm:px-0">
                <p className="text-xs sm:text-sm font-medium mb-3 text-center">Quick Suggestions</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {quickSuggestions.map((suggestion, index) => {
                    const Icon = suggestion.icon;
                    return (
                      <Button
                        key={index}
                        variant="outline"
                        className="h-auto py-2 sm:py-3 px-3 sm:px-4 justify-start text-left"
                        onClick={() => handleQuickSuggestion(suggestion.text)}
                      >
                        <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span className="text-xs sm:text-sm">{suggestion.text}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1 px-3 sm:px-6" ref={scrollRef}>
              <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-xl px-3 sm:px-4 py-2 sm:py-3 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <p className="text-xs sm:text-sm whitespace-pre-wrap break-words break-all">{message.content}</p>

                      <p className="text-xs opacity-50 mt-2">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-xl px-4 py-3">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="border-t p-3 sm:p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(inputMessage);
              }}
              className="flex gap-2"
            >
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask about medicines, symptoms..."
                disabled={isLoading}
                className="flex-1 text-sm"
                maxLength={1000}
              />
              <Button
                type="submit"
                disabled={isLoading || !inputMessage.trim()}
                className="gap-2 flex-shrink-0"
                size="default"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center px-2">
              Always consult a healthcare professional for personalized medical advice
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
