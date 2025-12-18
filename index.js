// ======================================================
// 毛怪秘書 LINE Bot — index.js（最終封板穩定版）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");

const app = express();

// ======================================================
// LINE 設定（⚠️ 使用正確官方環境變數）
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
// 全域指令清單（給 help 用）
// ======================================================
global.MAO_COMMANDS = [];

// ======================================================
// 載入聊天指令（commands/chat）
// ======================================================
const COMMANDS = [];
const commandsDir = path.join(__dirname, "commands/chat");

if (fs.existsSync(commandsDir)) {
  fs.readdirSync(commandsDir)
    .filter(f => f.endsWith(".js"))
    .forEach(file => {
      const mod = require(path.join(commandsDir, file));
      if (Array.isArray(mod.keywords) && typeof mod.handler === "function") {
        COMMANDS.push({
          keywords: mod.keywords.map(k => k.toLowerCase()),
          handler: mod.handler
        });

        global.MAO_COMMANDS.push({
          name: file.replace(".js", ""),
          keywords: mod.keywords,
          desc: mod.desc || "（尚未提供說明）"
        });

        console.log(`✅ 載入指令模組：${file}`);
      }
    });
}

// ======================================================
// TradingView 服務（⚠️ 只給 tv-alert 用 text）
// ======================================================
const tvAlert = require("./services/tvAlert");

app.all(
  "/tv-alert",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      console.log("🚨 TradingView 進來", req.method);

      let body = {};
      let content = req.body || "";

      if (typeof content === "string") {
        try {
          body = JSON.parse(content);
        } catch {}
      }

      const msg =
        body.message ||
        body.alert ||
        content;

      const price = body.close ?? body.price ?? null;

      await tvAlert(client, msg, { ...body, price });
      res.status(200).send("OK");
    } catch (err) {
      console.error("❌ TV Webhook Error:", err);
      res.status(200).send("OK");
    }
  }
);

// ======================================================
// LINE Webhook（⚠️ 不可被任何 bodyParser 汙染）
// ======================================================
app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    try {
      for (const event of req.body.events || []) {
        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const clean = event.message.text
          .replace(/\s/g, "")
          .toLowerCase();

        for (const cmd of COMMANDS) {
          if (cmd.keywords.some(k => clean.includes(k))) {
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
  }
);

// ======================================================
// 啟動 Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務啟動，監聽 PORT ${PORT}`);
});
