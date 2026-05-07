/**
 * Login Page
 *
 * Medical-grade authentication with form validation
 * - Email/password login
 * - Remember me option
 * - Error handling
 * - Redirect to intended page after login
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectTo = searchParams?.get('redirect') || '/';

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push(redirectTo);
    }
  }, [user, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Basic validation
    if (!email || !password) {
      setError('Vui lòng điền đầy đủ email và mật khẩu');
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      setLoading(false);
      return;
    }

    try {
      console.log('[Login] Attempting sign in...');
      const { error: signInError } = await signIn(email, password);

      if (signInError) {
        console.error('[Login] Sign in failed:', signInError.message);
        setError('Email hoặc mật khẩu không đúng');
        setLoading(false);
        return;
      }

      console.log('[Login] Sign in successful, redirecting...');
      // Auth state will update via onAuthStateChange, then useEffect will redirect
      // Or we can force redirect here after a small delay
      setTimeout(() => {
        router.push(redirectTo);
        router.refresh();
      }, 500);
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      setError('Đã xảy ra lỗi. Vui lòng thử lại.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            RAG_BVNHIDONG
          </h1>
          <p className="text-sm text-text-secondary">
            Hệ thống hỗ trợ chẩn đoán viêm phổi Nhi khoa
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-border rounded-sm p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-text-primary mb-6">
            Đăng nhập
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error Alert */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-semantic-error/10 border border-semantic-error/30 rounded-sm animate-shake">
                <AlertCircle className="w-4 h-4 text-semantic-error mt-0.5 shrink-0" />
                <p className="text-xs text-semantic-error">{error}</p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-text-secondary mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow duration-150"
                placeholder="bac.si@bvnhidong.vn"
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-text-secondary mb-1.5">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 pr-10 text-sm bg-background border border-border rounded-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-shadow duration-150"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors disabled:opacity-50"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={loading}
                  className="w-4 h-4 rounded border-border text-brand-primary focus:ring-2 focus:ring-brand-primary focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-text-secondary">Ghi nhớ đăng nhập</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-brand-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-primary text-white text-sm font-medium rounded-sm hover:bg-brand-primary/90 focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-text-tertiary text-center">
              Hệ thống dành cho nhân viên y tế BVNHI Đồng
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-4 p-3 bg-surface border border-border rounded-sm">
          <p className="text-[10px] text-text-tertiary leading-relaxed">
            ⚠️ Hệ thống này chỉ dành cho mục đích hỗ trợ chẩn đoán. Không thay thế quyết định lâm sàng của bác sỹ điều trị.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginPageContent />
    </Suspense>
  );
}
