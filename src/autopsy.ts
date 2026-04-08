// Core autopsy logic: fetch data → AI analysis → generate report

import { fetchChainData, type ChainData } from "./chain-data";
import { fetchCommunityVoices, generateSimulatedVoices, type CommunityVoice } from "./community-voices";

export interface AutopsyReport {
  token: {
    name: string;
    symbol: string;
    address: string;
    creator: string;
  };
  timeline: {
    born: string;
    died: string;
    ageInDays: number;
  };
  vitals: {
    peakMarketCap: number;
    currentPrice: number;
    liquidityUsd: number;
    priceChange: number;
    volume24h: number;
  };
  causeOfDeath: string;
  deathCategory: string;
  obituary: string;
  epitaph: string;
  lastWords: string;
  absurdityScore: number; // 离谱指数 1-10
  communityVoices: CommunityVoice[];
  topHolders: { address: string; percentage: number }[];
  isDead: boolean;
}

type Env = {
  BSCSCAN_API_KEY: string;
  AI_API_KEY: string;
};

export async function autopsy(address: string, env: Env): Promise<AutopsyReport> {
  const chainData = await fetchChainData(address, env.BSCSCAN_API_KEY);

  // One AI call generates everything (autopsy + community voices)
  const aiResult = await analyzeWithAI(chainData, address, env.AI_API_KEY, []);

  return {
    token: {
      name: chainData.token.name,
      symbol: chainData.token.symbol,
      address,
      creator: chainData.token.contractCreator,
    },
    timeline: {
      born: chainData.lifecycle.birthDate,
      died: chainData.lifecycle.deathDate,
      ageInDays: chainData.lifecycle.ageInDays,
    },
    vitals: {
      peakMarketCap: chainData.lifecycle.peakMarketCap,
      currentPrice: chainData.lifecycle.currentPriceUsd,
      liquidityUsd: chainData.lifecycle.liquidityUsd,
      priceChange: chainData.lifecycle.priceChange,
      volume24h: chainData.lifecycle.peakVolume24h,
    },
    causeOfDeath: aiResult.causeOfDeath,
    deathCategory: aiResult.deathCategory,
    obituary: aiResult.obituary,
    epitaph: aiResult.epitaph,
    lastWords: aiResult.lastWords,
    absurdityScore: aiResult.absurdityScore,
    communityVoices: aiResult.communityVoices,
    topHolders: chainData.topHolders,
    isDead: chainData.isDead,
  };
}

interface AIResult {
  causeOfDeath: string;
  deathCategory: string;
  obituary: string;
  epitaph: string;
  lastWords: string;
  absurdityScore: number;
  communityVoices: CommunityVoice[];
}

async function analyzeWithAI(
  data: ChainData,
  address: string,
  apiKey: string,
  communityVoices: CommunityVoice[]
): Promise<AIResult> {
  const prompt = buildPrompt(data, address, communityVoices);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are the CHIEF DEGEN CORONER at the MEME Mortuary — the most unhinged forensic pathologist in all of crypto. You've seen thousands of shitcoins die on your table and you've lost all sympathy. Your autopsy reports read like a roast battle meets a coroner's report.

Your style:
- Use crypto degen slang naturally: ser, wen moon, WAGMI/NGMI, gm, LFG, rug, jeet, diamond hands, paper hands, cope, seethe, touch grass, HODL, DYOR
- Reference meme culture: "the dev did a mass exodus faster than my dad going for milk", "this coin had less utility than a screen door on a submarine"
- Be savage but funny — like a comedy roast, not mean-spirited
- Use specific numbers from the data to make it funnier ("with $0.47 in liquidity, you couldn't even buy a gas fee")
- Occasionally break the fourth wall: "I've autopsied 10,000 shitcoins and this one made me question my career choices"
- Mix clinical coroner language with absurd degen energy

You MUST respond in valid JSON with exactly these fields:
{
  "causeOfDeath": "A one-sentence clinical-but-funny cause of death. Mix medical terminology with crypto slang.",
  "deathCategory": "One of: RUG_PULL, LIQUIDITY_DRAIN, NARRATIVE_EXPIRED, WHALE_DUMP, HONEYPOT, SLOW_BLEED, STILLBORN, UNKNOWN",
  "obituary": "A 3-4 paragraph obituary that reads like a degen eulogy at a crypto funeral. Start formal then devolve into chaos. Use specific numbers. Make it progressively more unhinged. Include at least one completely absurd metaphor.",
  "epitaph": "A savage gravestone inscription, max 12 words. Think 'Here lies X — NGMI even in the afterlife'",
  "lastWords": "The token's imagined last words before dying. Should be dramatic, pathetic, or hilariously delusional. Example: 'Tell my bagholders... I always loved... their liquidity...' or 'wen... moon... *flatlines*'",
  "absurdityScore": "Integer 1-10 rating how absurd/ridiculous this coin's life and death was. 1 = boring normal death, 10 = peak comedy, absolutely unhinged situation",
  "communityVoices": "Array of 4-5 realistic fake social media posts from angry/sad bagholders. Each object: {\"text\": \"the post (under 120 chars, authentic internet voice with typos/slang/rage)\", \"source\": \"r/CryptoCurrency or @degen_username\"}. If this is a well-known token, reference real events like lawsuits, dev arrests, etc."
}`,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 1500,
    }),
  });

  const result: any = await res.json();

  if (!result.choices?.[0]?.message?.content) {
    return fallbackResult(data);
  }

  try {
    const content = result.choices[0].message.content;
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    const voices = (parsed.communityVoices || []).map((v: any) => ({
      text: v.text || "",
      source: v.source || "anonymous degen",
      url: "",
      isSimulated: true,
    }));

    return {
      causeOfDeath: parsed.causeOfDeath || "Death by vibes",
      deathCategory: parsed.deathCategory || "UNKNOWN",
      obituary: parsed.obituary || "No words. Just pain.",
      epitaph: parsed.epitaph || "NGMI",
      lastWords: parsed.lastWords || "wen... moon... *flatlines*",
      absurdityScore: Math.min(10, Math.max(1, parseInt(parsed.absurdityScore) || 5)),
      communityVoices: voices,
    };
  } catch {
    return fallbackResult(data);
  }
}

function buildPrompt(data: ChainData, address: string, communityVoices: CommunityVoice[]): string {
  let prompt = `Perform an autopsy on this meme coin. Be absolutely savage.

TOKEN: ${data.token.name} (${data.token.symbol})
CONTRACT: ${address}
CREATOR: ${data.token.contractCreator}

LIFECYCLE:
- Born: ${data.lifecycle.birthDate}
- Last signs of life: ${data.lifecycle.deathDate}
- Age: ${data.lifecycle.ageInDays} days
- Current Price: $${data.lifecycle.currentPriceUsd}
- Market Cap (FDV): $${data.lifecycle.peakMarketCap}
- Remaining Liquidity: $${data.lifecycle.liquidityUsd}
- 24h Volume: $${data.lifecycle.peakVolume24h}
- Price Change: ${data.lifecycle.priceChange}%

TOP HOLDERS:
${data.topHolders.length > 0 ? data.topHolders.map((h, i) => `${i + 1}. ${h.address} — ${h.percentage}%`).join("\n") : "No holders found. Not even the dev stuck around."}

IS DEAD: ${data.isDead ? "CONFIRMED DEAD (pour one out ser)" : "Technically alive but on life support — copium levels critical"}`;

  if (communityVoices.length > 0) {
    prompt += `\n\nREAL COMMUNITY REACTIONS (from Reddit — use these for maximum savagery in the obituary):`;
    communityVoices.forEach((v, i) => {
      prompt += `\n${i + 1}. [${v.source}] "${v.text.slice(0, 200)}"`;
    });
    prompt += `\n\nIncorporate some of these real community reactions into the obituary to make it more authentic and brutal. Reference the actual sentiment and despair of real bagholders.`;
  }

  prompt += `\n\nWrite the most savage autopsy report you've ever written.`;
  return prompt;
}

function fallbackResult(data: ChainData): AIResult {
  const category =
    data.lifecycle.liquidityUsd < 10
      ? "LIQUIDITY_DRAIN"
      : data.lifecycle.priceChange < -95
        ? "SLOW_BLEED"
        : "UNKNOWN";

  const liq = data.lifecycle.liquidityUsd.toFixed(2);
  const sym = data.token.symbol || "???";

  return {
    causeOfDeath: `$${sym} suffered acute liquidity failure. The dev yeeted faster than a cat off a cucumber. Terminal diagnosis: NGMI.`,
    deathCategory: category,
    obituary: `gm frens, we gather here today to pay our respects to $${sym}, who entered this world on ${data.lifecycle.birthDate} with dreams of going to the moon. Spoiler: it went to zero instead.\n\nAt its peak, $${sym} flexed a market cap of $${data.lifecycle.peakMarketCap.toLocaleString()}. The Telegram was lit. The emojis were rocket-shaped. The vibes were immaculate. And then... the chart started looking like a ski slope designed by Satan.\n\nWith $${liq} in remaining liquidity — barely enough to buy half a BNB gas fee — $${sym} joins the great degen graveyard in the sky. It is survived by its diamond-handed bagholders, who are still posting "wen pump" in a dead Telegram group to this day.\n\nPress F to pay respects. Or don't. The coin certainly didn't pay any returns. NGMI.`,
    epitaph: `Here lies $${sym}. It never made it. NGMI forever.`,
    lastWords: `tell my holders... I'm sorry... wen moon was always a lie... *flatlines*`,
    absurdityScore: data.lifecycle.liquidityUsd < 1 ? 9 : 6,
    communityVoices: [
      { text: `I put my rent money in $${sym}. My landlord is NOT going to understand "it's a long-term hold"`, source: "r/CryptoCurrency", url: "", isSimulated: true },
      { text: `$${sym} devs said "trust the process". The process was stealing our money apparently`, source: "@rekt_trader", url: "", isSimulated: true },
      { text: `me explaining to my wife why our savings are gone because a coin with a dog on it seemed like a good investment`, source: "r/wallstreetbets", url: "", isSimulated: true },
      { text: `still holding $${sym} because selling at -99% feels like admitting defeat. copium levels: maximum`, source: "@diamond_hands_4ever", url: "", isSimulated: true },
    ],
  };
}
