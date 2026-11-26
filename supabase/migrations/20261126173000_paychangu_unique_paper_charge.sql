-- Prevent duplicate per-paper charges for the same user's assessment.
create unique index if not exists paper_grading_charges_user_assessment_uidx
  on public.paper_grading_charges (user_id, assessment_id);
