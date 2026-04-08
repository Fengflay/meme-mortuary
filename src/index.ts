import { Hono } from "hono";
import { cors } from "hono/cors";
import { autopsy } from "./autopsy";

type Env = {
  Bindings: CloudflareBindings & {
    BSCSCAN_API_KEY: string;
    AI_API_KEY: string;
    CEMETERY: KVNamespace;
  };
};

const app = new Hono<Env>();

app.use("*", cors());

// API: perform autopsy on a dead meme coin
app.post("/api/autopsy", async (c) => {
  const { address } = await c.req.json<{ address: string }>();

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: "Invalid BNB Chain contract address" }, 400);
  }

  try {
    const report = await autopsy(address, c.env);

    // Store in cemetery KV
    try {
      const entry = {
        ...report,
        autopsiedAt: new Date().toISOString(),
      };
      await c.env.CEMETERY.put(
        address.toLowerCase(),
        JSON.stringify(entry)
      );
      // Also maintain an index of all autopsied tokens
      const indexRaw = await c.env.CEMETERY.get("__index__");
      const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];
      const addr = address.toLowerCase();
      if (!index.includes(addr)) {
        index.push(addr);
      }
      await c.env.CEMETERY.put("__index__", JSON.stringify(index));
    } catch {
      // KV write failure shouldn't break the response
    }

    return c.json(report);
  } catch (e: any) {
    return c.json({ error: e.message || "Autopsy failed" }, 500);
  }
});

// API: get all cemetery entries
app.get("/api/cemetery", async (c) => {
  try {
    const indexRaw = await c.env.CEMETERY.get("__index__");
    const index: string[] = indexRaw ? JSON.parse(indexRaw) : [];

    const entries = await Promise.all(
      index.map(async (addr) => {
        const raw = await c.env.CEMETERY.get(addr);
        if (!raw) return null;
        return JSON.parse(raw);
      })
    );

    // Filter nulls, sort by autopsiedAt descending
    const sorted = entries
      .filter(Boolean)
      .sort((a: any, b: any) =>
        new Date(b.autopsiedAt).getTime() - new Date(a.autopsiedAt).getTime()
      );

    return c.json({ graves: sorted, total: sorted.length });
  } catch (e: any) {
    return c.json({ graves: [], total: 0 });
  }
});

// API: get single cemetery entry
app.get("/api/cemetery/:address", async (c) => {
  const address = c.req.param("address").toLowerCase();
  const raw = await c.env.CEMETERY.get(address);
  if (!raw) {
    return c.json({ error: "This coin has not been autopsied yet" }, 404);
  }
  return c.json(JSON.parse(raw));
});

// Health check
app.get("/api/health", (c) => {
  return c.json({ status: "The mortuary is open for business 💀" });
});

export default app;
