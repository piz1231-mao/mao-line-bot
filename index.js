// ======================================================
// 毛怪秘書 LINE Bot — index.js（Debug 完整版）
// 用途：
// 1. 確認 LINE Webhook 是否真的進來
// 2. 自動載入聊天指令（commands/chat）
// 3. TradingView Webhook（services/tvAlert）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

const app = express();

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ LINE_ACCESS_TOKEN 或 LINE_SECRET 未設定");
  process.exit(1);
}

const client = new line.Client(config);

// ======================================================
// ⭐ Debug：任何 request 都先印出來（保命用）
// ======================================================
app.use((req, res, next) => {
  console.log("➡️ HTTP 進來：", req.method, req.url);
  next();
});

// ======================================================
// 自動載入聊天指令（只掃 commands/chat）
// ======================================================
const COMMANDS = [];
const commandsDir = path.join(__dirname, "commands/chat");

if (fs.existsSync(commandsDir)) {
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
          COMMANDS.push({
            name: file.replace(".js", ""),
            keywords: mod.keywords.map(k => k.toLowerCase()),
            handler: mod.handler
          });
          console.log(`✅ 載入指令模組：${file}`);
        } else {
          console.warn(`⚠️ 指令模組格式不符，略過：${file}`);
        }
      } catch (err) {
        console.error(`❌ 載入指令失敗：${file}`, err.message);
      }
    });
} else {
  console.warn("⚠️ commands/chat 資料夾不存在");
}

// ======================================================
// TradingView 服務模組（不參與指令掃描）
// ======================================================
const tvAlert = require("./services/tvAlert");

// ======================================================
// Debug：GET /tv-alert（測 Render 路由）
// ======================================================
app.get("/tv-alert", (req, res) => {
  console.log("🟡 GET /tv-alert 進來了（Render 路由正常）");
  res.status(200).send("OK");
});

// ======================================================
// TradingView Webhook：POST /tv-alert
// ======================================================
app.post(
  "/tv-alert",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      console.log("🚨 收到 TradingView POST");

      let body = {};
      let content = "";
      const raw = req.body || "";

      if (typeof raw === "string") {
        try {
          body = JSON.parse(raw);
        } catch {
          content = raw;
        }
      }

      if (body && typeof body === "object") {
        content = body.message || body.alert || content;
      }

      const price = body.close ?? body.price ?? null;

      await tvAlert(client, content, {
        ...body,
        price
      });

      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ TradingView Webhook Error:", err);
      res.status(500).send("ERROR");
    }
  }
);

// ======================================================
// ⭐ LINE Webhook（重點 Debug 在這）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    console.log("🔥 LINE Webhook 進來了");
    console.log("📦 原始事件內容：");
    console.log(JSON.stringify(req.body, null, 2));

    for (const event of req.body.events || []) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const text = event.message.text.trim();
      const clean = text.replace(/\s/g, "").toLowerCase();

      console.log("✏️ 收到文字訊息：", text);

      for (const cmd of COMMANDS) {
        if (cmd.keywords.some(k => clean.startsWith(k))) {
          console.log(`🎯 命中指令：${cmd.name}`);
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
// 啟動 Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務已啟動，監聽 PORT ${PORT}`);
});
