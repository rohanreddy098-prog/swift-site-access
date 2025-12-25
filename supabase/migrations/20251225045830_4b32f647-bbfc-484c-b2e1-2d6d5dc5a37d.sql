-- Create update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create proxy_cookies table for server-side cookie persistence
CREATE TABLE public.proxy_cookies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  domain TEXT NOT NULL,
  cookies JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours')
);

-- Create index for fast lookups
CREATE INDEX idx_proxy_cookies_session_domain ON public.proxy_cookies(session_id, domain);
CREATE INDEX idx_proxy_cookies_expires ON public.proxy_cookies(expires_at);

-- Enable RLS
ALTER TABLE public.proxy_cookies ENABLE ROW LEVEL SECURITY;

-- Allow public access for cookie operations (session-based)
CREATE POLICY "Allow public cookie operations"
ON public.proxy_cookies
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to update timestamps
CREATE TRIGGER update_proxy_cookies_updated_at
BEFORE UPDATE ON public.proxy_cookies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create cleanup function for expired cookies
CREATE OR REPLACE FUNCTION public.cleanup_expired_cookies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.proxy_cookies WHERE expires_at < now();
END;
$$;