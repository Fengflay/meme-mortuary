// Fetch on-chain data for a token on BNB Chain

// Multiple BSC RPC endpoints to avoid rate limiting
const BSC_RPCS = [
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed2.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc-dataseed2.ninicoin.io/",
  "https://bsc-dataseed3.defibit.io/",
  "https://bsc-dataseed4.defibit.io/",
];
let rpcIndex = 0;
function getNextRpc(): string {
  const rpc = BSC_RPCS[rpcIndex % BSC_RPCS.length];
  rpcIndex++;
  return rpc;
}
const BSCSCAN_API = "https://api.bscscan.com/api";

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  contractCreator: string;
  creationTxHash: string;
}

export interface TokenLifecycle {
  birthDate: string;
  deathDate: string;
  ageInDays: number;
  peakHolders: number;
  currentHolders: number;
  peakPriceUsd: number;
  currentPriceUsd: number;
  peakMarketCap: number;
  totalTxCount: number;
  peakVolume24h: number;
  liquidityUsd: number;
  priceChange: number;
}

export interface TopHolder {
  address: string;
  percentage: number;
}

export interface ChainData {
  token: TokenInfo;
  lifecycle: TokenLifecycle;
  topHolders: TopHolder[];
  isDead: boolean;
  pairAddress: string | null;
}

// Direct RPC call to BNB Chain node with fallback rotation
async function rpcCall(to: string, data: string): Promise<string> {
  const rpc = getNextRpc();
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to, data }, "latest"],
        id: 1,
      }),
    });
    if (!res.ok) throw new Error(`RPC ${res.status}`);
    const json: any = await res.json();
    return json.result || "0x";
  } catch {
    // Retry with a different RPC
    const fallback = getNextRpc();
    const res = await fetch(fallback, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_call",
        params: [{ to, data }, "latest"],
        id: 1,
      }),
    });
    const json: any = await res.json();
    return json.result || "0x";
  }
}

// Fetch token info using direct RPC calls
async function fetchTokenInfo(address: string, apiKey: string): Promise<TokenInfo> {
  // Get contract creation info from BSCScan (this endpoint may still work)
  let contractCreator = "unknown";
  let creationTxHash = "";
  try {
    const creationUrl = `${BSCSCAN_API}?module=contract&action=getcontractcreation&contractaddresses=${address}&apikey=${apiKey}`;
    const creationRes = await fetch(creationUrl);
    const creationData: any = await creationRes.json();
    if (creationData.result && creationData.result.length > 0) {
      contractCreator = creationData.result[0].contractCreator || "unknown";
      creationTxHash = creationData.result[0].txHash || "";
    }
  } catch {}

  // Get token metadata via direct RPC calls (no BSCScan proxy needed)
  const [nameHex, symbolHex, decimalsHex, supplyHex] = await Promise.all([
    rpcCall(address, "0x06fdde03"),  // name()
    rpcCall(address, "0x95d89b41"),  // symbol()
    rpcCall(address, "0x313ce567"),  // decimals()
    rpcCall(address, "0x18160ddd"),  // totalSupply()
  ]);

  return {
    name: decodeAbiString(nameHex) || decodeBytes32(nameHex) || "Unknown Token",
    symbol: decodeAbiString(symbolHex) || decodeBytes32(symbolHex) || "???",
    decimals: parseInt(decimalsHex, 16) || 18,
    totalSupply: supplyHex || "0",
    contractCreator,
    creationTxHash,
  };
}

// Decode ABI-encoded dynamic string (most ERC-20 tokens)
function decodeAbiString(hex: string): string {
  if (!hex || hex === "0x" || hex.length < 130) return "";
  try {
    const offset = parseInt(hex.slice(2, 66), 16) * 2;
    const length = parseInt(hex.slice(2 + offset, 2 + offset + 64), 16);
    if (length === 0 || length > 200) return "";
    const strHex = hex.slice(2 + offset + 64, 2 + offset + 64 + length * 2);
    // Use Uint8Array + TextDecoder for proper UTF-8 support (Chinese chars etc.)
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = parseInt(strHex.slice(i * 2, i * 2 + 2), 16);
    }
    return new TextDecoder("utf-8").decode(bytes).trim();
  } catch {
    return "";
  }
}

// Decode bytes32-encoded string (some older tokens like MKR, SAI)
function decodeBytes32(hex: string): string {
  if (!hex || hex === "0x" || hex.length < 66) return "";
  try {
    const raw = hex.slice(2, 66);
    let str = "";
    for (let i = 0; i < raw.length; i += 2) {
      const code = parseInt(raw.slice(i, i + 2), 16);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  } catch {
    return "";
  }
}

// Fetch token data from DexScreener
async function fetchDexData(address: string): Promise<{
  lifecycle: TokenLifecycle;
  pairAddress: string | null;
  isDead: boolean;
}> {
  const url = `https://api.dexscreener.com/tokens/v1/bsc/${address}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  const data: any = await res.json();

  const pairs = Array.isArray(data) ? data : [];

  if (pairs.length === 0) {
    return {
      lifecycle: emptyLifecycle(),
      pairAddress: null,
      isDead: true,
    };
  }

  // Pick the pair with highest liquidity
  const pair = pairs.reduce((best: any, p: any) =>
    (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
  );

  const priceUsd = parseFloat(pair.priceUsd || "0");
  const fdv = pair.fdv || 0;
  const liquidity = pair.liquidity?.usd || 0;
  const volume24h = pair.volume?.h24 || 0;
  const pairCreatedAt = pair.pairCreatedAt
    ? new Date(pair.pairCreatedAt).toISOString()
    : "unknown";

  // Determine if dead: liquidity < $100 or volume < $10
  const isDead = liquidity < 100 || (volume24h < 10 && liquidity < 1000);

  const now = Date.now();
  const createdAt = pair.pairCreatedAt || now;
  const ageInDays = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));

  return {
    lifecycle: {
      birthDate: pairCreatedAt,
      deathDate: isDead ? new Date().toISOString() : "still alive",
      ageInDays,
      peakHolders: 0,
      currentHolders: 0,
      peakPriceUsd: 0,
      currentPriceUsd: priceUsd,
      peakMarketCap: fdv,
      totalTxCount: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
      peakVolume24h: volume24h,
      liquidityUsd: liquidity,
      priceChange: pair.priceChange?.h24 ?? -100,
    },
    pairAddress: pair.pairAddress || null,
    isDead,
  };
}

function emptyLifecycle(): TokenLifecycle {
  return {
    birthDate: "unknown",
    deathDate: "unknown",
    ageInDays: 0,
    peakHolders: 0,
    currentHolders: 0,
    peakPriceUsd: 0,
    currentPriceUsd: 0,
    peakMarketCap: 0,
    totalTxCount: 0,
    peakVolume24h: 0,
    liquidityUsd: 0,
    priceChange: -100,
  };
}

// Fetch top token holders from BSCScan
async function fetchTopHolders(address: string, apiKey: string): Promise<TopHolder[]> {
  try {
    const url = `${BSCSCAN_API}?module=token&action=tokenholderlist&contractaddress=${address}&page=1&offset=10&apikey=${apiKey}`;
    const res = await fetch(url);
    const data: any = await res.json();

    if (!data.result || !Array.isArray(data.result)) return [];

    return data.result.map((h: any) => ({
      address: h.TokenHolderAddress,
      percentage: parseFloat(h.TokenHolderQuantity) || 0,
    }));
  } catch {
    return [];
  }
}

// Try multiple sources to find contract creation date
async function fetchCreationDate(address: string): Promise<string | null> {
  // Try GeckoTerminal pools endpoint for pair creation date
  try {
    const url = `https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${address}/pools?page=1`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const data: any = await res.json();
    const pools = data?.data || [];
    if (pools.length > 0) {
      // Find the oldest pool
      let oldest: string | null = null;
      for (const pool of pools) {
        const created = pool?.attributes?.pool_created_at;
        if (created && (!oldest || created < oldest)) {
          oldest = created;
        }
      }
      if (oldest) return new Date(oldest).toISOString();
    }
  } catch {}
  return null;
}

// Main function: fetch all chain data
export async function fetchChainData(address: string, bscscanApiKey: string): Promise<ChainData> {
  const [token, dexResult, topHolders] = await Promise.all([
    fetchTokenInfo(address, bscscanApiKey),
    fetchDexData(address),
    fetchTopHolders(address, bscscanApiKey),
  ]);

  // If DexScreener doesn't have birth date, try BSCScan tx history
  if (dexResult.lifecycle.birthDate === "unknown") {
    const creationDate = await fetchCreationDate(address);
    if (creationDate) {
      dexResult.lifecycle.birthDate = creationDate;
      const now = Date.now();
      dexResult.lifecycle.ageInDays = Math.floor(
        (now - new Date(creationDate).getTime()) / (1000 * 60 * 60 * 24)
      );
    }
  }

  return {
    token,
    lifecycle: dexResult.lifecycle,
    topHolders,
    isDead: dexResult.isDead,
    pairAddress: dexResult.pairAddress,
  };
}
