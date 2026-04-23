import {
  loadConfig,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { StorageClient } from "@caffeineai/object-storage";
import { HttpAgent } from "@icp-sdk/core/agent";
import { useCallback } from "react";

export function useStorageClient() {
  const { identity } = useInternetIdentity();

  const getClient = useCallback(async (): Promise<StorageClient> => {
    const config = await loadConfig();
    const agent = new HttpAgent({
      identity: identity ?? undefined,
      host: config.backend_host,
    });
    if (config.backend_host?.includes("localhost")) {
      await agent.fetchRootKey().catch(() => {});
    }
    return new StorageClient(
      config.bucket_name,
      config.storage_gateway_url,
      config.backend_canister_id,
      config.project_id,
      agent,
    );
  }, [identity]);

  return { getClient };
}
