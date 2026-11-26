-- RedPen 2.0 core workspace, authentication, private file storage and access policies.
create extension if not exists pgcrypto;
create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  institution_name text,
  avatar_url text,
  role text not null default 'teacher' check (role in ('teacher','institution_admin','platform_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.institutions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.institution_memberships (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'teacher' check (member_role in ('teacher','admin')),
  created_at timestamptz not null default now(),
  unique(institution_id,user_id)
);
create table public.workbooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid references public.institutions(id) on delete set null,
  institution_name text,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workbook_id uuid not null references public.workbooks(id) on delete cascade,
  code text not null default '',
  name text not null,
  academic_year text,
  term text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  student_number text,
  class_name text,
  created_at timestamptz not null default now()
);
create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workbook_id uuid references public.workbooks(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  student_id uuid references public.students(id) on delete set null,
  marking_scheme_path text,
  answer_paper_path text,
  paper_filename text,
  status text not null default 'draft' check (status in ('draft','in_progress','completed','needs_review')),
  assessed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.grading_results (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null unique references public.assessments(id) on delete cascade,
  score numeric(10,2) not null default 0,
  maximum_score numeric(10,2) not null default 0,
  percentage numeric(5,2) not null default 0,
  grade text not null default 'F',
  feedback text not null default '',
  question_scores jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create table public.batch_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  workbook_id uuid references public.workbooks(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed','cancelled')),
  total_files integer not null default 0,
  completed_files integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.batch_job_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  batch_job_id uuid not null references public.batch_jobs(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  status text not null default 'queued' check (status in ('queued','processing','completed','needs_review','failed')),
  detected_student_name text,
  error_message text,
  created_at timestamptz not null default now()
);
create table public.workspace_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"workbooks":[],"results":[]}'::jsonb,
  updated_at timestamptz not null default now()
);
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index workbooks_owner_created_idx on public.workbooks(owner_id,created_at desc);
create index workbooks_institution_idx on public.workbooks(institution_id);
create index institutions_owner_idx on public.institutions(owner_id);
create index memberships_user_idx on public.institution_memberships(user_id);
create index courses_owner_workbook_idx on public.courses(owner_id,workbook_id);
create index courses_workbook_idx on public.courses(workbook_id);
create index students_owner_name_idx on public.students(owner_id,full_name);
create index assessments_owner_date_idx on public.assessments(owner_id,assessed_at desc);
create index assessments_workbook_idx on public.assessments(workbook_id);
create index assessments_course_idx on public.assessments(course_id);
create index assessments_student_idx on public.assessments(student_id);
create index grading_results_owner_date_idx on public.grading_results(owner_id,created_at desc);
create index batch_jobs_owner_date_idx on public.batch_jobs(owner_id,created_at desc);
create index batch_jobs_workbook_idx on public.batch_jobs(workbook_id);
create index batch_jobs_course_idx on public.batch_jobs(course_id);
create index batch_job_files_owner_idx on public.batch_job_files(owner_id);
create index batch_job_files_job_idx on public.batch_job_files(batch_job_id);

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;

create function private.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,display_name)
  values(new.id,coalesce(new.raw_user_meta_data ->> 'full_name',split_part(new.email,'@',1)))
  on conflict(id) do nothing;
  insert into public.workspace_snapshots(user_id) values(new.id) on conflict(user_id) do nothing;
  insert into public.user_preferences(user_id) values(new.id) on conflict(user_id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created_redpen after insert on auth.users for each row execute function private.handle_new_user();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger workbooks_set_updated_at before update on public.workbooks for each row execute function private.set_updated_at();
create trigger courses_set_updated_at before update on public.courses for each row execute function private.set_updated_at();
create trigger batch_jobs_set_updated_at before update on public.batch_jobs for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.institutions enable row level security;
alter table public.institution_memberships enable row level security;
alter table public.workbooks enable row level security;
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.assessments enable row level security;
alter table public.grading_results enable row level security;
alter table public.batch_jobs enable row level security;
alter table public.batch_job_files enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.user_preferences enable row level security;

revoke all on public.profiles from anon,authenticated;
grant select on public.profiles to authenticated;
grant update(display_name,institution_name,avatar_url) on public.profiles to authenticated;
create policy "Profiles select own" on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy "Profiles update own" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
grant select,insert,update,delete on public.institutions,public.institution_memberships,public.workbooks,public.courses,public.students,public.assessments,public.grading_results,public.batch_jobs,public.batch_job_files,public.workspace_snapshots,public.user_preferences to authenticated;

create policy "Institutions owner access" on public.institutions for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Memberships read own or institution" on public.institution_memberships for select to authenticated using(user_id=(select auth.uid()) or institution_id in (select id from public.institutions where owner_id=(select auth.uid())));
create policy "Memberships institution owner writes" on public.institution_memberships for insert to authenticated with check(institution_id in (select id from public.institutions where owner_id=(select auth.uid())));
create policy "Memberships institution owner updates" on public.institution_memberships for update to authenticated using(institution_id in (select id from public.institutions where owner_id=(select auth.uid()))) with check(institution_id in (select id from public.institutions where owner_id=(select auth.uid())));
create policy "Memberships institution owner deletes" on public.institution_memberships for delete to authenticated using(institution_id in (select id from public.institutions where owner_id=(select auth.uid())));
create policy "Workbooks owner access" on public.workbooks for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Courses owner access" on public.courses for all to authenticated using(owner_id=(select auth.uid()) and workbook_id in (select id from public.workbooks where owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and workbook_id in (select id from public.workbooks where owner_id=(select auth.uid())));
create policy "Students owner access" on public.students for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Assessments owner access" on public.assessments for all to authenticated using(owner_id=(select auth.uid()) and (workbook_id is null or workbook_id in (select id from public.workbooks where owner_id=(select auth.uid()))) and (course_id is null or course_id in (select id from public.courses where owner_id=(select auth.uid()))) and (student_id is null or student_id in (select id from public.students where owner_id=(select auth.uid())))) with check(owner_id=(select auth.uid()) and (workbook_id is null or workbook_id in (select id from public.workbooks where owner_id=(select auth.uid()))) and (course_id is null or course_id in (select id from public.courses where owner_id=(select auth.uid()))) and (student_id is null or student_id in (select id from public.students where owner_id=(select auth.uid()))));
create policy "Grading results owner access" on public.grading_results for all to authenticated using(owner_id=(select auth.uid()) and assessment_id in (select id from public.assessments where owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and assessment_id in (select id from public.assessments where owner_id=(select auth.uid())));
create policy "Batch jobs owner access" on public.batch_jobs for all to authenticated using(owner_id=(select auth.uid()) and (workbook_id is null or workbook_id in (select id from public.workbooks where owner_id=(select auth.uid()))) and (course_id is null or course_id in (select id from public.courses where owner_id=(select auth.uid())))) with check(owner_id=(select auth.uid()) and (workbook_id is null or workbook_id in (select id from public.workbooks where owner_id=(select auth.uid()))) and (course_id is null or course_id in (select id from public.courses where owner_id=(select auth.uid()))));
create policy "Batch files owner access" on public.batch_job_files for all to authenticated using(owner_id=(select auth.uid()) and batch_job_id in (select id from public.batch_jobs where owner_id=(select auth.uid()))) with check(owner_id=(select auth.uid()) and batch_job_id in (select id from public.batch_jobs where owner_id=(select auth.uid())));
create policy "Workspace snapshot owner access" on public.workspace_snapshots for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "User preferences owner access" on public.user_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('redpen-assessment-files','redpen-assessment-files',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp','text/plain']),
 ('redpen-generated-reports','redpen-generated-reports',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv']);

create policy "Assessment files insert own" on storage.objects for insert to authenticated with check(bucket_id='redpen-assessment-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Assessment files select own" on storage.objects for select to authenticated using(bucket_id='redpen-assessment-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Assessment files update own" on storage.objects for update to authenticated using(bucket_id='redpen-assessment-files' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='redpen-assessment-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Assessment files delete own" on storage.objects for delete to authenticated using(bucket_id='redpen-assessment-files' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Reports insert own" on storage.objects for insert to authenticated with check(bucket_id='redpen-generated-reports' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Reports select own" on storage.objects for select to authenticated using(bucket_id='redpen-generated-reports' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "Reports delete own" on storage.objects for delete to authenticated using(bucket_id='redpen-generated-reports' and (storage.foldername(name))[1]=(select auth.uid())::text);

alter publication supabase_realtime add table public.grading_results;
alter publication supabase_realtime add table public.batch_jobs;
alter publication supabase_realtime add table public.batch_job_files;
