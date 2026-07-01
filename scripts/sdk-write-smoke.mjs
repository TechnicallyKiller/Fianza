// Smoke test: agent-driven borrow + repay through the SDK (reversible).
import fs from "node:fs";
import { TrustLineAgent } from "../packages/agent-sdk/dist/index.js";

const k = JSON.parse(fs.readFileSync("/tmp/_phase4b_keys.json", "utf8"));
const tl = new TrustLineAgent(k.agent, {
  contracts: {
    registry: "CAZUPW5MWHG5XCE7BM6YP6M52NPB6TPRRAXU3GEV4TL2AR2ZMYE7TRSX",
    creditLine: "CA2HOO3KKDPQB4URKDJGVP4QD57UTCSKA2XN7U76RAN4VATOKXZV4QSV",
    vault: "CD5RQFFYF57MLI3JI2PHUROMYFWLGDB7RPMGIK5JRWAO6NWHEUE3EC6C",
  },
});

console.log("before:", await tl.vaultState());
const b = await tl.borrow(2);
console.log("borrow 2 →", b.txHash);
console.log("after borrow:", (await tl.vaultState()).principalUsdc, "principal");
const r = await tl.repay(2);
console.log("repay 2 →", r.txHash);
console.log("after repay:", await tl.vaultState());
