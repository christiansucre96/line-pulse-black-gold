import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [ready, setReady] = useState(false);

  // 🔥 IMPORTANT: HANDLE RESET TOKEN
  useEffect(() => {
    const handleSession = async () => {
      const hash = window.location.hash;

      if (hash) {
        const params = new URLSearchParams(hash.replace("#", ""));
        const access_token = params.get("access_token");

        if (access_token) {
          await supabase.auth.setSession({
            access_token,
            refresh_token: access_token,
          });
          setReady(true);
        }
      }
    };

    handleSession();
  }, []);

  const handleReset = async () => {
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      alert("Error: " + error.message);
    } else {
      alert("Password updated!");
      window.location.href = "/auth";
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading reset session...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card p-6 rounded-xl border border-border w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-center">Reset Password</h2>

        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-3 py-2 border border-border rounded bg-input"
        />

        <button
          onClick={handleReset}
          className="w-full bg-primary text-white py-2 rounded"
        >
          Update Password
        </button>
      </div>
    </div>
  );
}
