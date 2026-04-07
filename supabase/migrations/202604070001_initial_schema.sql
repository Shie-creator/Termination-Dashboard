create extension if not exists pgcrypto;

create table if not exists public.managers (
  id uuid primary key default gen_random_uuid(),
  manager_name text not null,
  normalized_name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_name text not null,
  normalized_name text not null,
  employee_external_id text,
  employee_email text,
  manager_id uuid references public.managers (id) on delete set null,
  department text,
  job_title text,
  work_location text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists employees_external_id_key
  on public.employees (employee_external_id)
  where employee_external_id is not null and employee_external_id <> '';

create unique index if not exists employees_email_key
  on public.employees (lower(employee_email))
  where employee_email is not null and employee_email <> '';

create index if not exists employees_normalized_name_idx
  on public.employees (normalized_name);

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  import_kind text not null check (import_kind in ('offboarding', 'turnover_report')),
  source_name text not null,
  row_count integer not null default 0,
  status text not null check (status in ('success', 'warning', 'failed')),
  notes text,
  storage_path text,
  metadata jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.termination_events (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees (id) on delete set null,
  manager_id uuid references public.managers (id) on delete set null,
  import_id uuid not null references public.imports (id) on delete cascade,
  employee_name text not null,
  manager_name text not null,
  termination_type text not null check (termination_type in ('Voluntary', 'Involuntary', 'Unknown')),
  termination_reason text,
  termination_date date,
  source_row jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists termination_events_date_idx
  on public.termination_events (termination_date desc);

create index if not exists termination_events_manager_idx
  on public.termination_events (manager_id);

create table if not exists public.turnover_summaries (
  id uuid primary key default gen_random_uuid(),
  report_year integer not null unique,
  period_start date not null,
  period_end date not null,
  terminated_count integer not null,
  average_active_headcount numeric(10,2) not null,
  turnover_rate numeric(10,2) not null,
  generated_at timestamptz,
  notes text,
  source_name text not null,
  import_id uuid not null references public.imports (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.turnover_report_rows (
  id uuid primary key default gen_random_uuid(),
  report_year integer not null,
  import_id uuid not null references public.imports (id) on delete cascade,
  employee_external_id text,
  username text,
  first_name text,
  last_name text,
  termination_date date,
  termination_reason text,
  service_length_years numeric(10,2),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists turnover_report_rows_year_idx
  on public.turnover_report_rows (report_year, termination_date desc);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists managers_set_updated_at on public.managers;
create trigger managers_set_updated_at
before update on public.managers
for each row execute procedure public.handle_updated_at();

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
before update on public.employees
for each row execute procedure public.handle_updated_at();

insert into storage.buckets (id, name, public)
values ('termination-imports', 'termination-imports', false)
on conflict (id) do nothing;

alter table public.managers enable row level security;
alter table public.employees enable row level security;
alter table public.imports enable row level security;
alter table public.termination_events enable row level security;
alter table public.turnover_summaries enable row level security;
alter table public.turnover_report_rows enable row level security;

drop policy if exists "Public can read managers" on public.managers;
create policy "Public can read managers"
on public.managers for select to anon, authenticated using (true);

drop policy if exists "Public can read employees" on public.employees;
create policy "Public can read employees"
on public.employees for select to anon, authenticated using (true);

drop policy if exists "Public can read imports" on public.imports;
create policy "Public can read imports"
on public.imports for select to anon, authenticated using (true);

drop policy if exists "Public can read termination events" on public.termination_events;
create policy "Public can read termination events"
on public.termination_events for select to anon, authenticated using (true);

drop policy if exists "Public can read turnover summaries" on public.turnover_summaries;
create policy "Public can read turnover summaries"
on public.turnover_summaries for select to anon, authenticated using (true);

drop policy if exists "Public can read turnover report rows" on public.turnover_report_rows;
create policy "Public can read turnover report rows"
on public.turnover_report_rows for select to anon, authenticated using (true);
