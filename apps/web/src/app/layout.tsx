import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { AppLayout } from '@/components/ui/app-layout';
import { AuthProvider } from '@/contexts/auth-context';
import { RouteLoader } from '@/components/ui/route-loader';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata: Metadata = {
  title: 'WebRAG — Hệ thống RAG Y tế Nhi khoa',
  description: 'Hỗ trợ tra cứu tri thức lâm sàng, giải thích kết quả mô hình và sinh nháp báo cáo',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className={inter.className} suppressHydrationWarning>
        <RouteLoader />
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
