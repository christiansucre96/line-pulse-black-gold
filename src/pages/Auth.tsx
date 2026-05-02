import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/scanner");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        // 🔐 LOGIN – with profile fetch and admin routing
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // ✅ FETCH PROFILE AFTER LOGIN
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .maybeSingle();

        console.log("PROFILE:", profile);

        if (profileError) {
          console.error(profileError);
        }

        toast.success("Welcome back!");

        // 🔥 route based on role
        if (profile?.is_admin || profile?.role === "admin") {
          navigate("/admin");
        } else {
          navigate("/scanner");
        }

      } else {
        // 🆕 SIGNUP
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
            },
            emailRedirectTo: `${window.location.origin}/reset-password`,
          },
        });

        if (error) throw error;

        // 📧 EMAIL CONFIRMATION CHECK
        if (data.user && !data.session) {
          toast.success("Check your email to confirm your account!");
        } else {
          toast.success("Account created!");
        }

        // 👤 CREATE PROFILE SAFELY – UPDATED UPSERT
        if (data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert({
              id: data.user.id,          // ✅ Use id (matches primary key)
              email: email,              // ✅ Store email in profile
              display_name: displayName,
            });

          if (profileError) {
            console.error("Profile error:", profileError.message);
          }
        }

        // Reset form
        setIsLogin(true);
        setPassword("");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) return toast.error("Enter your email first");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password reset email sent!");
    }
  };

  // ✨ NEW: Send Magic Link (no password required)
  const sendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return toast.error("Enter your email first");

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("✨ Magic link sent! Check your email.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* LOGO */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-gold flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl font-bold">LP</span>
          </div>
          <h1 className="text-3xl font-bold">Line Pulse</h1>
          <p className="text-muted-foreground mt-1">
            {isLogin ? "Sign in to your account" : "Create your account"}
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4 bg-card border border-border rounded-xl p-6">

          {!isLogin && (
            <div>
              <label className="block text-sm mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-secondary border border-border"
                placeholder="Your name"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-secondary border border-border"
              placeholder="••••••••"
              required={isLogin}
            />
          </div>

          {isLogin && (
            <div className="flex flex-wrap justify-between items-center gap-2">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-primary hover:underline"
              >
                Forgot password?
              </button>
              <button
                type="button"
                onClick={sendMagicLink}
                className="text-xs text-yellow-400 hover:underline"
              >
                Send Magic Link
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-gradient-gold text-primary-foreground font-bold text-lg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
          </button>
        </form>

        {/* SWITCH */}
        <p className="text-center text-sm text-muted-foreground mt-4">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Sign Up" : "Sign In"}
          </button>
        </p>

      </div>
    </div>
  );
}
