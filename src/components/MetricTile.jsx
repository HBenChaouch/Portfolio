export default function MetricTile({ label, value, detail, tone = "neutral" }) {
  const detailClass = typeof detail === "string" && /^(\+|-|\()[0-9]+(\.[0-9]+)?%/.test(detail.trim())
    ? "delta"
    : "";

  return (
    <div className={`metric-tile tone-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small className={detailClass}>{detail}</small> : null}
    </div>
  );
}
