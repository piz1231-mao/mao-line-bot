// ======================================================
// 毛怪秘書 LINE Bot — index.js（線上正式版）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const app = express();

// ======================================================
// 自家 services
// ======================================================
const { get36hrWeather } = require("./services/weather.service");
const { buildWeatherFriendText } = require("./services/weather.text");

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
      if (Array.isArray(mod.commands) && typeof mod.handler === "function") {
        COMMANDS.push(mod);

        global.MAO_COMMANDS.push({
          name: file.replace(".js", ""),
          commands: mod.commands,
          desc: mod.desc || "（尚未提供說明）"
        });

        console.log(`✅ 載入指令模組：${file}`);
      }
    });
}

// ======================================================
// TradingView Webhook（維持原本用途）
// ======================================================
const tvAlert = require("./services/tvAlert");

app.all(
  "/tv-alert",
  express.text({ type: "*/*" }),
  async (req, res) => {
    try {
      let body = {};
      let content = req.body || "";

      if (typeof content === "string") {
        try { body = JSON.parse(content); } catch {}
      }

      const msg = body.message || body.alert || content;
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
// 台指期查詢（Yahoo Finance｜定版）
// ======================================================
async function getTXF() {
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=TXF=F";

  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json, text/plain, */*"
    },
    timeout: 5000
  });

  const q = res.data.quoteResponse.result[0];
  if (!q) throw new Error("No TXF data");

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
// 指令解析（混合模式核心）
// ======================================================
function parseCommand(text) {
  if (!text) return null;
  const t = text.trim();

  // --- ① 精準模式（有冒號）---
  if (t.includes("：")) {
    const [cmd, arg = ""] = t.split("：");
    return {
      mode: "exact",
      command: cmd.trim(),
      arg: arg.trim()
    };
  }

  // --- ② 人性模式（關鍵字在句首）---
  const keywordMap = {
    TXF: ["台指期", "查台指", "看台指"],
    WEATHER: ["天氣", "查天氣", "看天氣"]
  };

  for (const [type, keywords] of Object.entries(keywordMap)) {
    for (const k of keywords) {
      if (t === k || t.startsWith(k + " ")) {
        return {
          mode: "human",
          command: type,
          arg: t.slice(k.length).trim()
        };
      }
    }
  }

  return null;
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

        const parsed = parseCommand(event.message.text);
        if (!parsed) continue; // ❗ 靜默

        // ===== 台指期 =====
        if (
          parsed.command === "台指期" ||
          parsed.command === "TXF"
        ) {
          try {
            const txf = await getTXF();
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: `【台指期即時】
目前：${txf.price}
漲跌：${txf.change > 0 ? "▲" : "▼"}${txf.change.toFixed(0)}（${txf.changePct.toFixed(2)}%）
時間：${txf.time}`
            });
          } catch {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "台指期資料暫時抓不到，晚點再試"
            });
          }
          continue;
        }

        // ===== 天氣（全台）=====
        if (
          parsed.command === "天氣" ||
          parsed.command === "WEATHER"
        ) {
          try {
            const city = parsed.arg || process.env.DEFAULT_CITY || "高雄";
            const result = await get36hrWeather(city);
            const reply = buildWeatherFriendText(result);

            await client.replyMessage(event.replyToken, {
              type: "text",
              text: reply
            });
          } catch {
            await client.replyMessage(event.replyToken, {
              type: "text",
              text: "天氣資料暫時取得失敗，請稍後再試"
            });
          }
          continue;
        }

        // ===== chat 指令模組（混合模式）=====
        for (const cmd of COMMANDS) {
          // 精準
          if (parsed.mode === "exact" && cmd.commands.includes(parsed.command)) {
            await cmd.handler(client, event, parsed.arg);
            break;
          }
          // 人性
          if (
            parsed.mode === "human" &&
            cmd.commands.includes(parsed.command)
          ) {
            await cmd.handler(client, event, parsed.arg);
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
