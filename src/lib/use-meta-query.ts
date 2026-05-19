import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/api";
import { queryKeys } from "@/lib/query/query-keys";
import type { MetaView } from "@/lib/types";

export function useMetaQuery() {
  return useQuery({
    queryKey: queryKeys.meta(),
    queryFn: () => apiGet<MetaView>("/api/meta"),
  });
}
