import type { Metadata, Viewport } from 'next';
import NativeRuntime from '@/components/native-runtime';
import './globals.css';
import './responsive.css';
export const metadata: Metadata = { title: 'Axterix Med • Seu próximo objetivo', description: 'Planejamento financeiro para quem cuida de vidas.', manifest: '/manifest.webmanifest', icons:{icon:[{url:'/brand/symbol-32.png',sizes:'32x32',type:'image/png'},{url:'/brand/symbol-64.png',sizes:'64x64',type:'image/png'}],apple:[{url:'/brand/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}, appleWebApp: { capable: true, title: 'Axterix Med' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#123e35', viewportFit: 'cover' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="pt-BR"><body><NativeRuntime/>{children}</body></html>; }
