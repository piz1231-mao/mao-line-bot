// ======================================================
// 毛怪秘書 LINE Bot — index.js（中控基準版）
// 職責：
// 1. 啟動 Express / LINE Client
// 2. TradingView Webhook (/tv-alert)
// 3. LINE Webhook 指令分流（commands）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

// ===== 指令模組（你已經都有）=====
const handleId        = require("./commands/id");
const handleTodo      = require("./commands/todo");
const handleHelp      = require("./commands/help");
const handleInterview = require("./commands/interview");
const handleComplaint = require("./commands/complaint");
// 👉 之後新增功能，只要在這裡多 require 一行

const tvAlert = require("./commands/tvAlert");

const app = express();

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ LINE_ACCESS_TOKEN / LINE_SECRET 未設定");
  process.exit(1);
}

const client = new line.Client(config);

// ======================================================
// Debug：GET /tv-alert（確認 Render 路由）
// ======================================================
app.get("/tv-alert", (req, res) => {
  console.log("🟡 GET /tv-alert 進來了（Render 路由正常）");
  res.status(200).send("OK");
});

// ======================================================
// TradingView Webhook（POST /tv-alert）
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
// LINE Webhook（指令中控）
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    for (const event of req.body.events) {

      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const text = event.message.text.trim();
      const clean = text.replace(/\s/g, "").toLowerCase();

      // ==============================
      // 指令分流（只做「判斷」，不寫邏輯）
      // ==============================

      if (["help", "指令", "說明"].includes(clean)) {
        await handleHelp(client, event);
        continue;
      }

      if (["查id", "我的id", "群組id", "查群組"].includes(clean)) {
        await handleId(client, event);
        continue;
      }

      if (clean.startsWith("待辦")) {
        await handleTodo(client, event);
        continue;
      }

      if (clean.startsWith("面試")) {
        await handleInterview(client, event);
        continue;
      }

      if (clean.startsWith("客怨")) {
        await handleComplaint(client, event);
        continue;
      }

      // 👉 之後新功能只要在這裡加一個 if
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ LINE Webhook Error:", err);
    res.status(500).end();
  }
});

// ======================================================
// 啟動 Server（Render 使用 PORT）
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務已啟動，監聽 PORT ${PORT}`);
});
