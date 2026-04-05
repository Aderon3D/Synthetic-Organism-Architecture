import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Synthetic Organism Architecture',
  description: 'A simulation of a biologically-inspired cognitive architecture.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-50 antialiased min-h-screen selection:bg-indigo-500/30" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
