
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'none',
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  is_lifetime boolean NOT NULL DEFAULT false,
  granted_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage subscriptions" ON public.user_subscriptions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
