using Microsoft.AspNetCore.Mvc;
using SqlDataImporter.Models;
using SqlDataImporter.Services;

namespace SqlDataImporter.Controllers
{
    public class ImportController : Controller
    {
        private readonly IDatabaseMetadataService _databaseMetadataService;
        private readonly ISqlImportService _sqlImportService;
        private readonly IImportFileReaderService _importFileReaderService;

        public ImportController(
            IDatabaseMetadataService databaseMetadataService,
            ISqlImportService sqlImportService,
            IImportFileReaderService importFileReaderService)
        {
            _databaseMetadataService = databaseMetadataService;
            _sqlImportService = sqlImportService;
            _importFileReaderService = importFileReaderService;
        }


        [HttpGet]
        public IActionResult Index()
        {
            return View(
                new ConnectionRequest()
            );
        }

        [HttpPost]
        public async Task<IActionResult> Validate(ImportRequest request)
        {
            try
            {
                ValidateBasicRequest(request);

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
                    return BadRequest(new
                    {
                        success = false,
                        message ="No se encontraron columnas para la tabla seleccionada."
                    });
                }

                var importColumns = GetImportColumns(columns);

                ValidateRuleColumns(request.RuleColumns,importColumns);

                var data =
                    await _importFileReaderService
                        .ReadAsync(
                            request.File!,
                            importColumns,
                            request.RuleColumns);

                if (data.Rows.Count == 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "El archivo no contiene registros para importar."
                    });
                }


                return Ok(new
                {
                    success = true,
                    message = "El archivo fue validado correctamente.",
                    target = $"{request.Database}.{request.Schema}.{request.Table}",
                    file = request.File!.FileName,
                    totalRows = data.Rows.Count,
                    ruleColumns = request.RuleColumns,
                    tableColumns = importColumns.Select(x => x.Name)
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(
                    500,
                    new
                    {
                        success = false,
                        message = "Ocurrió un error al validar el archivo: " + ex.Message
                    });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Execute(ImportRequest request)
        {
            try
            {

                ValidateBasicRequest(request);

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
                    return BadRequest(new
                    {
                        success = false,
                        message = "La tabla seleccionada no existe."
                    });
                }

                var importColumns = GetImportColumns(columns);

                ValidateRuleColumns(request.RuleColumns, importColumns);

                var data =
                    await _importFileReaderService
                        .ReadAsync(
                            request.File!,
                            importColumns,
                            request.RuleColumns);

                if (data.Rows.Count == 0)
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "El archivo no contiene registros para importar."
                    });
                }

                var result = await _sqlImportService.ImportAsync(request, importColumns, data);

                return Ok(new
                {
                    success = true,
                    message = "Importación finalizada correctamente.",
                    totalRows = result.TotalRows,
                    insertedRows = result.InsertedRows,
                    existingRows = result.ExistingRows,
                    duplicateRows = result.DuplicateRows
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new
                {
                    success = false,
                    message = ex.Message
                });
            }
            catch (Exception ex)
            {
                return StatusCode(
                    500,
                    new
                    {
                        success = false,
                        message = "Ocurrió un error durante la importación: " + ex.Message
                    });
            }
        }


        // =====================================================
        // VALIDACIÓN BÁSICA
        // =====================================================
        private static void ValidateBasicRequest(ImportRequest request)
        {
            if (request.File == null || request.File.Length == 0)
            {
                throw new InvalidOperationException("Debe seleccionar un archivo.");
            }

            if (request.RuleColumns == null || request.RuleColumns.Count == 0)
            {
                throw new InvalidOperationException("Debe seleccionar al menos una columna para la regla.");
            }

            if (string.IsNullOrWhiteSpace(request.Database))
            {
                throw new InvalidOperationException("Debe seleccionar una base de datos.");
            }

            if (string.IsNullOrWhiteSpace(request.Schema))
            {
                throw new InvalidOperationException("Debe seleccionar un esquema.");
            }

            if (string.IsNullOrWhiteSpace(request.Table))
            {
                throw new InvalidOperationException("Debe seleccionar una tabla.");
            }

            var extension = Path.GetExtension(request.File.FileName).ToLowerInvariant();

            if (extension != ".xlsx" && extension != ".csv")
            {
                throw new InvalidOperationException("El archivo debe ser Excel (.xlsx) o CSV (.csv).");
            }
        }

        // =====================================================
        // COLUMNAS QUE SE PUEDEN IMPORTAR
        // =====================================================
        private static List<ColumnInfo> GetImportColumns(List<ColumnInfo> columns)
        {
            return columns
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
        }


        // =====================================================
        // VALIDAR COLUMNAS DE LA REGLA
        // =====================================================
        private static void ValidateRuleColumns(List<string> ruleColumns, List<ColumnInfo> importColumns)
        {
            var validColumnNames =
                importColumns
                    .Select(
                        x => x.Name)
                    .ToHashSet(
                        StringComparer.OrdinalIgnoreCase);


            var invalidRuleColumns =
                ruleColumns
                    .Where(
                        x =>
                            !validColumnNames.Contains(x))
                    .ToList();


            if (invalidRuleColumns.Count > 0)
            {
                throw new InvalidOperationException("La regla contiene columnas inválidas: "+ string.Join(", ", invalidRuleColumns));
            }

            var duplicatedRuleColumns =
                ruleColumns
                    .GroupBy(
                        x => x,
                        StringComparer.OrdinalIgnoreCase)
                    .Where(
                        x => x.Count() > 1)
                    .Select(
                        x => x.Key)
                    .ToList();


            if (duplicatedRuleColumns.Count > 0)
            {
                throw new InvalidOperationException("La regla contiene columnas duplicadas: " + string.Join(", ", duplicatedRuleColumns));
            }
        }
    }
}