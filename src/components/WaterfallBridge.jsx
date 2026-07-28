export default function WaterfallBridge({
  ariaLabel,
  children,
  className = "waterfall-wrap",
}) {
  return (
    <div aria-label={ariaLabel} className={className} role="group">
      {children}
    </div>
  );
}
