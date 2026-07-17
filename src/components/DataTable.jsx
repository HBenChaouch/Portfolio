export default function DataTable({ columns, rows, highlightColumn = 2, label = "Financial data table" }) {
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
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`}>
              {row.map((cell, index) => (
                <td className={cellClass(cell, index)} key={`cell-${rowIndex}-${index}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
