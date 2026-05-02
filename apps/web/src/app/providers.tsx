'use client';

import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';

import { createWagmiConfig, type WagmiConfig } from '@/lib/wagmi';

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const [config, setConfig] = useState<WagmiConfig | null>(null);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    setConfig(createWagmiConfig());
  }, []);

  if (!config) return <>{children}</>;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
