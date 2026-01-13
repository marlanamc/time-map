# Database Setup Guide

This guide explains how to set up the database schema and Row Level Security (RLS) policies for the Garden Fence app in Supabase.

## Prerequisites

- A Supabase project created at [supabase.com](https://supabase.com)
- Access to your Supabase project dashboard
- The SQL migration files in `supabase/migrations/`

## Important: Why You Need This

Without running these migrations, your app **will not save data** to Supabase. The tables may exist, but Row Level Security (RLS) will block all database operations by default.

## Step-by-Step Setup

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on **"SQL Editor"** in the left sidebar
3. Click **"New Query"** to create a new SQL query

### Step 2: Run the Initial Schema Migration

1. Open the file `supabase/migrations/001_initial_schema.sql` in your code editor
2. Copy the entire contents of the file
3. Paste it into the Supabase SQL Editor
4. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

**What this does:**
- Creates all necessary tables: `goals`, `brain_dump`, `preferences`, `achievements`, `weekly_reviews`, `body_double_sessions`
- Sets up foreign key relationships
- Creates initial indexes for performance
- Adds helpful comments to tables

**Expected result:** You should see a success message. If you get errors, make sure you haven't already run this migration (tables may already exist).

### Step 3: Run the RLS Policies Migration

1. Open the file `supabase/migrations/002_enable_rls.sql` in your code editor
2. Copy the entire contents of the file
3. In the Supabase SQL Editor, create a **new query** (or clear the previous one)
4. Paste the RLS policies SQL
5. Click **"Run"**

**What this does:**
- Enables Row Level Security on all tables
- Creates policies allowing users to:
  - SELECT (read) their own data
  - INSERT (create) their own data
  - UPDATE (modify) their own data
  - DELETE (remove) their own data

**This is critical!** Without these policies, all database operations will be blocked, even if tables exist.

**Expected result:** You should see success messages for each policy creation.

### Step 4: (Optional) Run Performance Indexes Migration

If you want to optimize query performance:

1. Open `supabase/migrations/003_add_performance_indexes.sql`
2. Copy and paste into a new SQL query
3. Click **"Run"**

**What this does:**
- Creates composite indexes for common query patterns
- Creates GIN indexes for JSONB columns
- Improves query performance for large datasets

### Step 5: Verify Setup

Run this query in the SQL Editor to verify everything is set up correctly:

```sql
-- Check that tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('goals', 'brain_dump', 'preferences', 'achievements', 'weekly_reviews', 'body_double_sessions')
ORDER BY table_name;

-- Check that RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('goals', 'brain_dump', 'preferences', 'achievements', 'weekly_reviews', 'body_double_sessions')
ORDER BY tablename;

-- Check that policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('goals', 'brain_dump', 'preferences', 'achievements', 'weekly_reviews', 'body_double_sessions')
ORDER BY tablename, policyname;
```

**Expected results:**
- All 6 tables should be listed
- All tables should have `rowsecurity = true`
- Each table should have 4 policies (SELECT, INSERT, UPDATE, DELETE)

## Troubleshooting

### Error: "relation already exists"

If you get errors saying tables already exist, you have two options:

1. **Skip the table creation** - If the tables already exist and have the correct structure, you can skip to Step 3 (RLS policies)

2. **Drop and recreate** (⚠️ **WARNING: This deletes all data**):
   ```sql
   -- Only do this if you're okay losing all data!
   DROP TABLE IF EXISTS body_double_sessions CASCADE;
   DROP TABLE IF EXISTS weekly_reviews CASCADE;
   DROP TABLE IF EXISTS achievements CASCADE;
   DROP TABLE IF EXISTS preferences CASCADE;
   DROP TABLE IF EXISTS brain_dump CASCADE;
   DROP TABLE IF EXISTS goals CASCADE;
   ```
   Then run the schema migration again.

### Error: "policy already exists"

If policies already exist, you can either:
1. Drop them first (see below)
2. Or modify the migration to use `CREATE POLICY IF NOT EXISTS` (Supabase may support this)

To drop existing policies:
```sql
-- Drop all policies (run this for each table if needed)
DROP POLICY IF EXISTS "Users can view their own goals" ON goals;
DROP POLICY IF EXISTS "Users can create their own goals" ON goals;
DROP POLICY IF EXISTS "Users can update their own goals" ON goals;
DROP POLICY IF EXISTS "Users can delete their own goals" ON goals;
-- Repeat for other tables...
```

### Data Still Not Saving?

1. **Check browser console** - Open Developer Tools (F12) and look for error messages. The improved error logging will show detailed information about what's failing.

2. **Verify you're logged in** - Make sure you've created an account and are logged into the app.

3. **Check RLS policies** - Run the verification query from Step 5 to ensure RLS is enabled and policies exist.

4. **Test connection** - You can test the database connection by running this in the browser console (while on your app):
   ```javascript
   // In browser console
   const { SupabaseService } = await import('./src/services/SupabaseService');
   const result = await SupabaseService.testConnection();
   console.log('Connection test:', result);
   ```

5. **Check Supabase logs** - In your Supabase dashboard, go to "Logs" → "Postgres Logs" to see any database errors.

### Common Issues

- **"permission denied for table"** - RLS policies are missing or incorrect
- **"relation does not exist"** - Tables haven't been created (run Step 2)
- **"new row violates row-level security policy"** - RLS is enabled but INSERT policy is missing/incorrect
- **"null value in column violates not-null constraint"** - Table structure mismatch (check migration matches TypeScript types)

## Migration Files Overview

- **001_initial_schema.sql** - Creates all tables, indexes, and relationships
- **002_enable_rls.sql** - Enables RLS and creates security policies (REQUIRED)
- **003_add_performance_indexes.sql** - Optional performance optimizations

## Next Steps

After running the migrations:

1. Test the app - Create a goal or brain dump entry
2. Refresh the page - Data should persist
3. Check the browser console - You should see success messages like `✓ Saved goal: "..."` 
4. Check Supabase dashboard - Go to "Table Editor" to see your data

## Need Help?

If you're still having issues:

1. Check the browser console for detailed error messages
2. Review the Supabase logs in the dashboard
3. Verify all migration steps were completed successfully
4. Make sure your Supabase project has the correct URL and keys configured in your app

## Notes

- Migrations should be run in order (001, then 002, then 003)
- You only need to run each migration once per database
- RLS policies are critical - without them, nothing will work
- The app will still work offline with localStorage, but cloud sync requires these migrations





