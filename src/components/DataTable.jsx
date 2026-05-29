export default function DataTable({ columns, rows, highlightColumn = 2 }) {
  function cellClass(cell, index) {
    const classes = [];
    const value = typeof cell === "string" ? cell.trim() : "";

    if (index === highlightColumn) classes.push("strong");
    if (/^(\+|-|\()[0-9]+(\.[0-9]+)?%/.test(value)) classes.push("delta");

    return classes.join(" ");
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
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
