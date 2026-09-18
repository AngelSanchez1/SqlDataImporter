using ClosedXML.Excel;
using CsvHelper;
using CsvHelper.Configuration;
using SqlDataImporter.Models;
using System.Data;
using System.Globalization;

namespace SqlDataImporter.Services
{
    public class ImportFileReaderService : IImportFileReaderService
    {
        public async Task<DataTable> ReadAsync(IFormFile file, List<ColumnInfo> columns, List<string> ruleColumns)
        {
            if (file == null || file.Length == 0)
            {
                throw new InvalidOperationException("El archivo está vacío.");
            }

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

            var ruleSet = ruleColumns.ToHashSet(StringComparer.OrdinalIgnoreCase);

            return extension switch
            {
                ".xlsx" => await ReadExcelAsync(file, columns, ruleSet),
                ".csv" => await ReadCsvAsync(file, columns, ruleSet),
                _ => throw new InvalidOperationException("Formato de archivo no soportado.")
            };
        }


        // =====================================================
        // EXCEL
        // =====================================================

        private async Task<DataTable> ReadExcelAsync(IFormFile file, List<ColumnInfo> columns, HashSet<string> ruleColumns)
        {
            await using var stream = file.OpenReadStream();

            using var workbook = new XLWorkbook(stream);

            var worksheet = workbook.Worksheets.FirstOrDefault();

            if (worksheet == null)
            {
                throw new InvalidOperationException("El archivo Excel no contiene hojas.");
            }

            var headers = GetExcelHeaders(worksheet);

            ValidateHeaders(headers, columns);

            var headerIndexes =
                headers
                    .Select((name, index) => new
                    {
                        Name = name,
                        Index = index + 1
                    })
                    .ToDictionary(
                        x => x.Name,
                        x => x.Index,
                        StringComparer.OrdinalIgnoreCase);

            var dataTable = CreateDataTable(columns);

            var errors = new List<string>();

            var lastRow = worksheet.LastRowUsed()?.RowNumber() ?? 1;

            // Fila 1 = cabeceras
            // Fila 2+ = información

            for (var rowNumber = 2; rowNumber <= lastRow; rowNumber++)
            {
                var row = worksheet.Row(rowNumber);

                if (IsEmptyExcelRow(row, headers.Count))
                {
                    continue;
                }

                var dataRow = dataTable.NewRow();

                ProcessRow(
                    columns,
                    ruleColumns,
                    dataRow,
                    rowNumber,
                    column =>
                    {
                        var columnIndex =
                            headerIndexes[
                                column.Name];

                        return row
                            .Cell(columnIndex)
                            .GetFormattedString()
                            .Trim();
                    },
                    errors);

                dataTable.Rows.Add(dataRow);
            }

            ThrowIfErrors(errors);

            return dataTable;
        }


        // =====================================================
        // CSV
        // =====================================================
        private async Task<DataTable> ReadCsvAsync(IFormFile file, List<ColumnInfo> columns, HashSet<string> ruleColumns)
        {
            await using var stream = file.OpenReadStream();

            using var reader =new StreamReader(stream);

            var configuration =
                new CsvConfiguration(
                    CultureInfo.InvariantCulture)
                {
                    HasHeaderRecord = true,
                    TrimOptions =
                        TrimOptions.Trim
                };

            using var csv =new CsvReader(reader, configuration);

            if (!await csv.ReadAsync())
            {
                throw new InvalidOperationException("El archivo CSV está vacío.");
            }

            csv.ReadHeader();

            var headers =
                csv.HeaderRecord?
                    .Select(x =>
                        x.Trim())
                    .ToList()
                ?? new List<string>();


            ValidateHeaders(headers, columns);


            var headerIndexes =
                headers
                    .Select((name, index) => new
                    {
                        Name = name,
                        Index = index
                    })
                    .ToDictionary(
                        x => x.Name,
                        x => x.Index,
                        StringComparer.OrdinalIgnoreCase);


            var dataTable = CreateDataTable(columns);
            var errors = new List<string>();
            var rowNumber = 1;

            while (await csv.ReadAsync())
            {
                rowNumber++;

                var allEmpty = Enumerable.Range( 0, headers.Count).All(index => string.IsNullOrWhiteSpace(csv.GetField(index)));

                if (allEmpty)
                {
                    continue;
                }

                var dataRow = dataTable.NewRow();

                ProcessRow(
                    columns,
                    ruleColumns,
                    dataRow,
                    rowNumber,
                    column =>
                    {
                        var index = headerIndexes[column.Name];

                        return csv.GetField(index)?.Trim() ?? "";
                    },
                    errors);

                dataTable.Rows.Add(dataRow);
            }

            ThrowIfErrors(errors);

            return dataTable;
        }


        // =====================================================
        // PROCESAR FILA
        // =====================================================
        private void ProcessRow(
            List<ColumnInfo> columns,
            HashSet<string> ruleColumns,
            DataRow row,
            int rowNumber,
            Func<ColumnInfo, string> getValue,
            List<string> errors)
        {
            foreach (var column in columns)
            {
                var value = getValue(column);
                var isRuleColumn = ruleColumns.Contains(column.Name);

                // Una columna utilizada como regla
                // nunca puede estar vacía.

                if (isRuleColumn && string.IsNullOrWhiteSpace(value))
                {
                    errors.Add($"Fila {rowNumber}, columna '{column.Name}': " + "forma parte de la regla y no puede estar vacía.");

                    row[column.Name] = DBNull.Value;

                    continue;
                }

                // Primera versión:
                // NOT NULL debe venir informado.

                if (!column.IsNullable && string.IsNullOrWhiteSpace(value))
                {
                    errors.Add($"Fila {rowNumber}, columna '{column.Name}': " + "el campo es obligatorio.");

                    row[column.Name] = DBNull.Value;

                    continue;
                }


                if (string.IsNullOrWhiteSpace(value))
                {
                    row[column.Name] = DBNull.Value;

                    continue;
                }


                try
                {
                    row[column.Name] = ConvertValue(value, column, rowNumber);
                }
                catch (Exception ex)
                {
                    errors.Add(ex.Message);

                    row[column.Name] = DBNull.Value;
                }
            }

            row["__RowNumber"] = rowNumber;
        }


        // =====================================================
        // CONVERTIR SEGÚN TIPO SQL
        // =====================================================
        private object ConvertValue(string value, ColumnInfo column, int rowNumber)
        {
            var type = column.DataType.ToLowerInvariant();

            switch (type)
            {
                case "varchar":
                case "char":
                case "nvarchar":
                case "nchar":
                case "text":
                case "ntext":
                case "xml":

                    ValidateStringLength(value, column, rowNumber);

                    return value;

                case "int":
                    if (int.TryParse(value, out var intValue))
                    {
                        return intValue;
                    }

                    break;
                case "bigint":
                    if (long.TryParse(value, out var longValue))
                    {
                        return longValue;
                    }

                    break;
                case "smallint":

                    if (short.TryParse(value, out var shortValue))
                    {
                        return shortValue;
                    }

                    break;
                case "tinyint":
                    if (byte.TryParse(value, out var byteValue))
                    {
                        return byteValue;
                    }

                    break;
                case "decimal":
                case "numeric":
                case "money":
                case "smallmoney":

                    if (TryParseDecimal(value, out var decimalValue))
                    {
                        return decimalValue;
                    }

                    break;
                case "float":

                    if (TryParseDouble(value, out var doubleValue))
                    {
                        return doubleValue;
                    }

                    break;
                case "real":

                    if (float.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var floatValue))
                    {
                        return floatValue;
                    }

                    break;
                case "bit":
                    if (TryParseBoolean(value, out var boolValue))
                    {
                        return boolValue;
                    }

                    break;
                case "date":
                case "datetime":
                case "datetime2":
                case "smalldatetime":
                    if (TryParseDateTime(value, out var dateValue))
                    {
                        return dateValue;
                    }

                    break;
                case "datetimeoffset":

                    if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var dateTimeOffset))
                    {
                        return dateTimeOffset;
                    }

                    break;
                case "time":
                    if (TimeSpan.TryParse(value, CultureInfo.InvariantCulture, out var timeValue))
                    {
                        return timeValue;
                    }

                    break;
                case "uniqueidentifier":
                    if (Guid.TryParse(value, out var guid))
                    {
                        return guid;
                    }

                    break;
                default:

                    throw new InvalidOperationException($"Fila {rowNumber}, columna '{column.Name}': " + $"el tipo SQL '{column.DataType}' todavía no está soportado.");
            }


            throw new InvalidOperationException($"Fila {rowNumber}, columna '{column.Name}': " + $"el valor '{value}' no es válido para el tipo SQL '{column.DataType}'.");
        }

        // =====================================================
        // DATATABLE
        // =====================================================
        private DataTable CreateDataTable(List<ColumnInfo> columns)
        {
            var table = new DataTable();

            foreach (var column in columns)
            {
                table.Columns.Add(column.Name, GetDotNetType(column.DataType));
            }

            // Guardamos la fila original del archivo.
            // Nos sirve también para deduplicar.
            table.Columns.Add("__RowNumber", typeof(int));

            return table;
        }

        private Type GetDotNetType(string sqlType)
        {
            return sqlType.ToLowerInvariant() switch
            {
                "bigint" => typeof(long),
                "int" => typeof(int),
                "smallint" => typeof(short),
                "tinyint" => typeof(byte),
                "bit" => typeof(bool),
                "decimal" or
                "numeric" or
                "money" or
                "smallmoney" => typeof(decimal),
                "float" => typeof(double),
                "real" => typeof(float),
                "date" or
                "datetime" or
                "datetime2" or
                "smalldatetime" => typeof(DateTime),
                "datetimeoffset" => typeof(DateTimeOffset),
                "time" => typeof(TimeSpan),
                "uniqueidentifier" => typeof(Guid),
                "varchar" or
                "char" or
                "nvarchar" or
                "nchar" or
                "text" or
                "ntext" or
                "xml" => typeof(string),
                _ => throw new InvalidOperationException($"Tipo SQL no soportado: {sqlType}")
            };
        }

        // =====================================================
        // OBTENER CABECERAS EXCEL
        // =====================================================
        private List<string> GetExcelHeaders(IXLWorksheet worksheet)
        {
            var firstRow = worksheet.Row(1);
            var lastCell = firstRow.LastCellUsed();

            if (lastCell == null)
            {
                return new List<string>();
            }

            var headers = new List<string>();

            for (var column = 1; column <= lastCell.Address.ColumnNumber; column++)
            {
                var header = firstRow.Cell(column).GetString().Trim();
                headers.Add(header);
            }

            return headers;
        }

        // =====================================================
        // VALIDAR HEADERS
        // =====================================================
        private void ValidateHeaders(List<string> headers, List<ColumnInfo> columns)
        {
            if (headers.Count == 0)
            {
                throw new InvalidOperationException("El archivo no contiene cabeceras.");
            }


            var duplicated =
                headers
                    .GroupBy(
                        x => x,
                        StringComparer.OrdinalIgnoreCase)
                    .Where(x =>
                        x.Count() > 1)
                    .Select(x =>
                        x.Key)
                    .ToList();


            if (duplicated.Count > 0)
            {
                throw new InvalidOperationException("Existen columnas duplicadas: " + string.Join(", ", duplicated));
            }

            var expected = columns.Select(x => x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var received = headers.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missing = expected.Except(received, StringComparer.OrdinalIgnoreCase).ToList();
            var unknown = received.Except(expected,StringComparer.OrdinalIgnoreCase).ToList();

            if (missing.Count > 0 ||unknown.Count > 0 || headers.Count != columns.Count)
            {
                var message = "La estructura del archivo no corresponde a la tabla.";

                if (missing.Count > 0)
                {
                    message += " Faltantes: " + string.Join(", ", missing) + ".";
                }

                if (unknown.Count > 0)
                {
                    message +=
                        " No reconocidas: " + string.Join(", ", unknown) + ".";
                }

                throw new InvalidOperationException(message);
            }
        }

        // =====================================================
        // LONGITUD STRING
        // =====================================================
        private void ValidateStringLength(string value, ColumnInfo column, int rowNumber)
        {
            if (column.MaxLength <= 0)
            {
                // -1 representa VARCHAR(MAX)
                // o NVARCHAR(MAX).
                return;
            }

            var maxLength = column.MaxLength;

            if (
                string.Equals(
                    column.DataType,
                    "nvarchar",
                    StringComparison.OrdinalIgnoreCase) ||
                string.Equals(
                    column.DataType,
                    "nchar",
                    StringComparison.OrdinalIgnoreCase))
            {
                // sys.columns.max_length devuelve
                // bytes para tipos unicode.
                maxLength /= 2;
            }

            if (value.Length > maxLength)
            {
                throw new InvalidOperationException(
                    $"Fila {rowNumber}, columna '{column.Name}': " +
                    $"el valor tiene {value.Length} caracteres y " +
                    $"el máximo permitido es {maxLength}.");
            }
        }

        // =====================================================
        // HELPERS DE CONVERSIÓN
        // =====================================================
        private bool TryParseDecimal(string value, out decimal result)
        {
            return
                decimal.TryParse(
                    value,
                    NumberStyles.Any,
                    CultureInfo.InvariantCulture,
                    out result)

                ||

                decimal.TryParse(
                    value,
                    NumberStyles.Any,
                    CultureInfo.GetCultureInfo(
                        "es-MX"),
                    out result);
        }

        private bool TryParseDouble(string value, out double result)
        {
            return
                double.TryParse(
                    value,
                    NumberStyles.Any,
                    CultureInfo.InvariantCulture,
                    out result)

                ||

                double.TryParse(
                    value,
                    NumberStyles.Any,
                    CultureInfo.GetCultureInfo(
                        "es-MX"),
                    out result);
        }

        private bool TryParseDateTime(string value, out DateTime result)
        {
            return
                DateTime.TryParse(
                    value,
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out result)

                ||

                DateTime.TryParse(
                    value,
                    CultureInfo.GetCultureInfo(
                        "es-MX"),
                    DateTimeStyles.None,
                    out result);
        }

        private bool TryParseBoolean(string value, out bool result)
        {
            var normalized = value.Trim().ToLowerInvariant();

            switch (normalized)
            {
                case "1":
                case "true":
                case "si":
                case "sí":
                case "yes":

                    result = true;
                    return true;


                case "0":
                case "false":
                case "no":

                    result = false;
                    return true;
            }

            result = false;

            return false;
        }

        // =====================================================
        // FILA EXCEL VACÍA
        // =====================================================
        private bool IsEmptyExcelRow(IXLRow row, int columnCount)
        {
            for (var i = 1; i <= columnCount;i++)
            {
                if (!string.IsNullOrWhiteSpace(row.Cell(i).GetFormattedString()))
                {
                    return false;
                }
            }

            return true;
        }

        // =====================================================
        // ERRORES
        // =====================================================
        private void ThrowIfErrors(List<string> errors)
        {
            if (errors.Count == 0)
            {
                return;
            }

            const int maxErrors = 20;

            var displayed = errors.Take(maxErrors).ToList();

            var message = string.Join(Environment.NewLine, displayed);


            if (errors.Count > maxErrors)
            {
                message += Environment.NewLine + $"... y {errors.Count - maxErrors} error(es) más.";
            }

            throw new InvalidOperationException(message);
        }
    }
}