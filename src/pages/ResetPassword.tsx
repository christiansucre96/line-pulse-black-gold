import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Shield, Key, CheckCircle, AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleRecovery = async () => {
      // Check for recovery token in URL
      const type = searchParams.get("type");
      const accessToken = searchParams.get("access_token");
      
      if (type === "recovery" && accessToken) {
        // Set session from the URL token
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: "",
        });
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          setError("Invalid or expired reset link");
          toast.error("Reset link expired. Request a new one.");
        }
      } else if (type === "recovery" && !accessToken) {
        // Try to get session from hash (fallback)
        const hash = window.location.hash;
        if (hash.includes("access_token")) {
          const { error: hashError } = await supabase.auth.getSession();
          if (hashError) {
            setError("Invalid reset link");
          }
        } else {
          setError("No reset token found. Please request a new password reset.");
        }
      } else {
        setError("Invalid URL. Please use the link from your email.");
      }
    };

    handleRecovery();
  }, [searchParams]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      console.error("Update error:", error);
      setError(error.message);
      toast.error("Failed to update password");
    } else {
      setSuccess(true);
      toast.success("Password updated successfully!");
      
      // Redirect after 3 seconds
      setTimeout(() => {
        navigate("/auth"); // or "/login" depending on your route
      }, 3000);
    }

    setLoading(false);
  };

  // Show error state
  if (error && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f] p-4">
        <div className="bg-[#0b1120] p-6 rounded-xl border border-red-800 w-full max-w-md space-y-4">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Invalid Reset Link</h2>
          </div>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={() => navigate("/auth")}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-semibold"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#060a0f] p-4">
        <div className="bg-[#0b1120] p-6 rounded-xl border border-green-800 w-full max-w-md space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">Password Updated!</h2>
          </div>
          <p className="text-gray-400 text-sm">
            Your password has been successfully changed. Redirecting to login...
          </p>
          <button
            onClick={() => navigate("/auth")}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-semibold"
          >
            Go to Login Now
          </button>
        </div>
      </div>
    );
  }

  // Show reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a0f] p-4">
      <div className="bg-[#0b1120] p-6 rounded-xl border border-gray-800 w-full max-w-md space-y-4">
        <div className="flex items-center gap-2 text-yellow-400">
          <Shield className="w-6 h-6" />
          <h2 className="text-xl font-bold">Reset Password</h2>
        </div>

        <form onSubmit={handleReset} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm text-gray-300">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded bg-[#1e293b] border border-gray-700 text-white"
              required
              minLength={8}
            />
            <p className="text-xs text-gray-500">Must be at least 8 characters</p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-gray-300">Confirm Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded bg-[#1e293b] border border-gray-700 text-white"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-semibold disabled:opacity-50"
          >
            {loading ? (
              <>
                <Key className="w-4 h-4 mr-2 inline animate-pulse" /> Updating...
              </>
            ) : (
              <>
                <Key className="w-4 h-4 mr-2 inline" /> Update Password
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
