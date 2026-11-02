CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text),1,8)),
  name text,
  email text,
  role text NOT NULL DEFAULT 'student',
  category text NOT NULL,
  subcategory text,
  title text NOT NULL,
  description text NOT NULL,
  location text,
  language text NOT NULL DEFAULT 'en',
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.complaints TO anon, authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit" ON public.complaints FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'submitted' AND length(title) BETWEEN 3 AND 200 AND length(description) BETWEEN 10 AND 5000);

CREATE OR REPLACE FUNCTION public.submit_complaint(p_name text, p_email text, p_role text, p_category text, p_subcategory text, p_title text, p_description text, p_location text, p_language text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE code text;
BEGIN
  IF length(p_title) < 3 OR length(p_title) > 200 OR length(p_description) < 10 OR length(p_description) > 5000 THEN
    RAISE EXCEPTION 'invalid input';
  END IF;
  INSERT INTO complaints(name,email,role,category,subcategory,title,description,location,language)
  VALUES (left(p_name,100), left(p_email,255), left(p_role,30), left(p_category,60), left(p_subcategory,200), p_title, p_description, left(p_location,200), left(p_language,5))
  RETURNING tracking_code INTO code;
  RETURN code;
END $$;

CREATE OR REPLACE FUNCTION public.track_complaint(p_code text)
RETURNS TABLE(tracking_code text, category text, subcategory text, title text, status text, created_at timestamptz, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tracking_code, category, subcategory, title, status, created_at, updated_at FROM complaints WHERE tracking_code = upper(trim(p_code)) LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.complaint_stats()
RETURNS TABLE(category text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT category, count(*) FROM complaints GROUP BY category;
$$;

GRANT EXECUTE ON FUNCTION public.submit_complaint TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_complaint TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complaint_stats TO anon, authenticated;