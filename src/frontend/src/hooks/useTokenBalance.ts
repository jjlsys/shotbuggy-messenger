import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Actor, HttpAgent } from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";
import { useEffect, useState } from "react";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const SHBY_LEDGER = "r4e4i-jiaaa-aaaaj-qrbwq-cai";

const Account = IDL.Record({
  owner: IDL.Principal,
  subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
});

const icrc1BalanceFactory = () =>
  IDL.Service({
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ["query"]),
  });

export function useTokenBalance(token: "ICP" | "SHBY") {
  const { identity } = useInternetIdentity();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!identity) return;
    let cancelled = false;

    const fetchBalance = async () => {
      setLoading(true);
      try {
        const canisterId = token === "ICP" ? ICP_LEDGER : SHBY_LEDGER;
        const agent = HttpAgent.createSync({
          identity,
          host: "https://icp-api.io",
        });
        const actor = Actor.createActor(icrc1BalanceFactory, {
          agent,
          canisterId,
        });
        const principal = identity.getPrincipal();
        const result = await (actor as any).icrc1_balance_of({
          owner: principal,
          subaccount: [],
        });
        if (!cancelled) setBalance(result as bigint);
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBalance();
    return () => {
      cancelled = true;
    };
  }, [identity, token]);

  return { balance, loading };
}
