export type UntypedRpcResult = {
  data: unknown;
  error: { message: string; statusCode?: string } | null;
};

type UntypedRpcClient = {
  rpc: unknown;
};

type UntypedRpcCall = (fn: string, args?: Record<string, unknown>) => PromiseLike<UntypedRpcResult>;

/**
 * Calls manually migrated MemoFlow RPCs without detaching SupabaseClient.rpc.
 * SupabaseClient.rpc reads `this.rest`, so copying the method into a variable
 * makes every backup export/restore fail at runtime.
 */
export async function callUntypedRpc(
  client: UntypedRpcClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<UntypedRpcResult> {
  return await (client.rpc as UntypedRpcCall)(fn, args);
}
