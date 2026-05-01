-- Add subscription fields to profiles (if not exists)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS revenue_generated DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS trial_granted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS trial_reason TEXT;

-- Create subscriptions table for tracking
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL, -- '7day', '1month', '3month', '1year'
  amount DECIMAL(10,2) DEFAULT 0, -- 0 for free trials
  currency TEXT DEFAULT 'USDT',
  status TEXT DEFAULT 'active',
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ,
  is_free_trial BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES auth.users(id),
  trial_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Revenue tracking (for paid users, separate flow)
CREATE TABLE IF NOT EXISTS revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'subscription', 'tip', 'one_time'
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USDT',
  description TEXT,
  is_free_trial BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_subscription ON profiles(subscription_tier, is_active, subscription_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial ON subscriptions(is_free_trial, end_date);
CREATE INDEX IF NOT EXISTS idx_revenue_events ON revenue_events(user_id, created_at);

-- Function: Check if subscription is active
CREATE OR REPLACE FUNCTION is_subscription_active(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
      AND is_active = true 
      AND (subscription_end IS NULL OR subscription_end > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
