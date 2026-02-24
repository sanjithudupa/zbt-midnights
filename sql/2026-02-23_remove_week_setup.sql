-- Remove website-managed week setup/template schema.
-- Keep weeks + scheduled_jobs + users + job submissions as operational data.

begin;

alter table if exists public.weeks
  drop constraint if exists weeks_template_id_fkey;

alter table if exists public.weeks
  drop column if exists template_id;

drop table if exists public.week_template_days cascade;
drop table if exists public.week_templates cascade;

-- Optional: remove deprecated admin setting key now that sheet mode is always used.
delete from public.admin_settings where key = 'schedule_source_of_truth';

commit;
