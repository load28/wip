import type { Metadata } from 'next';
import { ThemeRegistry } from './providers/ThemeRegistry';
import { I18nProvider } from './providers/I18nProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Task Management Tool',
  description: '업무 관리 툴',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <I18nProvider>
          <ThemeRegistry>{children}</ThemeRegistry>
        </I18nProvider>
      </body>
    </html>
  );
}
