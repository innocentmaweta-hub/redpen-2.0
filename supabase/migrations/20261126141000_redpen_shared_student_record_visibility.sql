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
