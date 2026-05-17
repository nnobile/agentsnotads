-- ============================================================
-- articles
-- ============================================================
create table articles (
  id               uuid primary key default gen_random_uuid(),
  url              text not null unique,
  title            text not null,
  source           text not null,
  published_at     timestamptz,
  fetched_at       timestamptz not null default now(),
  summary          text,
  tags             text[],
  relevance_score  float,
  status           text not null default 'candidate', -- 'candidate' | 'approved' | 'rejected'
  approved_at      timestamptz,
  newsletter_sent  boolean not null default false
);

-- ============================================================
-- subscribers
-- ============================================================
create table subscribers (
  id                   uuid primary key default gen_random_uuid(),
  email                text not null unique,
  cadence              text not null default 'weekly', -- 'daily' | 'weekly'
  confirmed            boolean not null default false,
  confirmation_token   text unique,
  subscribed_at        timestamptz not null default now(),
  unsubscribed_at      timestamptz
);

-- ============================================================
-- newsletter_sends
-- ============================================================
create table newsletter_sends (
  id              uuid primary key default gen_random_uuid(),
  sent_at         timestamptz not null default now(),
  cadence         text not null,
  article_ids     uuid[],
  recipient_count int
);

-- ============================================================
-- rss_sources
-- ============================================================
create table rss_sources (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  url            text not null unique,
  active         boolean not null default true,
  coverage_area  text
);

-- ============================================================
-- Indexes
-- ============================================================
create index articles_status_idx     on articles(status);
create index articles_approved_at_idx on articles(approved_at desc);

-- ============================================================
-- Seed: rss_sources
-- ============================================================
insert into rss_sources (name, url, coverage_area) values
  ('AdExchanger',           'https://adexchanger.com/feed/',                      'Ad tech / programmatic'),
  ('Digiday',               'https://digiday.com/feed/',                          'Media / agency / publishing'),
  ('The Drum',              'https://www.thedrum.com/rss',                        'Brand & agency'),
  ('Marketing Brew',        'https://www.marketingbrew.com/rss',                  'Marketing / brand'),
  ('Ad Age',                'https://adage.com/rss',                              'Broad advertising'),
  ('IAB',                   'https://www.iab.com/feed/',                          'Industry standards'),
  ('Martech.org',           'https://martech.org/feed/',                          'Martech'),
  ('ExchangeWire',          'https://www.exchangewire.com/feed/',                 'Programmatic / ad tech'),
  ('Beet.TV',               'https://www.beet.tv/feed',                           'CTV / streaming'),
  ('The Trade Desk Blog',   'https://www.thetradedesk.com/us/news/rss',           'DSP / programmatic'),
  ('MediaPost',             'https://www.mediapost.com/rss/',                     'Broad advertising'),
  ('Campaign US',           'https://www.campaignlive.com/rss',                   'Brand & agency'),
  ('Cynopsis',              'https://cynopsis.com/feed/',                         'CTV / streaming'),
  ('Nielsen Insights',      'https://www.nielsen.com/insights/feed/',             'Measurement / cross-platform'),
  ('Broadcasting & Cable',  'https://www.nexttv.com/rss',                         'TV / streaming'),
  ('MediaRadar Blog',       'https://mediaradar.com/blog/feed/',                  'Ad sales / media planning');
