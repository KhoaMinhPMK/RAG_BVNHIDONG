-- ============================================================================
-- CREATE TEST USERS FOR WEBRAG
-- ============================================================================
-- Run this in Supabase SQL Editor
-- These users will be created in auth.users and profiles tables

-- NOTE: Supabase Auth users must be created via Dashboard or API first
-- This script only creates the profiles

-- ============================================================================
-- Step 1: Create users in Supabase Dashboard first
-- ============================================================================
-- Go to: Authentication > Users > Add User
-- Create these 4 users:
-- 1. admin@bvnhidong.vn / Test1234!
-- 2. clinician@bvnhidong.vn / Test1234!
-- 3. radiologist@bvnhidong.vn / Test1234!
-- 4. researcher@bvnhidong.vn / Test1234!

-- ============================================================================
-- Step 2: Get User IDs
-- ============================================================================
-- After creating users in Dashboard, run this to get their IDs:
SELECT id, email FROM auth.users WHERE email LIKE '%@bvnhidong.vn' ORDER BY email;

-- ============================================================================
-- Step 3: Insert Profiles (Replace <USER_ID> with actual IDs from Step 2)
-- ============================================================================

-- Admin Profile
INSERT INTO public.profiles (user_id, email, full_name, role, department)
VALUES (
  '<ADMIN_USER_ID>', -- Replace with actual ID from auth.users
  'admin@bvnhidong.vn',
  'Admin User',
  'admin',
  'Administration'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- Clinician Profile
INSERT INTO public.profiles (user_id, email, full_name, role, department)
VALUES (
  '<CLINICIAN_USER_ID>', -- Replace with actual ID from auth.users
  'clinician@bvnhidong.vn',
  'Bác sĩ Lâm sàng',
  'clinician',
  'Pediatrics'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- Radiologist Profile
INSERT INTO public.profiles (user_id, email, full_name, role, department)
VALUES (
  '<RADIOLOGIST_USER_ID>', -- Replace with actual ID from auth.users
  'radiologist@bvnhidong.vn',
  'Bác sĩ Chẩn đoán Hình ảnh',
  'radiologist',
  'Radiology'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- Researcher Profile
INSERT INTO public.profiles (user_id, email, full_name, role, department)
VALUES (
  '<RESEARCHER_USER_ID>', -- Replace with actual ID from auth.users
  'researcher@bvnhidong.vn',
  'Nghiên cứu viên',
  'researcher',
  'Research'
) ON CONFLICT (user_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  department = EXCLUDED.department;

-- ============================================================================
-- Step 4: Verify Profiles Created
-- ============================================================================
SELECT
  p.user_id,
  p.email,
  p.full_name,
  p.role,
  p.department,
  p.created_at
FROM public.profiles p
WHERE p.email LIKE '%@bvnhidong.vn'
ORDER BY p.role;

-- Expected: 4 rows (admin, clinician, radiologist, researcher)

-- ============================================================================
-- Step 5: Test RBAC Permissions
-- ============================================================================
-- Verify each role has correct permissions by checking the RBAC matrix:
--
-- | Permission           | clinician | radiologist | researcher | admin |
-- |---------------------|-----------|-------------|------------|-------|
-- | query:knowledge     | ✅        | ✅          | ✅         | ✅    |
-- | explain:detection   | ✅        | ✅          | ✅         | ✅    |
-- | draft:create        | ✅        | ✅          | ❌         | ✅    |
-- | draft:approve       | ❌        | ✅          | ❌         | ✅    |
-- | audit:view          | ❌        | ❌          | ❌         | ✅    |

-- ============================================================================
-- ALTERNATIVE: Auto-create profiles with trigger (OPTIONAL)
-- ============================================================================
-- If you want profiles to be created automatically when users sign up:

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'clinician'), -- Default role
    COALESCE(NEW.raw_user_meta_data->>'department', 'General')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Users must be created in Supabase Dashboard first (Authentication > Users)
-- 2. Then run Step 3 to create profiles with roles
-- 3. RLS policies are already enabled on profiles table
-- 4. Users can only read/update their own profiles
-- 5. Only admins can view audit logs
