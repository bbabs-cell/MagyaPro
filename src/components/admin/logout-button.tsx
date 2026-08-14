'use client';

import { useRouter } from 'next/navigation';

import { api } from '@/lib/client/api';

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await api.post('/api/auth/logout');
    router.replace('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10"
    >
      Se déconnecter
    </button>
  );
}
