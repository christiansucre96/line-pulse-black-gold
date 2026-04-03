import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleRecovery = async () => {
      const hash = window.location.hash;

      // 🔥 Detect Supabase recovery token
      if (hash.includes("access_token")) {
        const { error } = await supabase.auth.getSession();

        if (error) {
          toast.error("Invalid or expired reset link");
          navigate("/auth");
        }
      } else {
        // If no token → redirect
        navigate("/auth");
      }
    };

    handleRecovery();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated!");
      navigate("/scanner");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleReset} className="bg-card p-6 rounded-xl border border-border w-full max-w-md space-y-4">
        <h2 className="text-xl font-bold text-center">Reset Password</h2>

        <input
          type="password"
          placeholder="Enter new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-4 py-3 rounded bg-secondary border border-border"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-primary text-white rounded"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
