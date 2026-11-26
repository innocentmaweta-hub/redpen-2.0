drop policy if exists "Institutions owner read" on public.institutions;
drop policy if exists "Institutions member read" on public.institutions;
create policy "Institutions shared read" on public.institutions for select to authenticated
using (
  owner_id=(select auth.uid())
  or id in (select institution_id from public.institution_memberships where user_id=(select auth.uid()))
);

drop policy if exists "Students owner access" on public.students;
drop policy if exists "Students shared read" on public.students;
create policy "Students shared read" on public.students for select to authenticated
using (
  owner_id=(select auth.uid())
  or id in (
    select student_id from public.assessments
    where workbook_id in (
      select id from public.workbooks
      where institution_id in (
        select institution_id from public.institution_memberships where user_id=(select auth.uid())
      )
    )
  )
);
create policy "Students owner insert" on public.students for insert to authenticated with check(owner_id=(select auth.uid()));
create policy "Students owner update" on public.students for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy "Students owner delete" on public.students for delete to authenticated using(owner_id=(select auth.uid()));

create index if not exists ai_grading_runs_assessment_idx on public.ai_grading_runs(assessment_id);
