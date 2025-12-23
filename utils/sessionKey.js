// utils/sessionKey.js
function getSessionKey(event) {
  const userId = event.source.userId;
  const sourceId =
    event.source.type === "group"
      ? event.source.groupId
      : event.source.type === "room"
      ? event.source.roomId
      : event.source.userId;

  return `${userId}:${sourceId}`;
}

module.exports = { getSessionKey };
