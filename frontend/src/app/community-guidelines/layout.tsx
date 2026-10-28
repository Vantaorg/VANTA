import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Community Guidelines | VANTA',
  description: 'The standards that help keep VANTA welcoming, safe, and respectful.',
};

export default function CommunityGuidelinesLayout({ children }: { children: ReactNode }) {
  return children;
}
