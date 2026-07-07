import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid message format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Input validation and sanitization
    const sanitizedMessage = message.trim().slice(0, 1000);
    
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    // System prompt with medical safety guidelines
    const systemPrompt = `You are MediMind Assistant, a warm, friendly medical companion. Your role is to have natural conversations about health while providing accurate, evidence-based information.

CONVERSATIONAL STYLE:
- When greeted (hello, hi, hey, good morning, etc.), greet back warmly and ask how you can help
- Be conversational and human-like, not robotic
- Answer questions simply and directly without unnecessary formality
- Don't cite sources or provide references unless specifically asked
- Keep responses concise and easy to understand
- Use a friendly, caring tone like talking to a friend

CAPABILITIES:
- Provide information about medicines (uses, interactions, side effects, precautions)
- Explain symptoms and common diseases in simple, everyday language
- Offer first aid and general health guidance
- Give basic triage-style suggestions (when to seek care urgently vs. monitor at home)
- Identify potential emergency situations

SAFETY GUIDELINES (CRITICAL):
- NEVER provide specific diagnoses
- NEVER prescribe exact dosages or create treatment plans
- ALWAYS recommend consulting a healthcare professional for serious or ongoing issues
- If unsure, kindly admit uncertainty and recommend professional consultation
- For emergencies, calmly but clearly advise calling local emergency services
- For serious medical concerns, gently remind: "Please consult a healthcare professional for personalized advice."

RESPONSE APPROACH:
- Greetings → Greet back warmly and offer help
- Simple questions → Simple, direct answers without citations
- Medical questions → Clear explanations in everyday language
- Emergency situations → Calm, clear guidance to seek immediate help

Remember: You're a supportive companion providing information, not medical advice. Keep it friendly and conversational!`;

    // Build messages array with conversation history
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(conversationHistory || []).slice(-10), // Keep last 10 messages for context
      { role: 'user', content: sanitizedMessage }
    ];

    console.log('Sending request to Perplexity API...');

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: messages,
        temperature: 0.3,
        top_p: 0.9,
        max_tokens: 500,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        frequency_penalty: 1,
        presence_penalty: 0
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('Perplexity API response received');

    const assistantMessage = data.choices?.[0]?.message?.content;
    const citations = data.citations || [];
    const relatedQuestions = data.related_questions || [];

    if (!assistantMessage) {
      throw new Error('No response from Perplexity API');
    }

    // Log query (anonymized) for analysis
    console.log('Medical query processed:', {
      timestamp: new Date().toISOString(),
      queryLength: sanitizedMessage.length,
      responseLength: assistantMessage.length,
      hasCitations: citations.length > 0
    });

    return new Response(
      JSON.stringify({
        message: assistantMessage,
        citations: citations,
        relatedQuestions: relatedQuestions.slice(0, 3)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in medical-chat function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        message: 'I apologize, but I encountered an error processing your request. Please try again or consult a healthcare professional directly.'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
