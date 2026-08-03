// Prints every address the dev server is reachable on, so you can open the
// game on a phone that's on the same Wi-Fi.
import { networkInterfaces } from "node:os";

const PORT = process.env.PORT || 3000;
const addrs = [];

for (const [name, ifaces] of Object.entries(networkInterfaces())) {
  for (const i of ifaces ?? []) {
    if (i.family !== "IPv4" || i.internal) continue;
    addrs.push({ name, address: i.address });
  }
}

const line = "─".repeat(46);
console.log(`\n  🔥  Keep The Fire Light\n  ${line}`);
console.log(`  On this machine   http://localhost:${PORT}`);

if (addrs.length === 0) {
  console.log("\n  No LAN address found — are you connected to Wi-Fi?");
} else {
  console.log("\n  On your phone (same Wi-Fi):");
  for (const { name, address } of addrs) {
    console.log(`    http://${address}:${PORT}`.padEnd(36) + `(${name})`);
  }
}

console.log(`  ${line}`);
console.log(
  "  If a phone can't connect, Windows Firewall is blocking port\n" +
    `  ${PORT}. In an ADMIN PowerShell, run:\n\n` +
    `    netsh advfirewall firewall add rule name="KeepTheFireLight" ` +
    `dir=in action=allow protocol=TCP localport=${PORT}\n`
);
