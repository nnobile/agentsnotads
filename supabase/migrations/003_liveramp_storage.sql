-- Storage bucket for LiveRamp uploaded documents (private)
insert into storage.buckets (id, name, public)
values ('liveramp-docs', 'liveramp-docs', false)
on conflict (id) do nothing;

-- Only the service role key can access this bucket — no public policies needed

-- Extend liveramp_documents with extracted text and active flag
alter table liveramp_documents add column if not exists content text;
alter table liveramp_documents add column if not exists active boolean not null default true;
