create table liveramp_sessions (
  id         uuid primary key default gen_random_uuid(),
  mode       text not null,
  difficulty text,
  topic      text,
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
