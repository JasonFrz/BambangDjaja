export const toUtcRange = (startDate, endDate) => ({
  start: new Date(`${startDate}T00:00:00+07:00`).toISOString(),
  end: new Date(`${endDate}T23:59:59.999+07:00`).toISOString(),
});

export const formatDuration = (seconds) => {
  if (seconds === null || seconds === undefined || seconds === "") return "-";
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total < 0) return "-";
  const parts = [
    [Math.floor(total / 86400), "h"],
    [Math.floor((total % 86400) / 3600), "j"],
    [Math.floor((total % 3600) / 60), "m"],
    [total % 60, "d"],
  ]
    .filter(([n]) => n > 0)
    .map(([n, unit]) => `${n}${unit}`);
  return parts.length > 0 ? parts.join(" ") : "0d";
};
