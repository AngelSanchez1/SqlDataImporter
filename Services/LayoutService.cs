using ClosedXML.Excel;
using SqlDataImporter.Models;
using System.Text;

namespace SqlDataImporter.Services
{
    public class LayoutService : ILayoutService
    {
        public byte[] GenerateExcelLayout(List<ColumnInfo> columns, string tableName)
        {
            using var workbook =
                new XLWorkbook();

            var worksheet =
                workbook.Worksheets.Add("Datos");

            var exportableColumns =
                columns
                    .Where(x =>
                        !x.IsIdentity &&
                        !x.IsComputed &&
                        x.DataType != "timestamp" &&
                        x.DataType != "rowversion")
                    .ToList();

            for (var i = 0;
                 i < exportableColumns.Count;
                 i++)
            {
                var cell =
                    worksheet.Cell(
                        1,
                        i + 1);

                cell.Value =
                    exportableColumns[i].Name;

                cell.Style.Font.Bold = true;
            }

            worksheet.Columns()
                .AdjustToContents();

            using var stream =
                new MemoryStream();

            workbook.SaveAs(stream);

            return stream.ToArray();
        }

        public byte[] GenerateCsvLayout(List<ColumnInfo> columns)
        {
            var exportableColumns =
                columns
                    .Where(x =>
                        !x.IsIdentity &&
                        !x.IsComputed &&
                        x.DataType != "timestamp" &&
                        x.DataType != "rowversion")
                    .ToList();

            var header =
                string.Join(
                    ",",
                    exportableColumns.Select(
                        x => EscapeCsv(x.Name)));

            // BOM para que Excel reconozca correctamente UTF-8
            var encoding =
                new UTF8Encoding(true);

            return encoding.GetBytes(
                header + Environment.NewLine);
        }

        private string EscapeCsv(
            string value)
        {
            if (value.Contains(',') ||
                value.Contains('"') ||
                value.Contains('\n'))
            {
                return "\""
                    + value.Replace("\"", "\"\"")
                    + "\"";
            }

            return value;
        }
    }
}