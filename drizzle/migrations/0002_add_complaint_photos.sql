ALTER TABLE public.complaints ADD COLUMN photo_url text;

CREATE POLICY "Anyone can upload complaint photos"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'complaint-photos');

CREATE POLICY "Anyone can view complaint photos"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'complaint-photos');

DROP FUNCTION public.submit_complaint(text, text, text, text[], text, text, text, text);

CREATE OR REPLACE FUNCTION public.submit_complaint(p_name text, p_email text, p_role text, p_categories text[], p_subcategory text, p_description text, p_location text, p_language text, p_photo_url text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare code text;
begin
  if length(trim(p_name)) < 1 or p_categories is null or array_length(p_categories, 1) is null or length(p_description) < 10 or length(p_description) > 5000 then
    raise exception 'invalid input';
  end if;
  if p_photo_url is not null and (p_photo_url ~ '(\.\.|//)' or p_photo_url !~ '^[a-zA-Z0-9_/-]{1,180}\.(jpg|jpeg|png|webp)$') then
    raise exception 'invalid photo';
  end if;
  insert into complaints(name,email,role,category,categories,subcategory,title,description,location,language,photo_url)
  values (left(trim(p_name),100), left(p_email,255), left(p_role,30), left(p_categories[1],60), p_categories, left(p_subcategory,200), left(p_description,120), p_description, left(p_location,200), left(p_language,5), p_photo_url)
  returning tracking_code into code;
  return code;
end $function$;

DROP FUNCTION public.track_complaint(text);

CREATE OR REPLACE FUNCTION public.track_complaint(p_code text)
RETURNS TABLE(tracking_code text, categories text[], subcategory text, status text, admin_response text, photo_url text, created_at timestamp with time zone, updated_at timestamp with time zone)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select tracking_code, categories, subcategory, status, admin_response, photo_url, created_at, updated_at from complaints where tracking_code = upper(trim(p_code)) limit 1;
$function$;