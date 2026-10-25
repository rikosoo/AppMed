import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'FinanceMed AI • Seu próximo objetivo', description: 'Planejamento financeiro para quem cuida de vidas.', manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: 'FinanceMed' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#123e35' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body>{children}</body></html>; }
