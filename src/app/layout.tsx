import type { Metadata } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { KeyboardShortcuts } from '@/components/sim/KeyboardShortcuts';
import { SimulationDriver } from '@/components/sim/SimulationDriver';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-barlow' });
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
});

export const metadata: Metadata = {
  title: 'VIGIA · Monitoreo ambiental',
  description: 'Prototipo de monitoreo ambiental y alerta temprana para minería subterránea. Datos simulados.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full bg-canvas font-sans text-ink">
        <SimulationDriver />
        <KeyboardShortcuts />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
