using System.Data;
using System.Text;
using Microsoft.Data.SqlClient;
using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public class ReportQueryBuilderService : IReportQueryBuilderService
    {
        public async Task<ReportSqlDefinition> BuildAsync(SqlConnection connection, ReportQueryRequest request, bool preview)
        {
            ValidateBasicRequest(request);

            var metadata = await LoadMetadataAsync(connection);

            ValidateRequest(request, metadata);

            var result = new ReportSqlDefinition();
            var sql = new StringBuilder();
            var tableAliases = BuildTableAliases(request);
            var outputNames =new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var parameterIndex = 0;


            // =====================================
            // SELECT
            // =====================================

            sql.Append("SELECT ");

            if (preview)
            {
                sql.Append("TOP (100) ");
            }

            sql.AppendLine();

            var selectExpressions = new List<string>();

            foreach (var column in request.Columns)
            {
                var alias = GetTableAlias(tableAliases, column.Schema, column.Table);

                var outputName = ResolveOutputName(column.Alias, column.Table, column.Column, outputNames);

                selectExpressions.Add(
                    $"    {Quote(alias)}.{Quote(column.Column)} AS {Quote(outputName)}"
                );
            }


            // =====================================
            // CONCAT
            // =====================================

            foreach (var concat in request.ConcatColumns)
            {
                if (concat.Columns == null || concat.Columns.Count < 2)
                {
                    throw new InvalidOperationException("Una columna combinada debe contener al menos dos columnas.");
                }

                if (string.IsNullOrWhiteSpace(concat.Alias))
                {
                    throw new InvalidOperationException("Las columnas combinadas deben tener un alias.");
                }

                var concatParts = new List<string>();

                for (var i = 0; i < concat.Columns.Count; i++)
                {
                    var column = concat.Columns[i];

                    var alias = GetTableAlias(tableAliases, column.Schema, column.Table);

                    concatParts.Add(
                        $"{Quote(alias)}.{Quote(column.Column)}"
                    );

                    if ( i < concat.Columns.Count - 1)
                    {
                        var parameterName = $"@p{parameterIndex++}";

                        concatParts.Add(parameterName);

                        result.Parameters.Add(
                            new SqlParameter(parameterName, SqlDbType.NVarChar)
                            {
                                Value = concat.Separator?? string.Empty
                            }
                        );
                    }
                }

                var outputName = ResolveOutputName(concat.Alias, "concat", concat.Alias, outputNames);

                selectExpressions.Add(
                    $"    CONCAT({string.Join(", ", concatParts)}) AS {Quote(outputName)}"
                );
            }

            if (selectExpressions.Count == 0)
            {
                throw new InvalidOperationException("Debe seleccionar al menos una columna.");
            }

            sql.AppendLine(
                string.Join(
                    "," + Environment.NewLine,
                    selectExpressions
                )
            );

            var mainAlias = GetTableAlias(tableAliases, request.MainSchema, request.MainTable);

            sql.AppendLine();
            sql.Append($"FROM {Quote(request.MainSchema)}.{Quote(request.MainTable)} AS {Quote(mainAlias)}");


            // =====================================
            // JOINS
            // =====================================

            foreach (var join in request.Joins)
            {
                var joinType =
                    join.JoinType
                        .ToUpperInvariant();

                if (
                    joinType != "INNER" &&
                    joinType != "LEFT"
                )
                {
                    throw new InvalidOperationException(
                        $"Tipo de JOIN no permitido: {join.JoinType}"
                    );
                }

                var leftAlias =
                    GetTableAlias(
                        tableAliases,
                        join.LeftSchema,
                        join.LeftTable
                    );

                var rightAlias =
                    GetTableAlias(
                        tableAliases,
                        join.RightSchema,
                        join.RightTable
                    );

                sql.AppendLine();
                sql.AppendLine();

                sql.Append(
                    $"{joinType} JOIN "
                );

                sql.Append(
                    $"{Quote(join.RightSchema)}.{Quote(join.RightTable)} AS {Quote(rightAlias)}"
                );

                sql.AppendLine();

                sql.Append(
                    $"    ON {Quote(leftAlias)}.{Quote(join.LeftColumn)}"
                );

                sql.Append(
                    " = "
                );

                sql.Append(
                    $"{Quote(rightAlias)}.{Quote(join.RightColumn)}"
                );
            }


            // =====================================
            // WHERE
            // =====================================

            if (request.Filters.Count > 0)
            {
                sql.AppendLine();
                sql.AppendLine();

                sql.AppendLine(
                    "WHERE"
                );


                for (var i = 0; i < request.Filters.Count; i++)
                {
                    var filter = request.Filters[i];

                    if (i > 0)
                    {
                        var logical =
                            filter.LogicalOperator
                                .Equals(
                                    "OR",
                                    StringComparison.OrdinalIgnoreCase
                                )
                                ? "OR"
                                : "AND";


                        sql.Append(
                            $"{logical} "
                        );
                    }

                    AppendFilter(sql, result.Parameters, tableAliases, filter, ref parameterIndex);

                    if (i < request.Filters.Count - 1)
                    {
                        sql.AppendLine();
                    }
                }
            }

            // =====================================
            // ORDER BY
            // =====================================

            if (request.OrderBy.Count > 0)
            {
                sql.AppendLine();
                sql.AppendLine();

                sql.AppendLine(
                    "ORDER BY"
                );

                var orderExpressions = new List<string>();

                foreach (var order in request.OrderBy)
                {
                    var alias = GetTableAlias(tableAliases, order.Schema, order.Table);

                    var direction =
                        order.Direction
                            .Equals(
                                "DESC",
                                StringComparison.OrdinalIgnoreCase
                            )
                            ? "DESC"
                            : "ASC";

                    orderExpressions.Add(
                        $"    {Quote(alias)}.{Quote(order.Column)} {direction}"
                    );
                }

                sql.Append(string.Join("," + Environment.NewLine, orderExpressions));
            }

            result.Sql = sql.ToString();

            return result;
        }

        // =========================================
        // FILTROS
        // =========================================

        private static void AppendFilter(
            StringBuilder sql,
            List<SqlParameter> parameters,
            Dictionary<string, string> aliases,
            ReportFilter filter,
            ref int parameterIndex
        )
        {
            var tableAlias = GetTableAlias(aliases, filter.Schema, filter.Table);
            var expression = $"{Quote(tableAlias)}.{Quote(filter.Column)}";
            var op = filter.Operator.ToUpperInvariant();

            switch (op)
            {
                case "=":
                case "<>":
                case ">":
                case ">=":
                case "<":
                case "<=":
                    {
                        var parameterName = $"@p{parameterIndex++}";
                        sql.Append($"{expression} {op} {parameterName}");
                        parameters.Add(new SqlParameter(parameterName, filter.Value ?? (object)DBNull.Value));
                        break;
                    }

                case "LIKE":
                    {
                        AppendLike(sql, parameters, expression, $"%{filter.Value}%", ref parameterIndex);
                        break;
                    }

                case "STARTS_WITH":
                    {
                        AppendLike(sql, parameters, expression, $"{filter.Value}%", ref parameterIndex);
                        break;
                    }

                case "ENDS_WITH":
                    {
                        AppendLike(sql, parameters, expression, $"%{filter.Value}", ref parameterIndex);
                        break;
                    }

                case "IS_NULL":
                    {
                        sql.Append($"{expression} IS NULL");
                        break;
                    }

                case "IS_NOT_NULL":
                    {
                        sql.Append($"{expression} IS NOT NULL");
                        break;
                    }

                case "IN":
                case "NOT_IN":
                    {
                        if (filter.Values == null || filter.Values.Count == 0)
                        {
                            throw new InvalidOperationException($"El operador {op} requiere al menos un valor.");
                        }

                        var parameterNames = new List<string>();

                        foreach (var value in filter.Values)
                        {
                            var parameterName = $"@p{parameterIndex++}";
                            parameterNames.Add(parameterName);
                            parameters.Add(new SqlParameter(parameterName, value));
                        }

                        var sqlOperator = op == "IN" ? "IN" : "NOT IN";
                        sql.Append($"{expression} {sqlOperator} ({string.Join(", ", parameterNames)})");

                        break;
                    }


                default:
                    throw new InvalidOperationException($"Operador no permitido: {filter.Operator}");
            }
        }


        private static void AppendLike(
            StringBuilder sql,
            List<SqlParameter> parameters,
            string expression,
            string value,
            ref int parameterIndex
        )
        {
            var parameterName = $"@p{parameterIndex++}";
            sql.Append($"{expression} LIKE {parameterName}");
            parameters.Add(new SqlParameter(parameterName, value));
        }

        // =========================================
        // ALIASES DE TABLA
        // =========================================
        private static Dictionary<string, string> BuildTableAliases(ReportQueryRequest request)
        {
            var aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var mainKey = TableKey(request.MainSchema, request.MainTable);
            aliases[mainKey] = "t0";

            var index = 1;

            foreach (var join in request.Joins)
            {
                var key = TableKey(join.RightSchema, join.RightTable);

                if (!aliases.ContainsKey(key))
                {
                    aliases[key] = $"t{index++}";
                }
            }

            return aliases;
        }
        private static string GetTableAlias(Dictionary<string, string> aliases, string schema, string table)
        {
            var key = TableKey(schema,table);

            if (!aliases.TryGetValue(key, out var alias))
            {
                throw new InvalidOperationException($"La tabla {schema}.{table} no forma parte de la consulta.");
            }

            return alias;
        }

        private static string TableKey(string schema, string table)
        {
            return $"{schema}.{table}";
        }

        // =========================================
        // METADATA
        // =========================================
        private static async Task<HashSet<string>>LoadMetadataAsync(SqlConnection connection)
        {
            const string sql = """
                SELECT
                    s.name AS SchemaName,
                    t.name AS TableName,
                    c.name AS ColumnName
                FROM sys.tables t
                INNER JOIN sys.schemas s
                    ON t.schema_id = s.schema_id
                INNER JOIN sys.columns c
                    ON t.object_id = c.object_id
                WHERE t.is_ms_shipped = 0;
                """;

            var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            await using var command = new SqlCommand(sql,connection);
            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                result.Add(
                    $"{reader.GetString(0)}."
                    + $"{reader.GetString(1)}."
                    + $"{reader.GetString(2)}"
                );
            }

            return result;
        }
        private static void ValidateRequest(ReportQueryRequest request, HashSet<string> metadata)
        {
            ValidateTableHasColumns(request.MainSchema, request.MainTable, metadata);

            foreach (var column in request.Columns)
            {
                ValidateColumn(column.Schema, column.Table, column.Column, metadata);
            }

            foreach (var concat in request.ConcatColumns)
            {
                foreach (var column in concat.Columns)
                {
                    ValidateColumn(column.Schema, column.Table, column.Column, metadata);
                }
            }

            foreach (var join in request.Joins)
            {
                ValidateColumn(join.LeftSchema, join.LeftTable, join.LeftColumn, metadata);
                ValidateColumn(join.RightSchema, join.RightTable, join.RightColumn, metadata);
            }

            foreach (var filter in request.Filters)
            {
                ValidateColumn(filter.Schema, filter.Table, filter.Column, metadata);
            }

            foreach (var order in request.OrderBy)
            {
                ValidateColumn(order.Schema, order.Table, order.Column, metadata);
            }
        }

        private static void ValidateColumn(string schema, string table, string column, HashSet<string> metadata)
        {
            var key = $"{schema}.{table}.{column}";

            if (!metadata.Contains(key))
            {
                throw new InvalidOperationException($"La columna {key} no existe.");
            }
        }

        private static void ValidateTableHasColumns(string schema, string table, HashSet<string> metadata)
        {
            var prefix = $"{schema}.{table}.";

            if (!metadata.Any(item => item.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
            {
                throw new InvalidOperationException($"La tabla {schema}.{table} no existe.");
            }
        }

        private static void ValidateBasicRequest(ReportQueryRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Database))
            {
                throw new InvalidOperationException("Debe seleccionar una base de datos.");
            }

            if (string.IsNullOrWhiteSpace(request.MainSchema) ||
                string.IsNullOrWhiteSpace(request.MainTable))
            {
                throw new InvalidOperationException("Debe seleccionar una tabla principal.");
            }
        }

        // =========================================
        // OUTPUT NAMES
        // =========================================
        private static string ResolveOutputName(string? requestedAlias, string table, string column, HashSet<string> used)
        {
            var baseName = string.IsNullOrWhiteSpace(requestedAlias) ? column : requestedAlias.Trim();
            var result = baseName;

            if (used.Contains(result))
            {
                result = $"{table}_{column}";
            }

            var counter = 2;

            while (used.Contains(result))
            {
                result = $"{table}_{column}_{counter++}";
            }

            used.Add(result);

            return result;
        }

        private static string Quote(string value)
        {
            return "["
                + value.Replace(
                    "]",
                    "]]"
                )
                + "]";
        }
    }
}