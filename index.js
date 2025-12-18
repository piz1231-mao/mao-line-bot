// ======================================================
// 毛怪秘書 LINE Bot — index.js（最終封板穩定版）
// 功能：
// 1. LINE Webhook（聊天指令）
// 2. 自動載入 commands/chat 指令模組
// 3. HELP 指令自動彙整 desc
// 4. TradingView Webhook（/tv-alert，GET + POST 通吃）
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
// 全域指令清單（給 HELP 用）
// ======================================================
global.MAO_COMMANDS = [];

// ======================================================
// 自動載入聊天指令（只掃 commands/chat）
// ======================================================
const COMMANDS = [];
const commandsDir = path.join(__dirname, "commands/chat");

if (!fs.existsSync(commandsDir)) {
  console.warn("⚠️ commands/chat 資料夾不存在，未載入聊天指令");
} else {
  fs.readdirSync(commandsDir)
    .filter(f => f.endsWith(".js"))
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

          global.MAO_COMMANDS.push({
            name: file.replace(".js", ""),
            keywords: mod.keywords,
            desc: mod.desc || "（尚未提供說明）"
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
// TradingView 推播模組
// ======================================================
const tvAlert = require("./services/tvAlert");

// ======================================================
// Debug：GET /tv-alert（確認 Render 路由）
// ======================================================
app.get("/tv-alert", (req, res) => {
  console.log("🟡 GET /tv-alert（Render 路由正常）");
  res.status(200).send("OK");
});

// ======================================================
// TradingView Webhook（GET + POST 通吃，最終保險）
// ======================================================
app.all("/tv-alert", express.text({ type: "*/*" }), async (req, res) => {
  try {
    console.log("🚨 TradingView 打進來了");
    console.log("➡️ Method:", req.method);

    let body = {};
    let content = "";
    const raw = req.body || "";

    if (typeof raw === "string" && raw.length) {
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

    // ⚠️ 一定回 200，避免 TradingView 放棄
    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ TradingView Webhook Error:", err);
    res.status(200).send("OK");
  }
});

// ======================================================
// LINE Webhook（聊天指令分流）
// includes → 解決「查id 打不出來」問題
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events || []) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const text = event.message.text.trim();
      const clean = text.replace(/\s/g, "").toLowerCase();

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
});

// ======================================================
// 啟動 Server（Render 指定 PORT）
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務已啟動，監聽 PORT ${PORT}`);
});
