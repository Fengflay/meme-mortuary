# MEME Mortuary

> Where dead coins get their final roast.

**MEME Mortuary** 是一个基于 AI 的链上 MEME 币"验尸"工具。输入一个 BNB Chain 上的代币合约地址，AI 法医会自动抓取链上数据，分析死因，并生成一份充满黑色幽默的验尸报告。

**线上体验**: https://meme-mortuary.wtty225.workers.dev

---

## 项目背景

MEME 币市场的残酷现实：绝大多数 MEME 币都会归零。但归零之后呢？没有人给它们写讣告，没有人分析它们为什么死，没有人为 bagholder 们的损失默哀。

**MEME Mortuary 就是来填补这个空白的。**

我们用 AI 给每一个死掉的 MEME 币做一次正式的"验尸"，生成一份包含死因分析、生前数据、讣告全文和墓志铭的完整报告——然后把它安葬在链上公墓里。

---

## 核心功能

### 1. AI 验尸报告
- 输入任意 BNB Chain 代币合约地址
- 自动抓取链上数据（BSCScan + DexScreener）
- AI 分析死因并归类（Rug Pull / 流动性枯竭 / 叙事过期 / 鲸鱼砸盘 / 貔貅盘 / 慢性失血 / 死产）
- 生成黑色幽默风格的讣告、墓志铭、遗言
- 计算"离谱指数"（1-10 分）

### 2. MEME 公墓 (Cemetery)
- 所有被验尸过的代币都会被安葬在公墓中
- 墓地风格的网格布局，每个代币一块墓碑
- 统计数据：总埋葬数、最常见死因、平均离谱指数
- 点击墓碑可查看完整验尸报告

### 3. 一键分享
- 生成的报告可一键分享到 X (Twitter)
- 自动组合死因、遗言、墓志铭和离谱指数

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Cloudflare Workers |
| 框架 | Hono |
| 前端 | 原生 HTML/CSS/JS（暗色殡仪馆主题） |
| AI | OpenAI GPT-4o-mini (兼容 dgrid API) |
| 链上数据 | BSCScan API + DexScreener API |
| 存储 | Cloudflare KV (公墓数据持久化) |
| 部署 | Cloudflare Workers (全球边缘节点) |

---

## 项目结构

```
meme-mortuary/
  src/
    index.ts          # Hono API 路由 + KV 存储
    autopsy.ts        # AI 验尸核心逻辑 + Prompt
    chain-data.ts     # 链上数据采集（BSCScan/DexScreener）
  public/
    index.html        # 验尸室主页
    cemetery.html     # MEME 公墓页面
  wrangler.jsonc      # Cloudflare Workers 配置
  .dev.vars           # 本地开发环境变量（不上传）
```

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/autopsy` | 执行验尸，body: `{"address": "0x..."}` |
| GET | `/api/cemetery` | 获取公墓所有记录 |
| GET | `/api/cemetery/:address` | 获取单个代币验尸记录 |
| GET | `/api/health` | 健康检查 |

---

## 本地开发

```bash
# 安装依赖
npm install

# 配置环境变量（在 .dev.vars 中设置）
# BSCSCAN_API_KEY=你的BSCScan API Key
# AI_API_KEY=你的OpenAI API Key

# 启动开发服务器
npm run dev

# 部署到 Cloudflare
npm run deploy
```

---

## 与 Four.Meme AI Sprint 的关系

本项目参加 Four.Meme AI Sprint 黑客松（2026年4月），主题围绕 AI + Web3 + MEME 创新应用。

**为什么做这个项目？**

- MEME 市场缺少"事后分析"工具——所有人都在追涨，没有人研究为什么会归零
- 用 AI 自动化链上数据分析 + 叙事生成，展示 AI Agent 在 Web3 场景下的实际应用价值
- 公墓功能让数据持久化，形成一个不断增长的 MEME 币死亡数据库
- 黑色幽默的包装让严肃的链上分析变得有传播性和娱乐性

---

## 赞助商集成

- **dgrid**: 可切换至 dgrid API 接入 100+ AI 模型（OpenAI 兼容格式）
- **MYX Finance**: 未来可集成合约交易接口，实现 AI 自动化交易策略验证
- **pieverse (x402)**: 未来可集成无 Gas Agent 支付通道

---

## License

MIT
