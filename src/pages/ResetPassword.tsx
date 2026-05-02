// src/pages/ResetPassword.tsx
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Shield, Key, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase sends tokens in the hash fragment: #access_token=...&type=recovery
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token") || "";
    const type = params.get("type");

    if (type === "recovery" && accessToken) {
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }).then(({ error: sessionError }) => {
        if (sessionError) {
          setError("Invalid or expired reset link. Please request a new one.");
          toast.error("Reset link expired");
        } else {
          setReady(true);
        }
      });
    } else {
      // Also check if there's already an active session (user clicked link and session was auto-set)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setReady(true);
        } else {
          setError("Invalid URL. Please use the password reset link from your email.");
        }
      });
    }
  }, []);

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

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      toast.error("Failed to update password");
    } else {
      setSuccess(true);
      toast.success("Password updated successfully!");
      setTimeout(() => navigate("/auth"), 3000);
    }

    setLoading(false);
  };

  if (error && !ready) {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060a0f] p-4">
      <div className="bg-[#0b1120] p-6 rounded-xl border border-gray-800 w-full max-w-md space-y-4">
        <div className="flex items-center gap-2 text-yellow-400">
          <Shield className="w-6 h-6" />
          <h2 className="text-xl font-bold">Reset Password</h2>
        </div>

        {!ready && !error && (
          <p className="text-gray-400 text-sm">Verifying reset link...</p>
        )}

        {ready && (
          <form onSubmit={handleReset} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-900/20 border border-red-800 rounded text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-gray-300">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded bg-[#1e293b] border border-gray-700 text-white"
                  required
                  minLength={8}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-gray-500">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-300">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 rounded bg-[#1e293b] border border-gray-700 text-white"
                  required
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-semibold disabled:opacity-50"
            >
              {loading ? (
                <><Key className="w-4 h-4 mr-2 inline animate-pulse" /> Updating...</>
              ) : (
                <><Key className="w-4 h-4 mr-2 inline" /> Update Password</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
