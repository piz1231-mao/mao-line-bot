// commands/tvAlert.js

module.exports = async function tvAlert(client, alertMessage, targetUser) {
  try {
    await client.pushMessage(targetUser, {
      type: "text",
      text: `🚨 TV 訊號通知\n${alertMessage}`
    });
    return true;
  } catch (err) {
    console.error("TV Alert 發送失敗：", err);
    return false;
  }
};
