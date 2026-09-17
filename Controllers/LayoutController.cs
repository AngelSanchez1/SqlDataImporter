using Microsoft.AspNetCore.Mvc;
using SqlDataImporter.Models;
using SqlDataImporter.Services;

namespace SqlDataImporter.Controllers
{
    public class LayoutController : Controller
    {
            private readonly IDatabaseMetadataService _databaseMetadataService;
            private readonly ILayoutService _layoutService;

            public LayoutController(
                IDatabaseMetadataService databaseMetadataService,
                ILayoutService layoutService)
            {
                _databaseMetadataService = databaseMetadataService;
                _layoutService = layoutService;
            }

            [HttpPost]
            public async Task<IActionResult> Download(LayoutRequest request)
            {
                var columns =
                    await _databaseMetadataService
                        .GetColumnsAsync(
                            request.Server,
                            request.User,
                            request.Password,
                            request.Database,
                            request.Schema,
                            request.Table);

                if (columns.Count == 0)
                {
                    return BadRequest("No se encontraron columnas.");
                }

                if (request.Format == "xlsx")
                {
                    var file =
                        _layoutService
                            .GenerateExcelLayout(
                                columns,
                                request.Table);

                    return File(
                        file,
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        $"{request.Table}_Layout.xlsx");
                }

                if (request.Format == "csv")
                {
                    var file =
                        _layoutService
                            .GenerateCsvLayout(
                                columns);

                    return File(
                        file,
                        "text/csv; charset=utf-8",
                        $"{request.Table}_Layout.csv");
                }

                return BadRequest(
                    "Formato no soportado.");
            }
        }
    }
