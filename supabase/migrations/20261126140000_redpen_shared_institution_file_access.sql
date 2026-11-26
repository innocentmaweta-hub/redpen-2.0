drop policy if exists "Assessment files shared read" on storage.objects;
create policy "Assessment files shared read" on storage.objects for select to authenticated
using (
  bucket_id='redpen-assessment-files'
  and (
    (storage.foldername(name))[1]=(select auth.uid())::text
    or exists (
      select 1 from public.assessments a
      join public.workbooks w on w.id=a.workbook_id
      where (a.answer_paper_path=name or a.marking_scheme_path=name)
        and w.institution_id in (select institution_id from public.institution_memberships where user_id=(select auth.uid()))
    )
    or exists (
      select 1 from public.batch_job_files bf
      join public.batch_jobs bj on bj.id=bf.batch_job_id
      join public.workbooks w on w.id=bj.workbook_id
      where bf.storage_path=name
        and w.institution_id in (select institution_id from public.institution_memberships where user_id=(select auth.uid()))
    )
    or exists (
      select 1 from public.batch_jobs bj
      join public.workbooks w on w.id=bj.workbook_id
      where bj.marking_scheme_path=name
        and w.institution_id in (select institution_id from public.institution_memberships where user_id=(select auth.uid()))
    )
  )
);
