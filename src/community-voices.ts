// Fetch real community reactions or generate AI-simulated ones

export interface CommunityVoice {
  text: string;
  source: string;
  url: string;
  isSimulated: boolean;
}

// Try to fetch real reactions from Reddit, fall back to AI-generated ones
export async function fetchCommunityVoices(
  tokenName: string,
  tokenSymbol: string
): Promise<CommunityVoice[]> {
  // Try Reddit first
  const real = await tryReddit(tokenName, tokenSymbol);
  if (real.length > 0) return real;

  // If no real data, return empty - AI will generate simulated ones
  return [];
}

// Generate simulated community voices via AI
export async function generateSimulatedVoices(
  tokenName: string,
  tokenSymbol: string,
  apiKey: string
): Promise<CommunityVoice[]> {
  try {
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
            content: `You generate realistic fake Reddit/Twitter posts from angry crypto investors who lost money on a specific token. Write in authentic internet voice - typos, slang, rage, cope, despair. Mix English and broken English. Some should be angry, some sad, some in denial, some dark humor.

Return a JSON array of exactly 5 objects: [{"text": "the post content", "source": "r/CryptoCurrency or @username", "platform": "reddit or twitter"}]

Keep each post under 150 characters. Make them feel REAL - like actual posts from real bagholders.`,
          },
          {
            role: "user",
            content: `Generate 5 realistic community reactions from people who lost money on ${tokenName} ($${tokenSymbol}). If this is a well-known token, reference real events (lawsuits, dev arrests, rug details). Make them brutally authentic.`,
          },
        ],
        temperature: 0.95,
        max_tokens: 500,
      }),
    });

    const result: any = await res.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) return [];

    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const posts: any[] = JSON.parse(jsonStr);

    return posts.map((p: any) => ({
      text: p.text || "",
      source: p.source || "anonymous degen",
      url: "",
      isSimulated: true,
    }));
  } catch {
    return [];
  }
}

async function tryReddit(
  tokenName: string,
  tokenSymbol: string
): Promise<CommunityVoice[]> {
  const voices: CommunityVoice[] = [];
  const queries = [`${tokenName} rug`, `${tokenSymbol} scam lost`];

  for (const q of queries) {
    try {
      const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=top&limit=5&t=all`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "MEME-Mortuary/1.0 (hackathon)",
          Accept: "application/json",
        },
      });

      if (!res.ok) continue;
      const data: any = await res.json();
      const posts = data?.data?.children || [];

      for (const post of posts) {
        const d = post?.data;
        if (!d?.title) continue;
        const lower = d.title.toLowerCase();
        if (!lower.includes(tokenName.toLowerCase()) && !lower.includes(tokenSymbol.toLowerCase())) continue;

        voices.push({
          text: d.title + (d.selftext ? ` — "${d.selftext.slice(0, 200)}"` : ""),
          source: d.subreddit_name_prefixed || "r/unknown",
          url: `https://reddit.com${d.permalink}`,
          isSimulated: false,
        });
      }
    } catch {}
    if (voices.length >= 5) break;
  }

  return voices.slice(0, 5);
}
