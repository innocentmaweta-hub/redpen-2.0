-- PayChangu billing foundation: owner-collected subscriptions and per-paper charges.
create table if not exists public.billing_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  billing_type text not null check (billing_type in ('subscription','per_paper')),
  amount_mwk numeric(12,2) not null check (amount_mwk >= 0),
  interval text check (interval in ('month','year')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((billing_type = 'subscription' and interval is not null) or (billing_type = 'per_paper' and interval is null))
);
insert into public.billing_products(code,name,billing_type,amount_mwk,interval,active) values
 ('monthly_subscription','RedPen monthly subscription','subscription',0,'month',false),
 ('annual_subscription','RedPen annual subscription','subscription',0,'year',false),
 ('per_paper','Per-paper grading fee','per_paper',0,null,false)
on conflict(code) do nothing;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.billing_products(id),
  tx_ref text not null unique,
  amount_mwk numeric(12,2) not null check (amount_mwk > 0),
  currency text not null default 'MWK' check (currency = 'MWK'),
  status text not null default 'pending' check (status in ('pending','successful','failed')),
  paychangu_reference text,
  assessment_id uuid references public.assessments(id) on delete set null,
  checkout_url text,
  verified_at timestamptz,
  provider_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payment_transactions_user_created_idx on public.payment_transactions(user_id,created_at desc);
create index if not exists payment_transactions_status_idx on public.payment_transactions(status,created_at);

create table if not exists public.redpen_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.billing_products(id),
  payment_transaction_id uuid not null unique references public.payment_transactions(id),
  status text not null default 'active' check (status in ('active','expired','cancelled')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists redpen_subscriptions_user_status_idx on public.redpen_subscriptions(user_id,status,ends_at desc);

create table if not exists public.paper_grading_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  payment_transaction_id uuid not null unique references public.payment_transactions(id),
  created_at timestamptz not null default now(),
  unique(user_id,assessment_id)
);

alter table public.billing_products enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.redpen_subscriptions enable row level security;
alter table public.paper_grading_charges enable row level security;

grant select on public.billing_products to authenticated;
grant select on public.payment_transactions, public.redpen_subscriptions, public.paper_grading_charges to authenticated;
create policy "Authenticated users can view active billing products" on public.billing_products for select to authenticated using(active);
create policy "Users can view own payment transactions" on public.payment_transactions for select to authenticated using(user_id = (select auth.uid()));
create policy "Users can view own subscriptions" on public.redpen_subscriptions for select to authenticated using(user_id = (select auth.uid()));
create policy "Users can view own paper charges" on public.paper_grading_charges for select to authenticated using(user_id = (select auth.uid()));

create trigger billing_products_set_updated_at before update on public.billing_products for each row execute function private.set_updated_at();
create trigger payment_transactions_set_updated_at before update on public.payment_transactions for each row execute function private.set_updated_at();
