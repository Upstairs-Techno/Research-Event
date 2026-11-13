-- Email confirmation is disabled for this portal.
-- Migration 005 added a second verification check in RLS.
-- Remove only that restrictive policy from tables that exist.

DO $$
DECLARE
    tab text;
BEGIN
    FOREACH tab IN ARRAY ARRAY[
        'profiles',
        'participants',
        'registrations',
        'payments',
        'submissions',
        'submission_versions',
        'submission_activity',
        'originality_reports',
        'judges',
        'judge_assignments',
        'evaluations',
        'certificates',
        'participant_notifications'
    ] LOOP
        IF to_regclass(format('public.%I', tab)) IS NOT NULL THEN
            EXECUTE format(
                'DROP POLICY IF EXISTS "verified account required" ON public.%I',
                tab
            );
        END IF;
    END LOOP;
END $$;
