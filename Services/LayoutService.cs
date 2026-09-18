using ClosedXML.Excel;
using SqlDataImporter.Models;
using System.Text;

namespace SqlDataImporter.Services
{
    public class LayoutService : ILayoutService
    {
        public byte[] GenerateExcelLayout(List<ColumnInfo> columns, string tableName)
        {
            using var workbook = new XLWorkbook();

            // ==========================================
            // PALETA DEL SISTEMA
            // ==========================================

            var navy = XLColor.FromHtml("#003B75");
            var blue = XLColor.FromHtml("#2F80ED");
            var cyan = XLColor.FromHtml("#22C7C9");
            var lightBlue = XLColor.FromHtml("#EAF3FF");
            var lightGray = XLColor.FromHtml("#F5F7FA");
            var borderColor = XLColor.FromHtml("#D8E1EB");
            var textColor = XLColor.FromHtml("#1F2937");

            var exportableColumns =
                columns
                    .Where(x =>
                        !x.IsIdentity &&
                        !x.IsComputed &&
                        !string.Equals(
                            x.DataType,
                            "timestamp",
                            StringComparison.OrdinalIgnoreCase) &&
                        !string.Equals(
                            x.DataType,
                            "rowversion",
                            StringComparison.OrdinalIgnoreCase))
                    .ToList();


            // ==========================================
            // HOJA DATOS
            // ==========================================

            var worksheet = workbook.Worksheets.Add("Datos");

            worksheet.TabColor =navy;

            for (var i = 0; i < exportableColumns.Count; i++)
            {
                var column = exportableColumns[i];
                var cell = worksheet.Cell(1, i + 1);

                cell.Value = column.Name;
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Fill.BackgroundColor = navy;
                cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Border.BottomBorder = XLBorderStyleValues.Thick;
                cell.Style.Border.BottomBorderColor = cyan;
                cell.Style.Border.LeftBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.LeftBorderColor = borderColor;
                cell.Style.Border.RightBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.RightBorderColor = borderColor;
            }

            // ==========================================
            // ALTURA CABECERA
            // ==========================================
            worksheet.Row(1).Height = 28;

            // ==========================================
            // CONGELAR CABECERA
            // ==========================================
            worksheet.SheetView.FreezeRows(1);

            // ==========================================
            // AUTOFILTRO
            // ==========================================
            if (exportableColumns.Count > 0)
            {
                worksheet.Range(1, 1, 1, exportableColumns.Count).SetAutoFilter();
            }

            // ==========================================
            // AJUSTAR COLUMNAS
            // ==========================================
            worksheet.Columns().AdjustToContents();

            foreach (var excelColumn in worksheet.ColumnsUsed())
            {
                if (excelColumn.Width < 14)
                {
                    excelColumn.Width = 14;
                }

                if (excelColumn.Width > 35)
                {
                    excelColumn.Width = 35;
                }
            }

            // ==========================================
            // CONFIGURACIÓN VISUAL
            // ==========================================
            worksheet.ShowGridLines = false;

            // ==========================================
            // HOJA DE INSTRUCCIONES
            // ==========================================
            var instructions = workbook.Worksheets.Add("Instrucciones");

            instructions.TabColor = blue;
            instructions.Cell("A1").Value = $"Plantilla de importación - {tableName}";
            instructions.Range("A1:E1").Merge();
            instructions.Cell("A1").Style.Font.Bold = true;
            instructions.Cell("A1").Style.Font.FontSize = 16;
            instructions.Cell("A1").Style.Font.FontColor = XLColor.White;
            instructions.Cell("A1").Style.Fill.BackgroundColor = navy;
            instructions.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            instructions.Row(1).Height = 30;
            instructions.Cell("A3").Value = "Columna";
            instructions.Cell("B3").Value = "Tipo SQL";
            instructions.Cell("C3").Value = "Obligatoria";
            instructions.Cell("D3").Value = "Longitud";
            instructions.Cell("E3").Value = "Observaciones";


            var instructionHeader =instructions.Range("A3:E3");

            instructionHeader.Style.Font.Bold = true;
            instructionHeader.Style.Font.FontColor =XLColor.White;
            instructionHeader.Style.Fill.BackgroundColor = blue;
            instructionHeader.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            // ==========================================
            // DETALLE DE COLUMNAS
            // ==========================================
            var row = 4;

            foreach (var column in exportableColumns)
            {
                instructions.Cell(row, 1).Value = column.Name;
                instructions.Cell(row, 2).Value = GetSqlTypeDescription(column);
                instructions.Cell(row,3).Value = column.IsNullable ? "No" : "Sí";
                instructions.Cell(row,4).Value =  GetColumnLength(column);
                instructions.Cell(row,5).Value = column.DefaultValue != null ? $"Valor predeterminado: {column.DefaultValue}" : "";

                var range = instructions.Range(row, 1, row, 5);

                range.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
                range.Style.Border.BottomBorderColor = borderColor;

                if (row % 2 == 0)
                {
                    range.Style.Fill.BackgroundColor = lightGray;
                }

                row++;
            }

            instructions.Columns().AdjustToContents();

            foreach (var excelColumn in instructions.ColumnsUsed())
            {
                if (excelColumn.Width > 45)
                {
                    excelColumn.Width = 45;
                }
            }

            instructions.SheetView.FreezeRows(3);
            instructions.ShowGridLines = false;


            // ==========================================
            // MENSAJE INFERIOR
            // ==========================================

            row += 2;

            instructions.Cell(row,1).Value = "Importante:";
            instructions.Cell(row,1).Style.Font.Bold = true;
            instructions.Cell(row,1).Style.Font.FontColor = navy;
            instructions.Cell(row + 1, 1).Value = "No cambie los nombres de las columnas de la fila 1 de la hoja Datos.";
            instructions.Range(row + 1, 1, row + 1, 5).Merge();
            instructions.Cell(row + 1, 1).Style.Fill.BackgroundColor = lightBlue;
            instructions.Cell(row + 1, 1).Style.Font.FontColor = textColor;
            instructions.Cell(row + 2, 1).Value = "Capture los registros a partir de la fila 2.";
            instructions.Range(row + 2, 1, row + 2, 5).Merge();

            // ==========================================
            // GUARDAR
            // ==========================================
            using var stream = new MemoryStream();

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

        private string GetSqlTypeDescription(ColumnInfo column)
        {
            var type = column.DataType.ToLowerInvariant();

            if (type == "varchar" || type == "char")
            {
                var length = column.MaxLength == -1 ? "MAX" : column.MaxLength.ToString();

                return $"{column.DataType}({length})";
            }


            if (type == "nvarchar" || type == "nchar")
            {
                var length = column.MaxLength == -1 ? "MAX" : (column.MaxLength / 2).ToString();

                return $"{column.DataType}({length})";
            }


            if (type == "decimal" || type == "numeric")
            {
                return $"{column.DataType}" + $"({column.Precision},{column.Scale})";
            }

            return column.DataType;
        }

        private string GetColumnLength(ColumnInfo column)
        {
            var type = column.DataType.ToLowerInvariant();

            if (type != "varchar" && type != "nvarchar" && type != "char" && type != "nchar")
            {
                return "-";
            }

            if (column.MaxLength == -1)
            {
                return "MAX";
            }

            if (type == "nvarchar" || type == "nchar")
            {
                return (column.MaxLength / 2).ToString();
            }

            return column.MaxLength.ToString();
        }
    }
}