# RedPen 2.0

A clean React + TypeScript examination marking workspace. The legacy application is retained only as a reference in `archive/original-full-copy`; the new application is rebuilt independently.

## Production services
 
- Supabase project: `RedPen 2.0`
- Project ref: `kckljigwklpezqvaorao` 
- Region: `eu-west-1` (Ireland)
- API URL: `https://kckljigwklpezqvaorao.supabase.co`
- Hosting: Vercel, connected to the GitHub `main` branch.

## Supabase features

- **Auth:** email/password sign-up, sign-in and password recovery.
- **Postgres:** profiles, institutions, teacher memberships, workbooks, courses, students, assessments, results, batch jobs and AI audit records.
- **Storage:** private assessment and report buckets. File access is restricted by ownership and institution membership.
- **Realtime:** workspace snapshots, grading results and batch progress.
- **RLS:** ownership and institution-membership policies protect records.
- **Edge Functions:** `ai-grade` and `institution-admin`, both requiring authenticated users.

## AI grading setup

The `ai-grade` Supabase Edge Function is deployed. It reads text from PDFs and text files, and sends image/scanned-page content to a vision-capable model. It returns question-level marks, evidence-based feedback, student details when legible, and manual-review flags. RedPen validates the marks and requires the teacher to review the draft before saving.

Configure these server-side secrets in **Supabase Dashboard → Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `AI_API_KEY` | Your AI provider API key |
| `AI_PROVIDER` | `openrouter` (default) or `openai` |
| `AI_MODEL` | Provider model ID, e.g. `openai/gpt-4.1-mini` |
| `AI_BASE_URL` | Optional; defaults to `https://openrouter.ai/api/v1` |

Never place AI keys in Vite environment variables, browser code, or GitHub. The AI key is only read by the Supabase Edge Function. The configured model must support image input for scanned documents.

## Institution collaboration

An institution owner can create an institution and add teachers who already have RedPen accounts by email. Workbooks attached to an institution, courses, assessment results and associated private source files are readable by institution members under RLS. Membership administration is handled by the authenticated `institution-admin` Edge Function.

## Reports and batch processing

- Export filtered assessment results to Excel (`.xlsx`) or PDF.
- Upload a marking scheme and multiple answer papers to a batch.
- Batch papers are processed sequentially, with each result and progress state saved to Supabase.
- Papers with unreadable content, uncertain marks or provider errors are flagged for review or retry.

## Frontend environment

The browser uses the Supabase publishable key. Safe public defaults are present in `src/lib/supabase.ts`; optional Vite variables are:

```env
VITE_SUPABASE_URL=https://kckljigwklpezqvaorao.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Never add a Supabase service-role/secret key or AI provider key to Vite variables.

## Authentication redirect setup

In **Supabase Dashboard → Authentication → URL Configuration**, set the production website as the Site URL and add it to the allowed Redirect URLs. The app sends sign-up confirmation and password-recovery links to the current site origin.

## Development

```bash
npm install
npm run dev
npm run build
```

Database migrations are in `supabase/migrations/`. Deployable Edge Function source is in `supabase/functions/`.
