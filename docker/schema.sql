create extension if not exists vector;

create table if not exists projects (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  description text default '',
  status text not null default 'active',
  owner text default '',
  vault_path text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists window_entries (
  id uuid primary key,
  project_id uuid not null references projects(id),
  category text not null,
  title text not null,
  body_markdown text not null,
  structured jsonb not null default '{}',
  priority integer not null default 5,
  status text not null default 'open',
  source text not null default 'human',
  source_inbox_id uuid,
  embedding vector(1536),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists inbox_messages (
  id uuid primary key,
  project_id uuid references projects(id),
  source text not null,
  source_ai text not null default 'other',
  raw_content text not null,
  classified_tag text,
  confidence numeric not null default 0,
  processing_status text not null default 'pending',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table if not exists audit_logs (
  id uuid primary key,
  actor text not null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null
);
