import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { isApiConfigured } from "@/services/apiClient";

export function useApiQuery<TQueryFnData, TData = TQueryFnData>(
  options: UseQueryOptions<TQueryFnData, Error, TData, QueryKey>,
) {
  return useQuery({
    ...options,
    enabled: isApiConfigured && (options.enabled ?? true),
  });
}
