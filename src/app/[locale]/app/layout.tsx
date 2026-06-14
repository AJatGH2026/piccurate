import { setRequestLocale } from 'next-intl/server';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function AppLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // In Phase 3, this layout will add auth guards.
  // For now, it just passes through.
  return <>{children}</>;
}
