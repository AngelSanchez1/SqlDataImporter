using System.Data;
using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using CsvHelper;
using Microsoft.AspNetCore.Mvc;
using SqlDataImporter.Models;
using SqlDataImporter.Services;

namespace SqlDataImporter.Controllers
{
    public class ReportController : Controller
    {
        private readonly IReportExecutionService _reportExecutionService;

        public ReportController(
            IReportExecutionService reportExecutionService
        )
        {
            _reportExecutionService =
                reportExecutionService;
        }


        [HttpGet]
        public IActionResult Index()
        {
            return View(
                new ConnectionRequest()
            );
        }


        // ======================================
        // PREVIEW
        // ======================================

        [HttpPost]
        public async Task<IActionResult> Preview([FromBody] ReportQueryRequest request)
        {
            try
            {
                var table = await _reportExecutionService.ExecuteAsync(request, true);

                var columns =
                    table.Columns
                        .Cast<DataColumn>()
                        .Select(
                            column =>
                                column.ColumnName
                        )
                        .ToList();


                var rows =
                    table.Rows
                        .Cast<DataRow>()
                        .Select(
                            row =>
                                columns
                                    .ToDictionary(
                                        column =>
                                            column,

                                        column =>
                                            row[column]
                                                == DBNull.Value
                                                ? null
                                                : row[column]
                                    )
                        )
                        .ToList();


                return Json(
                    new
                    {
                        success = true,
                        columns,
                        rows,
                        totalRows = table.Rows.Count
                    }
                );
            }
            catch (Exception ex)
            {
                return BadRequest(
                    new
                    {
                        success = false,
                        message = ex.Message
                    }
                );
            }
        }


        // ======================================
        // EXCEL
        // ======================================

        [HttpPost]
        public async Task<IActionResult> ExportExcel([FromBody] ReportQueryRequest request)
        {
            try
            {
                var table = await _reportExecutionService.ExecuteAsync(request, false);

                using var workbook = BuildExcel(table, request.Database, request.NombreReporte);
                using var stream = new MemoryStream();

                workbook.SaveAs(stream);

                var fileName = $"{request.NombreReporte}_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

                return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
            }
            catch (Exception ex)
            {
                return BadRequest(
                    new
                    {
                        success = false,
                        message = ex.Message
                    }
                );
            }
        }

        // ======================================
        // CSV
        // ======================================
        [HttpPost]
        public async Task<IActionResult> ExportCsv([FromBody] ReportQueryRequest request)
        {
            try
            {
                var table = await _reportExecutionService.ExecuteAsync(request, false);
                var bytes = BuildCsv(table);
                var fileName = $"{request.NombreReporte}_{DateTime.Now:yyyyMMdd_HHmmss}.csv";

                return File(
                    bytes,
                    "text/csv; charset=utf-8",
                    fileName
                );
            }
            catch (Exception ex)
            {
                return BadRequest(
                    new
                    {
                        success = false,
                        message = ex.Message
                    }
                );
            }
        }

        private static XLWorkbook BuildExcel(DataTable table, string database, string nombreReporte)
        {
            var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Reporte");
            var totalColumns = Math.Max(table.Columns.Count, 1);

            // ==========================================
            // COLORES DEL SISTEMA
            // ==========================================
            var navy = XLColor.FromHtml("#173B57");
            var blue = XLColor.FromHtml("#2474A6");
            var cyan = XLColor.FromHtml("#2AA7B8");
            var light = XLColor.FromHtml("#F4F8FB");

            // ==========================================
            // TÍTULO
            // ==========================================
            worksheet.Range(1, 1, 1, totalColumns).Merge();

            var title = worksheet.Cell(1, 1);

            title.Value = nombreReporte;
            title.Style.Fill.BackgroundColor = navy;
            title.Style.Font.FontColor = XLColor.White;
            title.Style.Font.Bold = true;
            title.Style.Font.FontSize = 16;
            title.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            title.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

            worksheet.Row(1).Height =30;

            // ==========================================
            // INFORMACIÓN
            // ==========================================
            worksheet.Range(2, 1,2, totalColumns).Merge();

            var info = worksheet.Cell(2, 1);

            info.Value = $"Base de datos: {database}    |    Generado: {DateTime.Now:dd/MM/yyyy HH:mm:ss}";
            info.Style.Fill.BackgroundColor = light;
            info.Style.Font.FontColor = navy;
            info.Style.Font.Italic = true;

            // ==========================================
            // ENCABEZADOS
            // ==========================================
            const int headerRow = 4;

            for (var i = 0; i < table.Columns.Count; i++)
            {
                var cell = worksheet.Cell(headerRow, i + 1);
                cell.Value = table.Columns[i].ColumnName;
                cell.Style.Fill.BackgroundColor = blue;
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Font.Bold = true;
                cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
                cell.Style.Border.BottomBorder = XLBorderStyleValues.Thin;
                cell.Style.Border.BottomBorderColor = cyan;
            }

            worksheet.Row(headerRow).Height = 24;

            // ==========================================
            // DATOS
            // ==========================================
            var rowIndex = headerRow + 1;

            foreach (DataRow row in table.Rows)
            {
                for (var columnIndex = 0; columnIndex < table.Columns.Count; columnIndex++)
                {
                    var value = row[columnIndex];
                    var cell = worksheet.Cell(rowIndex, columnIndex + 1);

                    if (value == DBNull.Value)
                    {
                        cell.Value = string.Empty;
                    }
                    else
                    {
                        cell.Value = XLCellValue.FromObject(value);
                    }
                }

                if ((rowIndex - headerRow) % 2 == 0)
                {
                    worksheet.Range(
                        rowIndex,
                        1,
                        rowIndex,
                        totalColumns
                    )
                    .Style.Fill
                    .BackgroundColor = light;
                }

                rowIndex++;
            }

            // ==========================================
            // FILTRO
            // ==========================================
            if (table.Columns.Count > 0)
            {
                var lastRow = Math.Max(headerRow, rowIndex - 1);
                worksheet.Range(headerRow,1, lastRow, table.Columns.Count).SetAutoFilter();
            }

            // ==========================================
            // FREEZE
            // ==========================================
            worksheet.SheetView.FreezeRows(headerRow);

            // ==========================================
            // ANCHOS
            // ==========================================
            worksheet.Columns().AdjustToContents();

            foreach (var column in worksheet.ColumnsUsed())
            {
                if (column.Width > 45)
                {
                    column.Width = 45;
                }

                if (column.Width < 12)
                {
                    column.Width = 12;
                }
            }

            worksheet.RangeUsed()?.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

            return workbook;
        }

        private static byte[] BuildCsv(DataTable table)
        {
            using var memoryStream = new MemoryStream();

            using (
                var writer =
                    new StreamWriter(
                        memoryStream,
                        new UTF8Encoding(
                            true
                        ),
                        leaveOpen: true
                    )
            )
            {
                using var csv = new CsvWriter(writer,CultureInfo.InvariantCulture);

                // Encabezados
                foreach (DataColumn column in table.Columns)
                {
                    csv.WriteField(column.ColumnName);
                }

                csv.NextRecord();

                // Datos
                foreach (DataRow row in table.Rows)
                {
                    foreach (DataColumn column in table.Columns)
                    {
                        var value = row[column];
                        csv.WriteField(value == DBNull.Value ? null : value);
                    }

                    csv.NextRecord();
                }

                writer.Flush();
            }

            return memoryStream.ToArray();
        }
    }
}