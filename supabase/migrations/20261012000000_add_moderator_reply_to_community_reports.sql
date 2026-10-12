alter table public.community_reports add column if not exists moderator_reply text;
comment on column public.community_reports.moderator_reply is 'Staff response shown to the user who submitted the report';
