const runUpsertLikeCommand = require("./upsert-like");

module.exports = function handleUpsert(args, context) {
  runUpsertLikeCommand("upsert", args, context);
};