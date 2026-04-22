module.exports = function handleStale(args, context) {
  const { parseTailWithCli, defaultStaleDays, printStale } = context;
  const { values } = parseTailWithCli(args, {
    strings: ["days"],
    booleanFlags: [],
  });
  const daysRaw = (values.days || "").trim();
  const parsed = daysRaw ? Number(daysRaw) : defaultStaleDays;
  const days = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultStaleDays;
  printStale(days);
};