import { describe, expect, it } from "vitest";

import { ApiUnauthorizedError } from "@/lib/api";
import { createAppQueryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";

describe("createAppQueryClient", () => {
  it("clears auth session when a query fails with unauthorized", async () => {
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.authSession(), {
      user: { id: 1, email: "author@example.com", displayName: "Author", status: "active" },
    });

    await expect(client.fetchQuery({
      queryKey: ["unauthorized-query"],
      queryFn: async () => {
        throw new ApiUnauthorizedError(401, "unauthorized", "Unauthorized");
      },
      retry: false,
    })).rejects.toBeInstanceOf(ApiUnauthorizedError);

    expect(client.getQueryData(queryKeys.authSession())).toEqual({ user: null });
  });

  it("clears auth session when a mutation fails with unauthorized", async () => {
    const client = createAppQueryClient();
    client.setQueryData(queryKeys.authSession(), {
      user: { id: 1, email: "author@example.com", displayName: "Author", status: "active" },
    });

    const mutation = client.getMutationCache().build(client, {
      mutationFn: async () => {
        throw new ApiUnauthorizedError(401, "unauthorized", "Unauthorized");
      },
      retry: false,
    });

    await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(ApiUnauthorizedError);
    expect(client.getQueryData(queryKeys.authSession())).toEqual({ user: null });
  });
});
