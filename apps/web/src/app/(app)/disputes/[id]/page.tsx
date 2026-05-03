'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect } from 'react';

import { useDispute } from '@/lib/api/queries';
import { isTerminal } from '@/lib/dispute-helpers';

interface DisputePageProps {
  params: Promise<{ id: string }>;
}

export default function DisputePage({ params }: DisputePageProps): React.JSX.Element {
  const { id } = use(params);
  const router = useRouter();
  const { data: dispute, isPending, error } = useDispute(id);

  useEffect(() => {
    if (isPending) return;
    if (error || !dispute) {
      router.replace('/disputes');
      return;
    }
    if (isTerminal(dispute)) {
      router.replace(`/disputes/${id}/verdict`);
    } else {
      router.replace(`/disputes/${id}/live`);
    }
  }, [dispute, error, id, isPending, router]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16 text-sm text-muted-foreground">
      Routing to dispute…
    </div>
  );
}
