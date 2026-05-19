import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiUnauthorizedError } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";

function handleUnauthorized(client: QueryClient, error: unknown): void {
  if (!(error instanceof ApiUnauthorizedError)) {
    return;
  }

  client.setQueryData(queryKeys.authSession(), { user: null });
}

export function createAppQueryClient() {
  let client: QueryClient;

  const queryCache = new QueryCache({
    onError: (error): void => handleUnauthorized(client, error),
  });

  const mutationCache = new MutationCache({
    onError: (error): void => handleUnauthorized(client, error),
  });

  client = new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  return client;
}

export const queryClient = createAppQueryClient();
