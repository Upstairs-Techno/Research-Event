# Research Distinction Awards Portal

Full-stack competition portal: **React + TypeScript + Vite + Tailwind** frontend, **Supabase** (Auth, Postgres + RLS, Storage, Edge Functions), **Razorpay** payments, **TipTap** research editor, pluggable plagiarism / AI-content detection.

## What's included

| Area | Where |
|---|---|
| Public site, auth, registration, payment, dashboard, editor, judge + admin dashboards, results, certificate verification | `src/` |
| Schema (all 16 tables), RLS policies, RPCs, private storage bucket, seed | `supabase/migrations/` |
| `create-order`, `verify-payment`, `razorpay-webhook`, `run-originality` | `supabase/functions/` |

## Setup

### 1. Supabase
1. Create a project at supabase.com.
2. Apply all migrations in order — either `supabase link --project-ref <ref> && supabase db push`, or paste every file in `supabase/migrations/` in numerical order.
3. **Authentication → Providers → Email**: turn *Confirm email* OFF so accounts can continue directly to participant details without an email-verification step.
4. **Authentication → URL configuration**: add your site URL (`http://localhost:5173` and your Vercel domain) to redirect URLs.
5. Sign up through the app with your own account, then make it admin:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```

### 2. Edge Functions
```bash
cp supabase/.env.example supabase/.env      # fill in Razorpay + detection keys
supabase secrets set --env-file supabase/.env
supabase functions deploy create-order verify-payment run-originality
supabase functions deploy razorpay-webhook --no-verify-jwt
supabase functions deploy deliver-notification-email --no-verify-jwt
supabase functions deploy admin-judge-management
```
In the Razorpay dashboard add a webhook → `https://<ref>.functions.supabase.co/razorpay-webhook`, events `payment.captured`, `order.paid`, `payment.failed`, using the secret you set as `RAZORPAY_WEBHOOK_SECRET`.

For participant email notifications, set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (a verified sender in Resend), and a long random `EMAIL_WEBHOOK_SECRET` as Supabase secrets. In Supabase Database → Webhooks, add an `INSERT` webhook for `public.email_outbox` targeting `https://<ref>.functions.supabase.co/deliver-notification-email`, with an `x-webhook-secret: <EMAIL_WEBHOOK_SECRET>` header. In-dashboard notifications are stored independently, so they remain available if email delivery is temporarily unavailable.

### 3. Frontend
```bash
cp .env.example .env     # VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev              # http://localhost:5173
npm run build            # type-check + production build
```
Deploy to Vercel (import repo, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; `vercel.json` handles SPA routing).

## Running the competition

1. **Admin → Settings**: set the deadline, review the rubric (must total 100; get organizer approval before opening), check the refund policy text.
2. **Admin → Judges**: enter a registered user's email → *Make judge*.
3. Participants register → pay → write → run originality check → submit (paper locks).
4. **Admin → Submissions**: assign judges, review reports, *Approve scores* once judges have submitted.
5. **Admin → Results**: *Publish results* (top 3 by average approved score), then *Generate certificates*.
6. Anyone can verify a certificate at `/verify/<ID>`.

## How the PRD requirements are met

- **Payment security**: order created server-side; signature verified with HMAC on the server; `markPaid` is idempotent and `razorpay_payment_id` is unique (no duplicate processing); webhook as a safety net; registration status can't be changed by clients (DB trigger + RLS). Failed payments can be retried.
- **Locked submissions**: DB trigger blocks content edits and protected-field changes after `submit_paper`; only an admin can unlock (`admin_unlock_submission`).
- **RLS everywhere**: participants see only their own rows; judges only assigned submissions (blind review — no participant identity); admins via `is_admin()`. Service-role key lives only in Edge Functions.
- **Monitoring**: paste events, large insertions, active time and version history are recorded and shown to judges with an explicit "not proof of plagiarism" notice; participants must accept a policy before writing.
- **Advisory detection**: high scores only set `flagged`; nothing is auto-rejected.
- **Audit log**: admin RPCs and settings changes write to `audit_logs`.

## Things you must finish before going live

1. **Plagiarism / AI detection vendor.** `run-originality` ships in `ORIGINALITY_MODE=mock`, which returns placeholder scores clearly labelled **MOCK DATA**. Choose a vendor, then set `ORIGINALITY_MODE=http` and adapt `callPlagiarism` / `callAi` in `supabase/functions/run-originality/index.ts` to the vendor's real request/response format.
2. **Math equations.** The editor supports sub/superscript and Unicode symbols; a LaTeX equation editor is not included.
3. **Image URLs.** Images live in a private bucket but are embedded as 1-year signed URLs, so anyone holding a URL can view that image. For stricter control, store storage paths and resolve signed URLs at render time.
4. **Certificates** are rendered as a printable page (print → PDF), not generated PDF files.
5. **Contact details** on the home page, organizer/partner names, and legal text (terms, privacy, refund wording) need your content. Have the refund policy reviewed.
6. Test the whole flow with Razorpay **test keys** and participant/admin accounts in a throwaway Supabase project first, including RLS (try reading another user's rows with the anon key).
7. Configure the Resend secrets and `email_outbox` Database Webhook above to deliver participant emails, including the registration-success message queued after payment is verified. Password reset emails continue to use Supabase Auth email settings.
