export default function MetricTile({
  detail,
  detailClassName = "",
  label,
  meta,
  outputId,
  tone = "neutral",
  value,
}) {
  return (
    <div className={`metric-tile tone-${tone}`} data-output-id={outputId}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small className={detailClassName}>{detail}</small> : null}
      {meta ? <small className="metric-meta">{meta}</small> : null}
    </div>
  );
}
