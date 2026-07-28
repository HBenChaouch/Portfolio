export default function DataTable({
  columns,
  getRowKey,
  highlightColumn = 2,
  label = "Financial data table",
  rowHeaderColumn = null,
  rows,
}) {
  function cellClass(cell, index) {
    const classes = [];
    const value = typeof cell === "string" ? cell.trim() : "";

    if (index === highlightColumn) classes.push("strong");
    if (/^(\+|-|\()[0-9]+(\.[0-9]+)?%/.test(value)) classes.push("delta");

    return classes.join(" ");
  }

  return (
    <div aria-label={label} className="table-scroll" role="region" tabIndex="0">
      <table aria-label={label} className="data-table">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={getRowKey ? getRowKey(row, rowIndex) : `row-${rowIndex}`}>
              {row.map((cell, index) => {
                const Cell = index === rowHeaderColumn ? "th" : "td";
                return (
                  <Cell
                    className={cellClass(cell, index)}
                    key={`cell-${rowIndex}-${index}`}
                    scope={index === rowHeaderColumn ? "row" : undefined}
                  >
                    {cell}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
