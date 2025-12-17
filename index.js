// ======================================================
// 毛怪秘書 LINE Bot v2.3 — index.js（最終穩定版）
// 功能：
// 1. LINE Bot 基礎啟動
// 2. TradingView Webhook（/tv-alert）
// 3. Debug GET /tv-alert（確認 Render 路由）
// ======================================================

require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");

// ✅【重點修正】正確指向 commands/tvAlert.js
const tvAlert = require("./commands/tvAlert");

const app = express();

// ======================================================
// LINE 設定
// ======================================================
const config = {
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
  channelSecret: process.env.LINE_SECRET
};

// 防呆：啟動時就檢查環境變數
if (!config.channelAccessToken || !config.channelSecret) {
  console.error("❌ LINE 環境變數未設定（LINE_ACCESS_TOKEN / LINE_SECRET）");
  process.exit(1);
}

const client = new line.Client(config);

// ======================================================
// ⭐ Debug 用：GET /tv-alert
// 用瀏覽器打 https://xxx.onrender.com/tv-alert
// ======================================================
app.get("/tv-alert", (req, res) => {
  console.log("🟡 GET /tv-alert 進來了（Render 路由正常）");
  res.status(200).send("OK");
});

// ======================================================
// ⭐ TradingView Webhook：POST /tv-alert
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

      // 嘗試解析 JSON
      if (typeof raw === "string") {
        try {
          body = JSON.parse(raw);
        } catch {
          content = raw;
        }
      }

      // 從 payload 抓訊息
      if (body && typeof body === "object") {
        content = body.message || body.alert || content;
      }

      // 價格（若有）
      const price = body.close ?? body.price ?? null;

      // 呼叫推播模組
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
// （可選）LINE Webhook（之後接指令用）
// 目前不影響 TV 功能
// ======================================================
app.post("/webhook", line.middleware(config), async (req, res) => {
  console.log("📩 LINE Webhook 收到事件數：", req.body.events?.length || 0);
  res.status(200).send("OK");
});

// ======================================================
// 啟動 Server（Render 使用 PORT 環境變數）
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 毛怪秘書服務已啟動，監聽 PORT ${PORT}`);
});
