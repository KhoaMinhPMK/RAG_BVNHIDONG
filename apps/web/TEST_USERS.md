---
noteId: "cbdb7eb0453c11f1b3ce19fa7351e6bb"
tags: []

---

# Test Users Setup Guide

## Cách tạo test users trong Supabase

### Bước 1: Vào Supabase Dashboard
1. Mở https://supabase.com/dashboard
2. Chọn project: `mibtdruhmmcatccdzjjk`
3. Vào **Authentication** → **Users**

### Bước 2: Tạo 4 test users (1 cho mỗi role)

#### User 1: Clinician
- Email: `clinician@bvnhidong.vn`
- Password: `Test1234!`
- Role: `clinician`

#### User 2: Radiologist
- Email: `radiologist@bvnhidong.vn`
- Password: `Test1234!`
- Role: `radiologist`

#### User 3: Researcher
- Email: `researcher@bvnhidong.vn`
- Password: `Test1234!`
- Role: `researcher`

#### User 4: Admin
- Email: `admin@bvnhidong.vn`
- Password: `Test1234!`
- Role: `admin`

### Bước 3: Tạo profiles table

Chạy SQL này trong Supabase SQL Editor:

```sql
-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('clinician', 'radiologist', 'researcher', 'admin')),
  department TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Function: Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'clinician'),
    COALESCE(NEW.raw_user_meta_data->>'department', 'Nhi khoa')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Create profile on new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

### Bước 4: Insert profiles cho existing users

Sau khi tạo users ở Bước 2, chạy SQL này để tạo profiles:

```sql
-- Insert profiles for test users
INSERT INTO public.profiles (id, email, full_name, role, department)
SELECT 
  id,
  email,
  CASE 
    WHEN email = 'clinician@bvnhidong.vn' THEN 'BS. Nguyễn Văn A'
    WHEN email = 'radiologist@bvnhidong.vn' THEN 'BS. Trần Thị B'
    WHEN email = 'researcher@bvnhidong.vn' THEN 'TS. Lê Văn C'
    WHEN email = 'admin@bvnhidong.vn' THEN 'Admin System'
  END as full_name,
  CASE 
    WHEN email = 'clinician@bvnhidong.vn' THEN 'clinician'
    WHEN email = 'radiologist@bvnhidong.vn' THEN 'radiologist'
    WHEN email = 'researcher@bvnhidong.vn' THEN 'researcher'
    WHEN email = 'admin@bvnhidong.vn' THEN 'admin'
  END as role,
  'Nhi khoa' as department
FROM auth.users
WHERE email IN (
  'clinician@bvnhidong.vn',
  'radiologist@bvnhidong.vn',
  'researcher@bvnhidong.vn',
  'admin@bvnhidong.vn'
)
ON CONFLICT (id) DO NOTHING;
```

---

## Test Login Flow

### 1. Mở app
```bash
cd e:/project/webrag/apps/web
yarn dev
```

### 2. Vào http://localhost:3000

Bạn sẽ thấy:
- ✅ Sidebar có navigation items (đã fix)
- ✅ Header có user menu (loading state)
- ✅ Middleware disabled → không redirect về /login

### 3. Test login page

Vào http://localhost:3000/login

Login với:
- Email: `admin@bvnhidong.vn`
- Password: `Test1234!`

### 4. Sau khi login thành công

- ✅ Header hiển thị: "Admin System · Admin"
- ✅ Avatar hiển thị: "AS" (initials)
- ✅ Sidebar hiển thị menu "Quản trị" (chỉ admin thấy)
- ✅ Click avatar → dropdown menu với Logout

### 5. Test RBAC

Login với `clinician@bvnhidong.vn`:
- ✅ Sidebar **không** hiển thị menu "Quản trị"
- ✅ Header hiển thị: "BS. Nguyễn Văn A · Clinician"

---

## Bật lại middleware sau khi test xong

Uncomment dòng này trong `middleware.ts`:

```typescript
matcher: [
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
],
```

---

## Troubleshooting

### Lỗi: "Error fetching profile"
→ Chưa có profiles table hoặc chưa insert profiles

### Lỗi: "Invalid credentials"
→ Sai email/password hoặc chưa tạo user trong Supabase

### Sidebar vẫn trống
→ Đã fix rồi, refresh page

### Header không hiển thị user
→ Chưa login hoặc profiles table chưa có data
