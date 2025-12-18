// ======================================================
// 毛怪秘書 LINE Bot — index.js（最終封板穩定版＋本機防呆）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();

// ======================================================
// LINE 設定
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
// 全域指令清單
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
// TradingView 服務（本機防呆）
// ======================================================
let tvAlert = null;
try {
  tvAlert = require("./services/tvAlert");
  console.log("✅ tvAlert 模組已載入");
} catch (e) {
  console.warn("⚠️ tvAlert 模組未載入（本機測試模式）");
}

app.all(
  "/tv-alert",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      if (!tvAlert) {
        res.status(200).send("OK");
        return;
      }

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
// 台指期查詢（A 版｜定版）
// ======================================================
async function getTXF() {
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=TXF=F";

  const res = await axios.get(url);
  const q = res.data.quoteResponse.result[0];

  return {
    price: q.regularMarketPrice,
    change: q.regularMarketChange,
    changePct: q.regularMarketChangePercent,
    time: new Date(q.regularMarketTime * 1000).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit"
    })
  };
}

// ======================================================
// LINE Webhook
// ======================================================
app.post(
  "/webhook",
  line.middleware(config),
  async (req, res) => {
    try {
      for (const event of req.body.events || []) {
        if (event.type !== "message") continue;
        if (event.message.type !== "text") continue;

        const rawText = event.message.text || "";
        const clean = rawText.replace(/\s/g, "").toLowerCase();

        // ===== 台指期查詢（優先）=====
        if (clean.includes("台指期")) {
          try {
            const txf = await getTXF();

            const reply = `【台指期即時】
目前：${txf.price}
漲跌：${txf.change > 0 ? "▲" : "▼"}${txf.change.toFixed(0)}（${txf.changePct.toFixed(2)}%）
時間：${txf.time}`;

            await client.replyMessage(event.replyToken, {
              type: "text",
              text: reply
            });
          } catch {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "台指期資料暫時抓不到，晚點再試"
            });
          }
          continue;
        }

        // ===== 原本指令模組 =====
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
