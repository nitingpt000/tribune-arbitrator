'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';
import { toast, Toaster } from 'sonner';

import { ApiError, NetworkError } from '@/lib/api/client';

function describeError(err: unknown): { title: string; description: string } {
  if (err instanceof NetworkError) {
    return {
      title: 'Couldn\u2019t reach the API',
      description: 'Make sure the backend is running on the API URL.',
    };
  }
  if (err instanceof ApiError) {
    if (err.errors?.length) {
      const first = err.errors[0]!;
      return {
        title: err.message,
        description: `${first.path}: ${first.message}`,
      };
    }
    return {
      title: err.message,
      description: err.detail ?? `Request failed (${err.status}).`,
    };
  }
  if (err instanceof Error) return { title: 'Something went wrong', description: err.message };
  return { title: 'Something went wrong', description: 'Unknown error' };
}

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
          mutations: { retry: 0 },
        },
        queryCache: new QueryCache({
          onError: (error, query) => {
            // Don't toast on background refetches that succeeded previously.
            if (query.state.data !== undefined) return;
            const { title, description } = describeError(error);
            toast.error(title, { description });
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            const { title, description } = describeError(error);
            toast.error(title, { description });
          },
        }),
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                'border border-border bg-surface text-foreground rounded-card shadow-none font-sans text-sm',
            },
          }}
        />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
