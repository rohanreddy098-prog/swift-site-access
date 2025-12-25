-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create proxy_requests table for analytics
CREATE TABLE public.proxy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_url TEXT NOT NULL,
  user_ip TEXT,
  user_agent TEXT,
  status_code INTEGER,
  response_size BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.proxy_requests ENABLE ROW LEVEL SECURITY;

-- Allow inserts from edge functions (service role)
CREATE POLICY "Allow public inserts"
ON public.proxy_requests
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all requests"
ON public.proxy_requests
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create rate_limits table
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (ip_address)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public upserts on rate_limits"
ON public.rate_limits
FOR ALL
WITH CHECK (true);

-- Create blocked_domains table
CREATE TABLE public.blocked_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocked domains"
ON public.blocked_domains
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage blocked domains"
ON public.blocked_domains
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Create site_settings table
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings"
ON public.site_settings
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.site_settings
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.site_settings (key, value) VALUES
  ('ads_enabled', 'true'),
  ('maintenance_mode', 'false'),
  ('rate_limit_requests', '30'),
  ('rate_limit_window_minutes', '1');

-- Create profiles table for user info
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();