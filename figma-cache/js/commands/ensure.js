const runUpsertLikeCommand = require("./upsert-like");

module.exports = function handleEnsure(args, context) {
  runUpsertLikeCommand("ensure", args, context);
};