app.post("/tv-alert", express.json({ type: "*/*" }), async (req, res) => {
  try {
    let alertContent = "";

    // 如果是 JSON 物件 (例如 {"message":"xxx"})
    if (req.body && typeof req.body === "object") {
      // 最常見格式
      if (req.body.message) {
        alertContent = req.body.message;
      }
      // 另一種 TV 格式
      else if (req.body.alert_message) {
        alertContent = req.body.alert_message;
      }
      // 其他 JSON 就通吃
      else {
        alertContent = JSON.stringify(req.body);
      }
    }

    // 如果 TradingView 傳的是純文字（你的情況）
    if (!alertContent && typeof req.body === "string") {
      alertContent = req.body;
    }

    // 如果還是空（極少見），就直接 fallback
    if (!alertContent) {
      alertContent = "未能解析 TradingView 訊息";
    }

    const targetUser = process.env.TARGET_USER_ID;

    await client.pushMessage(targetUser, {
      type: "text",
      text: `🚨 TV 訊號通知\n${alertContent}`
    });

    res.status(200).send("OK");
  } catch (err) {
    console.error("TV-alert error:", err);
    res.status(500).send("ERROR");
  }
});
