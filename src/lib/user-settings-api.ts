import { apiDelete, apiGet, apiPut } from "@/lib/api";
import type { UserRuntimeSettingsUpdateInput, UserRuntimeSettingsView } from "@/lib/types";

export function getUserRuntimeSettings() {
  return apiGet<UserRuntimeSettingsView>("/api/user-settings/runtime");
}

export function updateUserRuntimeSettings(input: UserRuntimeSettingsUpdateInput) {
  return apiPut<UserRuntimeSettingsView, UserRuntimeSettingsUpdateInput>("/api/user-settings/runtime", input);
}

export function clearUserRuntimeSettings() {
  return apiDelete<UserRuntimeSettingsView>("/api/user-settings/runtime");
}
