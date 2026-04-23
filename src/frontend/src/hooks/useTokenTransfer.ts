import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { Actor, HttpAgent } from "@icp-sdk/core/agent";
import { IDL } from "@icp-sdk/core/candid";
import type { Principal } from "@icp-sdk/core/principal";
import { useState } from "react";

const ICP_LEDGER = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const SHBY_LEDGER = "r4e4i-jiaaa-aaaaj-qrbwq-cai";

// ICRC-1 IDL definition
const Account = IDL.Record({
  owner: IDL.Principal,
  subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
});

const TransferArg = IDL.Record({
  to: Account,
  fee: IDL.Opt(IDL.Nat),
  memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
  from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  created_at_time: IDL.Opt(IDL.Nat64),
  amount: IDL.Nat,
});

const TransferError = IDL.Variant({
  BadFee: IDL.Record({ expected_fee: IDL.Nat }),
  BadBurn: IDL.Record({ min_burn_amount: IDL.Nat }),
  InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
  TooOld: IDL.Null,
  CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
  Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
  TemporarilyUnavailable: IDL.Null,
  GenericError: IDL.Record({ error_code: IDL.Nat, message: IDL.Text }),
});

const TransferResult = IDL.Variant({
  Ok: IDL.Nat,
  Err: TransferError,
});

const icrc1IdlFactory = () =>
  IDL.Service({
    icrc1_transfer: IDL.Func([TransferArg], [TransferResult], []),
  });

export function useTokenTransfer(): {
  transfer: (
    token: "ICP" | "SHBY",
    recipient: Principal,
    amountE8s: bigint,
    memo?: string,
  ) => Promise<bigint>;
  isPending: boolean;
  error: string | null;
} {
  const { identity } = useInternetIdentity();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const transfer = async (
    token: "ICP" | "SHBY",
    recipient: Principal,
    amountE8s: bigint,
    memo?: string,
  ): Promise<bigint> => {
    if (!identity) {
      throw new Error("Not authenticated. Please log in first.");
    }

    setIsPending(true);
    setError(null);

    try {
      const canisterId = token === "ICP" ? ICP_LEDGER : SHBY_LEDGER;

      const agent = HttpAgent.createSync({
        identity,
        host: "https://icp-api.io",
      });

      const actor = Actor.createActor(icrc1IdlFactory, {
        agent,
        canisterId,
      });

      // Build memo bytes if provided
      let memoBytes: [] | [Uint8Array] = [];
      if (memo) {
        const encoded = new TextEncoder().encode(memo);
        memoBytes = [encoded];
      }

      // ICP fee is 10000 e8s; for SHBY let the ledger decide
      const fee: [] | [bigint] = token === "ICP" ? [10000n] : [];

      const transferArg = {
        to: {
          owner: recipient,
          subaccount: [] as [],
        },
        fee,
        memo: memoBytes,
        from_subaccount: [] as [],
        created_at_time: [] as [],
        amount: amountE8s,
      };

      const result = await (actor as any).icrc1_transfer(transferArg);

      if ("Err" in result) {
        const errVariant = result.Err;
        let errMsg = "Transfer failed";
        if ("InsufficientFunds" in errVariant) {
          errMsg = `Insufficient funds (balance: ${Number(errVariant.InsufficientFunds.balance) / 1e8} ${token})`;
        } else if ("BadFee" in errVariant) {
          errMsg = `Bad fee (expected: ${Number(errVariant.BadFee.expected_fee) / 1e8} ${token})`;
        } else if ("GenericError" in errVariant) {
          errMsg = errVariant.GenericError.message;
        } else if ("TemporarilyUnavailable" in errVariant) {
          errMsg = "Ledger temporarily unavailable";
        } else if ("TooOld" in errVariant) {
          errMsg = "Transaction too old";
        } else if ("Duplicate" in errVariant) {
          errMsg = "Duplicate transaction";
        }
        throw new Error(errMsg);
      }

      return result.Ok as bigint;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      setError(msg);
      throw err;
    } finally {
      setIsPending(false);
    }
  };

  return { transfer, isPending, error };
}
