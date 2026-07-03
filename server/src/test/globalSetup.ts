/**
 * Vitest global setup — runs once before the entire suite.
 * Pushes the Prisma schema to the test SQLite database.
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, "../..");

export default function setup() {
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: serverRoot,
    env: {
      ...process.env,
      DATABASE_URL: "file:./test.db",
    },
    stdio: "inherit",
  });
}
