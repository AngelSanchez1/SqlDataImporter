using Microsoft.Data.SqlClient;
using SqlDataImporter.Models;
using System.Data;

namespace SqlDataImporter.Services
{
    public class SqlImportService : ISqlImportService
    {
        public async Task<ImportExecutionResult> ImportAsync(ImportRequest request, List<ColumnInfo> columns, DataTable data)
        {
            var result =
                new ImportExecutionResult
                {
                    TotalRows = data.Rows.Count
                };

            var builder =
                new SqlConnectionStringBuilder
                {
                    DataSource = request.Server,
                    UserID = request.User,
                    Password = request.Password,
                    InitialCatalog = request.Database,
                    TrustServerCertificate = true,
                    ConnectTimeout = 15
                };

            await using var connection = new SqlConnection(builder.ConnectionString);

            await connection.OpenAsync();

            await using var transaction = (SqlTransaction) await connection.BeginTransactionAsync(IsolationLevel.Serializable);

            try
            {
                var insertColumns =
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

                ValidateRuleColumns(request.RuleColumns, insertColumns);

                var quotedSchema = QuoteIdentifier(request.Schema);
                var quotedTable = QuoteIdentifier(request.Table);
                var destination = $"{quotedSchema}.{quotedTable}";
                var quotedColumns = insertColumns.Select(x => QuoteIdentifier(x.Name)).ToList();

                // ---------------------------------------
                // Crear tabla temporal con la misma
                // estructura que la tabla destino
                // ---------------------------------------
                var createTempSql = $"""
                    SELECT TOP (0)
                        {string.Join(", ", quotedColumns)}
                    INTO #ImportData
                    FROM {destination};

                    ALTER TABLE #ImportData
                    ADD [__RowNumber] INT NOT NULL;
                    """;

                await using (var command = new SqlCommand(createTempSql, connection, transaction))
                {
                    await command.ExecuteNonQueryAsync();
                }

                // ---------------------------------------
                // Bulk copy a tabla temporal
                // ---------------------------------------
                using (var bulk = new SqlBulkCopy(connection, SqlBulkCopyOptions.Default,transaction))
                {
                    bulk.DestinationTableName = "#ImportData";
                    bulk.BatchSize = 5000;
                    bulk.BulkCopyTimeout = 120;

                    foreach (var column in insertColumns)
                    {
                        bulk.ColumnMappings.Add(column.Name, column.Name);
                    }

                    bulk.ColumnMappings.Add("__RowNumber", "__RowNumber");

                    await bulk.WriteToServerAsync(data);
                }

                var partition = string.Join(", ", request.RuleColumns.Select(QuoteIdentifier));
                var existenceCondition =
                    string.Join(
                        " AND ",
                        request.RuleColumns.Select(
                            column =>
                            {
                                var q = QuoteIdentifier(column);

                                return $"dest.{q} = src.{q}";
                            }));

                // ---------------------------------------
                // Duplicados dentro del archivo
                // ---------------------------------------
                var duplicateSql = $"""
                    WITH Ranked AS
                    (
                        SELECT
                            *,
                            ROW_NUMBER() OVER
                            (
                                PARTITION BY {partition}
                                ORDER BY [__RowNumber]
                            ) AS [__rn]
                        FROM #ImportData
                    )
                    SELECT COUNT(*)
                    FROM Ranked
                    WHERE [__rn] > 1;
                    """;

                await using (var command = new SqlCommand(duplicateSql, connection, transaction))
                {
                    result.DuplicateRows = Convert.ToInt32(await command.ExecuteScalarAsync());
                }

                // ---------------------------------------
                // Registros que ya existen
                // ---------------------------------------
                var existingSql = $"""
                    WITH Ranked AS
                    (
                        SELECT
                            *,
                            ROW_NUMBER() OVER
                            (
                                PARTITION BY {partition}
                                ORDER BY [__RowNumber]
                            ) AS [__rn]
                        FROM #ImportData
                    )
                    SELECT COUNT(*)
                    FROM Ranked src
                    WHERE src.[__rn] = 1
                    AND EXISTS
                    (
                        SELECT 1
                        FROM {destination} dest
                        WHERE {existenceCondition}
                    );
                    """;

                await using (var command = new SqlCommand(existingSql, connection, transaction))
                {
                    result.ExistingRows = Convert.ToInt32(await command.ExecuteScalarAsync());
                }

                // ---------------------------------------
                // Insertar únicamente nuevos
                // ---------------------------------------
                var selectColumns = string.Join(", ", quotedColumns.Select(x => $"src.{x}"));

                var insertSql = $"""
                    WITH Ranked AS
                    (
                        SELECT
                            *,
                            ROW_NUMBER() OVER
                            (
                                PARTITION BY {partition}
                                ORDER BY [__RowNumber]
                            ) AS [__rn]
                        FROM #ImportData
                    )
                    INSERT INTO {destination}
                    (
                        {string.Join(", ", quotedColumns)}
                    )
                    SELECT
                        {selectColumns}
                    FROM Ranked src
                    WHERE src.[__rn] = 1
                    AND NOT EXISTS
                    (
                        SELECT 1
                        FROM {destination} dest
                            WITH (UPDLOCK, HOLDLOCK)
                        WHERE {existenceCondition}
                    );

                    SELECT @@ROWCOUNT;
                    """;

                await using (var command = new SqlCommand(insertSql, connection, transaction))
                {
                    result.InsertedRows = Convert.ToInt32(await command.ExecuteScalarAsync());
                }

                await transaction.CommitAsync();

                return result;
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }

        private static void ValidateRuleColumns(List<string> ruleColumns, List<ColumnInfo> columns)
        {
            var valid = columns.Select(x => x.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var invalid = ruleColumns.Where(x => !valid.Contains(x)).ToList();

            if (invalid.Count > 0)
            {
                throw new InvalidOperationException("Existen columnas inválidas en la regla: " + string.Join(", ", invalid));
            }
        }

        private static string QuoteIdentifier(string identifier)
        {
            return "[" + identifier.Replace("]", "]]") + "]";
        }
    }
}