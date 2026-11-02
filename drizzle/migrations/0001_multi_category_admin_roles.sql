-- Complaints can now have several categories, and admins can reply
ALTER TABLE public.complaints ADD COLUMN categories text[];
ALTER TABLE public.complaints ADD COLUMN admin_response text;
UPDATE public.complaints SET categories = ARRAY[category] WHERE categories IS NULL;
COMMENT ON COLUMN public.complaints.category IS 'DEPRECATED: replaced by categories (text[])';
GRANT SELECT, UPDATE ON public.complaints TO authenticated;

-- Roles
create type public.app_role as enum ('admin', 'moderator', 'user');
create table public.user_roles (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade not null,
    role app_role not null,
    unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can read their own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Admins can read and answer all complaints
create policy "Admins can view all complaints" on public.complaints for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins can update complaints" on public.complaints for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Assign the admin role automatically when the team email signs up
create or replace function public.assign_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'thinksync11@gmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created_assign_admin
  after insert on auth.users
  for each row execute function public.assign_admin_role();

-- Submission now takes a list of categories, requires a name, and builds the title internally
drop function public.submit_complaint(text,text,text,text,text,text,text,text,text);
create or replace function public.submit_complaint(p_name text, p_email text, p_role text, p_categories text[], p_subcategory text, p_description text, p_location text, p_language text)
returns text
language plpgsql
security definer
set search_path = 'public'
as $$
declare code text;
begin
  if length(trim(p_name)) < 1 or p_categories is null or array_length(p_categories, 1) is null or length(p_description) < 10 or length(p_description) > 5000 then
    raise exception 'invalid input';
  end if;
  insert into complaints(name,email,role,category,categories,subcategory,title,description,location,language)
  values (left(trim(p_name),100), left(p_email,255), left(p_role,30), left(p_categories[1],60), p_categories, left(p_subcategory,200), left(p_description,120), p_description, left(p_location,200), left(p_language,5))
  returning tracking_code into code;
  return code;
end $$;

-- Tracking now returns the categories and the admin's reply
drop function public.track_complaint(text);
create or replace function public.track_complaint(p_code text)
returns table(tracking_code text, categories text[], subcategory text, status text, admin_response text, created_at timestamp with time zone, updated_at timestamp with time zone)
language sql
stable
security definer
set search_path = 'public'
as $$
  select tracking_code, categories, subcategory, status, admin_response, created_at, updated_at from complaints where tracking_code = upper(trim(p_code)) limit 1;
$$;

-- Stats count every selected category
create or replace function public.complaint_stats()
returns table(category text, total bigint)
language sql
stable
security definer
set search_path = 'public'
as $$
  select c, count(*) from complaints, unnest(categories) as c group by c;
$$;