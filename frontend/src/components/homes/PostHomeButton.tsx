'use client';

import { useAuth } from '@/context/AuthContext';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';

export function PostHomeButton() {
  const { user } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <Button variant="gold" onClick={() => router.push('/homes/create')} className="!h-9 !min-h-0 !px-3 !py-1.5 !text-xs sm:!text-sm">
      <Plus size={15} strokeWidth={2.5} /> + Property
    </Button>
  );
}
