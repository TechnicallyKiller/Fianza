// default-scenario — the "what happens when an agent doesn't pay?" demo.
//
// The DEADBEAT agent (staged by stage-default.mjs) has an overdue loan. This
// module reads its state and fires the REAL on-chain mark_default: the reserve
// absorbs what it can, the rest is a realised loss socialised to lenders (share
// price drops), and the agent is frozen. This is the honest answer to the #1
// investor question — "what if they default?" — shown live on testnet.
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  rpc,
  Contract,
  Address,
  TransactionBuilder,
  BASE_FEE,
  TimeoutInfinite,
  Keypair,
  scValToNative,
} from "@stellar/stellar-sdk";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../.env") });
dotenv.config({ path: path.resolve(here, "../.deadbeat-wallet.local") });

const RPC = "https://soroban-testnet.stellar.org";
const PASSPHRASE = "Test SDF Network ; September 2015";
const VAULT = process.env.LENDING_VAULT_CONTRACT_ID || "CAMF3BS23WXYMA6W6E55VSX577GIPSRKJXJKLL2G46TABUQ4GIRGHIL3";
const EXPLORER = (h) => `https://stellar.expert/explorer/testnet/tx/${h}`;
const STROOPS = 10_000_000;

const deadbeatPub = process.env.DEADBEAT_WALLET_PUBLIC;
// The caller of mark_default can be ANYONE (permissionless). We use the
// treasury/lender key if available, else the deadbeat itself can call it.
const callerSecret =
  process.env.TREASURY_SECRET || process.env.SCOUT_LENDER_SECRET || process.env.DEADBEAT_WALLET_SECRET;

const server = () => new rpc.Server(RPC);

/** Read the deadbeat's full vault state via the `state(agent)` view. */
async function readState() {
  try {
    const srv = server();
    const kp = Keypair.fromSecret(callerSecret);
    const acct = await srv.getAccount(kp.publicKey());
    const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
      .addOperation(new Contract(VAULT).call("state", Address.fromString(deadbeatPub).toScVal()))
      .setTimeout(30)
      .build();
    const sim = await srv.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) return null;
    return sim.result?.retval ? scValToNative(sim.result.retval) : null;
  } catch {
    return null;
  }
}

/** Current deadbeat status: outstanding owed, whether already defaulted. */
export async function deadbeatStatus() {
  if (!deadbeatPub) return { configured: false };
  const s = await readState();
  const num = (v) => (v == null ? null : Number(BigInt(v)) / STROOPS);
  return {
    configured: true,
    agent: deadbeatPub,
    outstandingUsdc: s ? num(s.amount_owed) : null,
    dueDate: s ? Number(s.due_date) : null,
    defaulted: s ? s.defaulted === true : null,
  };
}

/**
 * Fire the real on-chain mark_default(deadbeat, caller). Returns the tx hash and
 * the loss breakdown emitted by the Defaulted event. Throws NotOverdue if the
 * loan isn't past its 5-min due date yet (stage it earlier), or Defaulted if
 * it's already been defaulted.
 */
export async function triggerDefault() {
  if (!deadbeatPub) throw new Error("no deadbeat configured (.deadbeat-wallet.local)");
  const srv = server();
  const caller = Keypair.fromSecret(callerSecret);
  const acct = await srv.getAccount(caller.publicKey());
  const tx = new TransactionBuilder(acct, { fee: BASE_FEE, networkPassphrase: PASSPHRASE })
    .addOperation(
      new Contract(VAULT).call(
        "mark_default",
        Address.fromString(deadbeatPub).toScVal(),
        Address.fromString(caller.publicKey()).toScVal(),
      ),
    )
    .setTimeout(TimeoutInfinite)
    .build();
  const prepared = await srv.prepareTransaction(tx);
  prepared.sign(caller);
  const sent = await srv.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`mark_default submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  let got = await srv.getTransaction(sent.hash);
  for (let i = 0; i < 40 && got.status === "NOT_FOUND"; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    got = await srv.getTransaction(sent.hash);
  }
  if (got.status !== "SUCCESS") {
    throw new Error(`mark_default did not succeed: ${got.status}`);
  }
  return {
    defaulted: true,
    agent: deadbeatPub,
    caller: caller.publicKey(),
    txHash: sent.hash,
    explorerUrl: EXPLORER(sent.hash),
  };
}

export const defaultInfo = { agent: deadbeatPub || null, vault: VAULT };
