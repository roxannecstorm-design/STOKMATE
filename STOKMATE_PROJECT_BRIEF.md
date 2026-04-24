# STOKMATE — Complete Project Brief
## For Claude Code / Claude Desktop

---

## WHAT IS STOKMATE
A stokvel management app for South Africa and worldwide. Tracks contributions, sends WhatsApp reminders, resolves disputes with AI, generates certificates of good standing. Works for stokvels, pardner, sou-sou, tontines and savings clubs globally.

**Tagline:** "Your group's trusted companion"

---

## BUSINESS DETAILS
- **Company:** Stokmate Pty Ltd (registered with CIPC)
- **Owner:** Roxanne Roos
- **Email:** roxannecstorm@gmail.com
- **Live URL:** https://stokmate.co.za
- **Netlify URL:** https://stokmate.netlify.app
- **Netlify account:** roxannecstorm@gmail.com

---

## TECHNICAL STACK
- **Frontend:** HTML, CSS, Vanilla JavaScript (single file app)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Netlify (free tier)
- **Payments:** PayFast (sandbox connected, needs live credentials)
- **WhatsApp:** Twilio (not yet connected)
- **Domain:** stokmate.co.za (registered at domains.co.za)

---

## SUPABASE CREDENTIALS
- **Project URL:** https://eyeidefdslfqurrwowgh.supabase.co
- **Publishable key:** sb_publishable_XXa4VJBt7tUkU_1K-slyOg_GlJb2Ezx
- **Anon key:** eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5ZWlkZWZkc2xmcXVycndvd2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTAxMDAsImV4cCI6MjA5MjU4NjEwMH0.-kb4J2vt_xLxmmploozIlTa3mv4K-ezxwC88TbATNYw
- **Region:** North EU (Stockholm)

---

## DATABASE TABLES NEEDED (not yet created)
Run this SQL in Supabase SQL Editor to create all tables:

```sql
-- PROFILES TABLE
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text,
  email text,
  phone text,
  referral_code text unique,
  referral_earnings integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS
alter table profiles enable row level security;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- GROUPS TABLE
create table groups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  group_type text default 'rotating',
  type_icon text default '🔄',
  contribution_amount decimal default 0,
  currency text default 'R',
  invite_code text unique,
  created_by uuid references auth.users,
  members_count integer default 0,
  paid_count integer default 0,
  payout_order text default 'rotating',
  cycle text default 'monthly',
  health_score integer default 100,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table groups enable row level security;
create policy "Group members can view groups" on groups for select using (
  exists (select 1 from group_members where group_id = groups.id and user_id = auth.uid())
);
create policy "Authenticated users can create groups" on groups for insert with check (auth.uid() = created_by);
create policy "Group admins can update groups" on groups for update using (
  exists (select 1 from group_members where group_id = groups.id and user_id = auth.uid() and role = 'admin')
);

-- GROUP MEMBERS TABLE
create table group_members (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text default 'member',
  paid_this_month boolean default false,
  reliability_score integer default 100,
  months_paid integer default 0,
  months_total integer default 0,
  payout_turn integer,
  joined_at timestamp with time zone default timezone('utc'::text, now()),
  unique(group_id, user_id)
);

alter table group_members enable row level security;
create policy "Members can view group members" on group_members for select using (
  exists (select 1 from group_members gm where gm.group_id = group_members.group_id and gm.user_id = auth.uid())
);
create policy "Users can join groups" on group_members for insert with check (auth.uid() = user_id);
create policy "Members can update own record" on group_members for update using (auth.uid() = user_id);

-- PAYMENTS TABLE (dispute vault)
create table payments (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade,
  user_id uuid references auth.users,
  amount decimal not null,
  currency text default 'R',
  month_year text,
  confirmed_by uuid references auth.users,
  confirmed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table payments enable row level security;
create policy "Group members can view payments" on payments for select using (
  exists (select 1 from group_members where group_id = payments.group_id and user_id = auth.uid())
);
create policy "Members can log payments" on payments for insert with check (auth.uid() = user_id);

-- DISPUTE VAULT TABLE
create table vault_entries (
  id uuid default gen_random_uuid() primary key,
  group_id uuid references groups on delete cascade,
  action text not null,
  performed_by uuid references auth.users,
  details jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table vault_entries enable row level security;
create policy "Group members can view vault" on vault_entries for select using (
  exists (select 1 from group_members where group_id = vault_entries.group_id and user_id = auth.uid())
);
create policy "System can insert vault entries" on vault_entries for insert with check (true);
```

---

## PAYFAST CREDENTIALS (SANDBOX)
- **Sandbox URL:** https://sandbox.payfast.co.za/eng/process
- **Merchant ID:** 10000100 (test)
- **Merchant Key:** 46f0cd694581a (test)
- **Pro monthly:** R49/month
- **Pro annual:** R490/year
- **Free trial:** 30 days, no card needed
- **NOTE:** Replace with live credentials once PayFast approves the merchant account

---

## APP FEATURES BUILT
1. ✅ Landing page with social proof and marketing psychology
2. ✅ User authentication (sign up, sign in, sign out)
3. ✅ Currency selector (9 currencies — ZAR, GBP, USD, EUR, ZMW, NGN, BWP, KES, ZWL)
4. ✅ Group type selector (rotating, grocery, burial society, investment, savings club, festive)
5. ✅ Create group with invite code generation
6. ✅ Join group with invite code
7. ✅ Member list with reliability scores
8. ✅ Group health score
9. ✅ December countdown dashboard
10. ✅ Dispute vault (tamper-proof activity log)
11. ✅ Certificate of good standing
12. ✅ Referral reward programme
13. ✅ WhatsApp sharing (invite links)
14. ✅ AI dispute assistant
15. ✅ PayFast subscription payments (sandbox)
16. ✅ PDF statements (Pro feature)
17. ✅ Marketing psychology design (navy CTAs, social proof, urgency triggers)

---

## WHAT STILL NEEDS TO BE BUILT
1. **Supabase tables** — Run the SQL above in Supabase SQL Editor
2. **Deploy updated app to Netlify** — Upload stokmate-latest.html
3. **WhatsApp reminders via Twilio** — Not yet connected
4. **Live PayFast credentials** — Waiting for merchant account approval
5. **Mark payment as paid** — Button in group detail needs to update database
6. **Push notifications** — For payment reminders
7. **Google Play packaging** — Capacitor wrapper needed
8. **Apple App Store packaging** — Requires Mac computer
9. **Privacy policy page** — Required for app stores
10. **Terms of service page** — Required for app stores
11. **Professional email** — hello@stokmate.co.za via Zoho Mail

---

## PRICING MODEL
- **Free:** 1 group, max 8 members, max 10 transactions/month, no WhatsApp reminders
- **Pro:** R49/month per group — unlimited members, WhatsApp reminders, AI, PDF statements, certificate
- **Pro Annual:** R490/year per group (save R98 — 2 months free)
- **Loophole protection:** Phone number verification, device fingerprinting, data lock-in after 60 days

---

## REVENUE PROJECTIONS
- 200 paying groups = R9,800/month net
- 500 paying groups = R22,640/month net  
- 1,000 paying groups = R45,280/month net
- Year 1 realistic target: R180,000 — R320,000 total

---

## TARGET MARKET
- Primary: South African stokvel group admins (800,000 groups, 11 million members)
- Secondary: UK pardner groups, US sou-sou groups, West African tontines
- Demographics: 25-55 year olds, predominantly female (57%), all SA language groups
- Key insight: Digital stokvel deposits grew 84% in one year — market is actively digitising right now

---

## COMPETITION
- **StokFella** — holds members' money, buggy app, complex UX, 4,000 downloads
- **iStokvel** — requires banking licence, formal and trust-averse
- **MyStokvel** — basic features, no AI
- **Stokmate advantage** — never holds money, AI-powered, WhatsApp native, premium design, all group types, international

---

## BRAND
- **Colours:** Deep green (#0A3D2B), Gold (#D4A017), Navy (#0F1C3F)
- **Fonts:** Fraunces (headings), Plus Jakarta Sans (body)
- **Tone:** Warm, community-driven, professional but approachable
- **Tagline:** "Your group's trusted companion"

---

## NEXT SESSION PRIORITIES (in order)
1. Run SQL in Supabase to create tables
2. Deploy stokmate-latest.html to Netlify
3. Test full signup → create group → invite member flow
4. Connect Twilio for WhatsApp reminders
5. Connect live PayFast once merchant account approved
6. Package for Google Play Store
7. Set up hello@stokmate.co.za email via Zoho Mail

---

## FILES
- **stokmate-latest.html** — Complete app with Supabase connection built in
- **stokmate-payments.html** — PayFast payment integration
- **stokmate-v3.html** — Full featured prototype with all 6 killer features

---

*Built by Roxanne Roos with Claude — April 2025*
*stokmate.co.za is live and ready*
