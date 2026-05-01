// src/pages/ForgotPassword.tsx
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Mail, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    setLoading(true);
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // Must match Supabase config
      });
      
      if (error) throw error;
      
      setSent(true);
      toast.success("Reset link sent! Check your email.");
      
    } catch (err: any) {
      console.error("Reset request error:", err);
      toast.error(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f] p-4">
        <Card className="w-full max-w-md bg-[#0b1120] border-green-800">
          <CardHeader>
            <CardTitle className="text-green-400 flex items-center gap-2">
              <Mail className="w-5 h-5" /> Check Your Email
            </CardTitle>
            <CardDescription>
              We've sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-gray-400">
              • Check your spam folder if you don't see it<br />
              • The link expires in 1 hour<br />
              • Click the link to set a new password
            </div>
            <Button 
              onClick={() => navigate("/login")} 
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black"
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a0f] p-4">
      <Card className="w-full max-w-md bg-[#0b1120] border-gray-800">
        <CardHeader>
          <CardTitle className="text-yellow-400 flex items-center gap-2">
            <Shield className="w-5 h-5" /> Forgot Password?
          </CardTitle>
          <CardDescription>
            Enter your email and we'll send you a reset link.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetRequest} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#1e293b] border-gray-700 text-white"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              disabled={loading || !email}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Button 
              variant="link" 
              onClick={() => navigate("/login")}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
