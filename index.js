// ======================================================
// 毛怪秘書 LINE Bot — index.js（最終穩定完整版）
// 功能：
// 1. LINE Webhook
// 2. 自動載入聊天指令（commands/chat）
// 3. HELP 指令自動顯示「指令＋說明」
// 4. TradingView Webhook（services/tvAlert）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

const app = express();

// ======================================================
// middleware（順序固定，Render 穩定）
// ======================================================
app.use(express.json());
app.use(express.text({ type: "*/*" }));

// ======================================================
// LINE 設定（⚠️ 已修正為正確 env 名稱）
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ LINE_CHANNEL_ACCESS_TOKEN 或 LINE_CHANNEL_SECRET 未設定");
  process.exit(1);
}

const client = new line.Client(config);

// ======================================================
// 全域指令清單（給 HELP 用）
// ======================================================
global.MAO_COMMANDS = [];

// ======================================================
// 自動載入聊天指令（只掃 commands/chat）
// ======================================================
const COMMANDS = [];
const commandsDir = path.join(__dirname, "commands/chat");

if (!fs.existsSync(commandsDir)) {
  console.warn("⚠️ commands/chat 資料夾不存在，未載入任何聊天指令");
} else {
  fs.readdirSync(commandsDir)
    .filter(file => file.endsWith(".js"))
    .forEach(file => {
      try {
        const mod = require(path.join(commandsDir, file));

        if (
          mod &&
          Array.isArray(mod.keywords) &&
          typeof mod.handler === "function"
        ) {
          const name = file.replace(".js", "");
          const keywords = mod.keywords.map(k => k.toLowerCase());
          const desc = mod.desc || "（尚未提供說明）";

          COMMANDS.push({
            name,
            keywords,
            handler: mod.handler
          });

          global.MAO_COMMANDS.push({
            name,
            keywords: mod.keywords,
            desc
          });

          console.log(`✅ 載入指令模組：${file}`);
        } else {
          console.warn(`⚠️ 指令模組格式不符，略過：${file}`);
        }
      } catch (err) {
        console.error(`❌ 載入指令失敗：${file}`, err.message);
      }
    });
}

// ======================================================
// TradingView 服務模組
// ======================================================
const tvAlert = require("./services/tvAlert");

// ======================================================
// Health Check（Render 需要）
// ======================================================
app.get("/", (req, res) => {
  res.send("毛怪祕書 running");
});

// ======================================================
// Debug：GET /tv-alert（確認路由活著）
// ======================================================
app.get("/tv-alert", (req, res) => {
  console.log("🟡 GET /tv-alert 進來了");
  res.status(200).send("OK");
});

// ======================================================
// TradingView Webhook：POST /tv-alert（關鍵）
// ======================================================
app.post("/tv-alert", async (req, res) => {
  try {
    console.log("🚨 收到 TradingView Webhook");
    console.log("🧪 RAW body =", req.body);

    let content = "";
    let payload = {};

    // JSON or 文字 都能吃
    if (typeof req.body === "string") {
      try {
        payload = JSON.parse(req.body);
        content = payload.message || payload.alert || "";
      } catch {
        content = req.body;
        payload = {};
      }
    } else if (typeof req.body === "object" && req.body !== null) {
      payload = req.body;
      content = payload.message || payload.alert || "";
    }

    // 嘗試補 price
    const price = payload.close ?? payload.price ?? null;

    await tvAlert(client, content, {
      ...payload,
      price
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ TradingView Webhook Error:", err);
    res.status(500).send("ERROR");
  }
});

// ======================================================
// LINE Webhook（聊天指令）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events || []) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const text = event.message.text.trim();
      const clean = text.replace(/\s/g, "").toLowerCase();

      for (const cmd of COMMANDS) {
        if (cmd.keywords.some(k => clean.startsWith(k))) {
          await cmd.handler(client, event);
          break;
        }
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ LINE Webhook Error:", err);
    res.status(500).end();
  }
});

// ======================================================
// 啟動 Server（Render 會指定 PORT）
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪祕書服務已啟動，監聽 PORT ${PORT}`);
});
