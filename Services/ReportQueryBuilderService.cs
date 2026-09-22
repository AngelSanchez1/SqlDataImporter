using Microsoft.Data.SqlClient;
using SqlDataImporter.Models;
using System.Data;
using System.Globalization;
using System.Text;

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

            var selectExpressions = new List<ReportSelectExpression>();

            foreach (var column in request.Columns)
            {
                var alias = GetTableAlias(tableAliases, column.SourceId);
                var expression = $"{Quote(alias)}.{Quote(column.Column)}";
                var outputName = ResolveOutputName(column.Alias, column.Table, column.Column, outputNames);

                selectExpressions.Add(
                   new ReportSelectExpression
                   {
                       Order = column.Order,
                       Sql = $"    {expression} AS {Quote(outputName)}"
                   }
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

                    var alias = GetTableAlias(tableAliases, column.SourceId);

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

                var expression = $"CONCAT({string.Join(", ", concatParts)})";
                var outputName = ResolveOutputName(concat.Alias, "concat", concat.Alias, outputNames);

                selectExpressions.Add(
                     new ReportSelectExpression
                     {
                         Order = concat.Order,
                         Sql = $"    {expression} AS {Quote(outputName)}"
                     }
                );
            }

            // =====================================
            // COLUMNAS CONDICIONALES
            // =====================================
            foreach (var conditional in request.ConditionalColumns)
            {
                var expression = BuildConditionalColumnExpression(conditional, tableAliases, result.Parameters, metadata, ref parameterIndex);
                var outputName = ResolveOutputName(conditional.Alias, "case", conditional.Alias, outputNames);
                selectExpressions.Add(
                    new ReportSelectExpression
                    {
                        Order = conditional.Order,
                        Sql = $"    {expression} AS {Quote(outputName)}"
                    }
                );
            }

            // =====================================
            // METRICAS / AGREGADOS
            // =====================================

            foreach (var metric in request.Metrics)
            {
                var expression = BuildMetricExpression(metric, tableAliases, result.Parameters, metadata, ref parameterIndex);
                var outputName = ResolveOutputName(metric.Alias, "metric", metric.Alias, outputNames);

                selectExpressions.Add(
                    new ReportSelectExpression
                    {
                        Order = metric.Order,
                        Sql = $"    {expression} AS {Quote(outputName)}"
                    }
                );
            }

            if (selectExpressions.Count == 0)
            {
                throw new InvalidOperationException("Debe seleccionar al menos una columna.");
            }

            var orderedSelectExpressions =
                selectExpressions
                    .OrderBy(
                        item => item.Order <= 0 ? int.MaxValue : item.Order
                    )
                    .Select(
                        item => item.Sql
                    )
                    .ToList();

            sql.AppendLine(string.Join("," + Environment.NewLine, orderedSelectExpressions));

            var mainAlias = GetTableAlias(tableAliases, GetMainSourceId(request));

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

                var leftAlias = GetTableAlias(tableAliases, join.LeftSourceId);
                var rightAlias = GetTableAlias(tableAliases,join.RightSourceId);

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

                    AppendFilter(sql, result.Parameters, tableAliases, metadata, filter, ref parameterIndex);

                    if (i < request.Filters.Count - 1)
                    {
                        sql.AppendLine();
                    }
                }
            }

            // =====================================
            // GROUP BY
            // =====================================
            AppendGroupBy(sql, request, tableAliases);

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
                    var alias = GetTableAlias(tableAliases, order.SourceId);

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
            Dictionary<string, ReportColumnMetadata> metadata,
            ReportFilter filter,
            ref int parameterIndex
        )
        {
            var metadataKey = ColumnKey(filter.Schema, filter.Table, filter.Column);
            var columnMetadata = metadata[metadataKey];
            var tableAlias = GetTableAlias(aliases, filter.SourceId);
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
                        parameters.Add(CreateTypedParameter(parameterName, filter.Value, columnMetadata));
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
                            parameters.Add(CreateTypedParameter(parameterName, value, columnMetadata));
                        }

                        var sqlOperator = op == "IN" ? "IN" : "NOT IN";
                        sql.Append($"{expression} {sqlOperator} ({string.Join(", ", parameterNames)})");

                        break;
                    }
                    case "BETWEEN":
                    {
                        if (string.IsNullOrWhiteSpace(filter.Value) || string.IsNullOrWhiteSpace(filter.ValueTo))
                        {
                            throw new InvalidOperationException("BETWEEN requiere un valor inicial y un valor final.");
                        }

                        var parameterFrom = $"@p{parameterIndex++}";
                        var parameterTo = $"@p{parameterIndex++}";

                        parameters.Add(CreateTypedParameter(parameterFrom, filter.Value, columnMetadata));
                        parameters.Add(CreateTypedParameter(parameterTo, filter.ValueTo, columnMetadata));
                        sql.Append($"{expression} BETWEEN {parameterFrom} AND {parameterTo}");
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
            var index = 1;
            var aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            aliases[GetMainSourceId(request)] = "t0";

            foreach (var join in request.Joins)
            {
                if (string.IsNullOrWhiteSpace(join.LeftSourceId))
                {
                    throw new InvalidOperationException("La relación no tiene una fuente de origen.");
                }

                // El origen debe existir antes de este JOIN.
                if (!aliases.ContainsKey(join.LeftSourceId))
                {
                    throw new InvalidOperationException(
                        $"La fuente origen '{join.LeftSourceId}' " +
                        "todavía no forma parte de la consulta."
                    );
                }

                if (string.IsNullOrWhiteSpace(join.RightSourceId))
                {
                    throw new InvalidOperationException("Una relación no tiene identificador de fuente.");
                }

                if (aliases.ContainsKey(join.RightSourceId))
                {
                    throw new InvalidOperationException(
                        $"La fuente '{join.RightSourceId}' está duplicada."
                    );
                }

                aliases[join.RightSourceId] = $"t{index++}";
            }

            return aliases;
        }

        private static string GetTableAlias(Dictionary<string, string> aliases, string sourceId)
        {
            if (string.IsNullOrWhiteSpace(sourceId) || !aliases.TryGetValue(sourceId, out var alias))
            {
                throw new InvalidOperationException($"La fuente '{sourceId}' no forma parte de la consulta.");
            }

            return alias;
        }

        // =========================================
        // METADATA
        // =========================================
        private static async Task<Dictionary<string, ReportColumnMetadata>>LoadMetadataAsync(SqlConnection connection)
        {
            const string sql = """
                SELECT
                    s.name AS SchemaName,
                    tb.name AS TableName,
                    c.name AS ColumnName,
                    t.name AS DataType,
                    c.precision,
                    c.scale
                FROM sys.tables tb
                INNER JOIN sys.schemas s
                    ON tb.schema_id = s.schema_id
                INNER JOIN sys.columns c
                    ON tb.object_id = c.object_id
                INNER JOIN sys.types t
                    ON c.user_type_id = t.user_type_id
                WHERE tb.is_ms_shipped = 0;
                """;

            var result = new Dictionary<string, ReportColumnMetadata>(StringComparer.OrdinalIgnoreCase);

            await using var command = new SqlCommand(sql, connection);

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                var metadata =
                    new ReportColumnMetadata
                    {
                        Schema = reader.GetString(0),
                        Table = reader.GetString(1),
                        Column = reader.GetString(2),
                        DataType = reader.GetString(3),
                        Precision = reader.GetByte(4),
                        Scale = reader.GetByte(5)
                    };

                result[
                    ColumnKey(
                        metadata.Schema,
                        metadata.Table,
                        metadata.Column
                    )
                ] = metadata;
            }

            return result;
        }

        private static string ColumnKey(string schema, string table, string column)
        {
            return $"{schema}.{table}.{column}";
        }

        private static string SourceColumnKey(string sourceId, string schema, string table, string column)
        {
            return $"{sourceId}|{schema}.{table}.{column}";
        }

        private static void ValidateRequest(ReportQueryRequest request, Dictionary<string, ReportColumnMetadata> metadata)
        {
            ValidateTableHasColumns(request.MainSchema, request.MainTable, metadata);

            var sources = BuildSourceMap(request);

            // =========================================
            // FUENTE PRINCIPAL
            // =========================================
            ValidateSource(GetMainSourceId(request), request.MainSchema, request.MainTable, sources);

            // =========================================
            // COLUMNAS NORMALES
            // =========================================
            foreach (var column in request.Columns)
            {
                ValidateReference(column, metadata, sources);
            }

            // =========================================
            // CONCATENACIONES
            // =========================================
            foreach (var concat in request.ConcatColumns)
            {
                foreach (var column in concat.Columns)
                {
                    ValidateReference(column, metadata, sources);
                }
            }

            // =========================================
            // COLUMNAS CONDICIONALES
            // =========================================
            foreach (var conditional in request.ConditionalColumns)
            {
                ValidateConditionalColumn(conditional, metadata, sources);
            }

            // =========================================
            // MÉTRICAS
            // =========================================
            foreach (var metric in request.Metrics)
            {
                ValidateMetric(metric, metadata, sources);
            }

            // =========================================
            // GROUP BY
            // =========================================
            foreach (var group in request.GroupBy)
            {
                ValidateReference(group, metadata, sources);
            }

            // =========================================
            // HAVING
            // =========================================
            foreach (var having in request.Having)
            {
                ValidateReference(having, metadata, sources);
            }

            // =========================================
            // JOINS
            // =========================================
            foreach (var join in request.Joins)
            {
                if (
                    string.IsNullOrWhiteSpace(
                        join.LeftSchema
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.LeftTable
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.LeftColumn
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.RightSchema
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.RightTable
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.RightColumn
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.LeftSourceId
                    ) ||
                    string.IsNullOrWhiteSpace(
                        join.RightSourceId
                    )
                )
                {
                    throw new InvalidOperationException(
                        "La relación está incompleta. " +
                        "Seleccione ambas fuentes, tablas y columnas."
                    );
                }

                ValidateSource(join.LeftSourceId, join.LeftSchema, join.LeftTable, sources);
                ValidateSource(join.RightSourceId, join.RightSchema, join.RightTable,sources);
                ValidateColumn(join.LeftSchema, join.LeftTable, join.LeftColumn, metadata);
                ValidateColumn(join.RightSchema, join.RightTable, join.RightColumn, metadata);
            }

            // =========================================
            // FILTROS
            // =========================================
            foreach (var filter in request.Filters)
            {
                ValidateReference(filter, metadata, sources);
            }

            // =========================================
            // ORDER BY
            // =========================================
            foreach (var order in request.OrderBy)
            {
                ValidateReference(order, metadata, sources);
            }
        }

        private static void ValidateColumn(string schema, string table, string column, Dictionary<string, ReportColumnMetadata> metadata)
        {
            if (string.IsNullOrWhiteSpace(schema) || string.IsNullOrWhiteSpace(table) || string.IsNullOrWhiteSpace(column))
            {
                throw new InvalidOperationException("Se recibió una referencia de columna incompleta.");
            }

            var key = ColumnKey(schema, table, column);

            if (!metadata.ContainsKey(key))
            {
                throw new InvalidOperationException($"La columna {key} no existe.");
            }
        }

        private static void ValidateTableHasColumns(string schema, string table, Dictionary<string, ReportColumnMetadata> metadata)
        {
            var prefix = $"{schema}.{table}.";

            if (!metadata.Keys.Any( item => item.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
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

        private static void ValidateMetric(
    ReportMetric metric,
    Dictionary<string, ReportColumnMetadata> metadata,
    Dictionary<string, (string Schema, string Table)> sources
)
        {
            var function =
                (metric.Function ?? string.Empty)
                    .Trim()
                    .ToUpperInvariant();


            var allowedFunctions =
                new[]
                {
            "SUM",
            "COUNT",
            "AVG",
            "MIN",
            "MAX"
                };


            if (!allowedFunctions.Contains(function))
            {
                throw new InvalidOperationException(
                    $"La función {metric.Function} no está permitida."
                );
            }


            if (
                string.IsNullOrWhiteSpace(
                    metric.Alias
                )
            )
            {
                throw new InvalidOperationException(
                    "Toda métrica debe tener un alias."
                );
            }


            // COUNT(*) puede no tener columna.
            var countAll =
                function == "COUNT" &&
                string.IsNullOrWhiteSpace(
                    metric.Column
                );


            if (!countAll)
            {
                ValidateReference(
                    metric,
                    metadata,
                    sources
                );


                var columnMetadata =
                    metadata[
                        ColumnKey(
                            metric.Schema,
                            metric.Table,
                            metric.Column
                        )
                    ];


                if (
                    function is "SUM" or "AVG" &&
                    !IsNumericType(
                        columnMetadata.DataType
                    )
                )
                {
                    throw new InvalidOperationException(
                        $"{function} solamente puede utilizar columnas numéricas. " +
                        $"La columna {metric.Schema}.{metric.Table}.{metric.Column} " +
                        $"es de tipo {columnMetadata.DataType}."
                    );
                }
            }


            if (metric.Conditions != null)
            {
                foreach (
                    var condition
                    in metric.Conditions
                )
                {
                    ValidateReference(
                        condition,
                        metadata,
                        sources
                    );
                }
            }


            if (
                metric.ArithmeticValue.HasValue
            )
            {
                var allowedOperators =
                    new[]
                    {
                "+",
                "-",
                "*",
                "/"
                    };


                if (
                    string.IsNullOrWhiteSpace(
                        metric.ArithmeticOperator
                    ) ||
                    !allowedOperators.Contains(
                        metric.ArithmeticOperator
                    )
                )
                {
                    throw new InvalidOperationException(
                        "El operador aritmético de la métrica no es válido."
                    );
                }


                if (function == "COUNT")
                {
                    throw new InvalidOperationException(
                        "COUNT no admite transformación aritmética sobre la columna."
                    );
                }
            }
        }

        private static bool IsNumericType(string dataType)
        {
            return dataType.ToLowerInvariant()
                is "tinyint"
                or "smallint"
                or "int"
                or "bigint"
                or "decimal"
                or "numeric"
                or "money"
                or "smallmoney"
                or "float"
                or "real";
        }

        private static string BuildMetricExpression(
            ReportMetric metric,
            Dictionary<string, string> aliases,
            List<SqlParameter> parameters,
            Dictionary<string, ReportColumnMetadata> metadata,
            ref int parameterIndex)
        {
            var function = metric.Function.Trim().ToUpperInvariant();

            if (function == "COUNT" && string.IsNullOrWhiteSpace(metric.Column))
            {
                if (metric.Conditions == null || metric.Conditions.Count == 0)
                {
                    return "COUNT(*)";
                }

                var condition = BuildMetricConditions(metric.Conditions, aliases, parameters, metadata, ref parameterIndex);

                return $"COUNT(CASE WHEN {condition} THEN 1 END)";
            }

            var tableAlias = GetTableAlias(aliases, metric.SourceId);
            var valueExpression = $"{Quote(tableAlias)}.{Quote(metric.Column)}";

            // =========================================
            // NULL -> 0
            // =========================================
            if (metric.NullAsZero && function != "COUNT")
            {
                valueExpression = $"ISNULL({valueExpression}, 0)";
            }

            // =========================================
            // ARITMETICA
            // =========================================
            if (metric.ArithmeticValue.HasValue)
            {
                var operatorValue = metric.ArithmeticOperator!;
                var parameterName = $"@p{parameterIndex++}";


                parameters.Add(
                    new SqlParameter(parameterName, SqlDbType.Decimal)
                    {
                        Value = metric.ArithmeticValue.Value
                    }
                );

                valueExpression = $"({valueExpression} {operatorValue} {parameterName})";
            }

            var distinct = metric.Distinct ? "DISTINCT " : string.Empty;

            // =========================================
            // SIN CASE
            // =========================================
            if (metric.Conditions == null || metric.Conditions.Count == 0)
            {
                return $"{function}({distinct}{valueExpression})";
            }


            // =========================================
            // CASE WHEN
            // =========================================
            var conditions = BuildMetricConditions(metric.Conditions, aliases, parameters, metadata, ref parameterIndex);

            if (function == "COUNT")
            {
                return $"COUNT({distinct}CASE WHEN {conditions} " + $"THEN {valueExpression} END)";
            }

            var elseExpression = function == "SUM" ? "0" : "NULL";

            return
                $"{function}(" +
                $"{distinct}" +
                $"CASE WHEN {conditions} " +
                $"THEN {valueExpression} " +
                $"ELSE {elseExpression} END" +
                $")";
        }

        private static string BuildMetricConditions(
            List<ReportMetricCondition> conditions,
            Dictionary<string, string> aliases,
            List<SqlParameter> parameters,
            Dictionary<string, ReportColumnMetadata> metadata,
            ref int parameterIndex)
        {
            var expressions = new List<string>();

            for (var i = 0; i < conditions.Count; i++)
            {
                var condition = conditions[i];
                var expression = BuildMetricCondition(condition, aliases, parameters, metadata, ref parameterIndex);

                if (i > 0)
                {
                    var logical = string.Equals(condition.LogicalOperator, "OR", StringComparison.OrdinalIgnoreCase) ? "OR" : "AND";
                    expressions.Add(logical);
                }

                expressions.Add(expression);
            }

            return string.Join(" ", expressions);
        }

        private static string BuildMetricCondition(
            ReportMetricCondition condition,
            Dictionary<string,
            string> aliases,
            List<SqlParameter> parameters,
            Dictionary<string, ReportColumnMetadata> metadata,
            ref int parameterIndex)
        {
            var metadataKey = ColumnKey(condition.Schema, condition.Table, condition.Column);
            var columnMetadata = metadata[metadataKey];
            var tableAlias = GetTableAlias(aliases, condition.SourceId);
            var column = $"{Quote(tableAlias)}.{Quote(condition.Column)}";
            var op = condition.Operator.Trim().ToUpperInvariant();

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
                        parameters.Add(CreateTypedParameter(parameterName, condition.Value, columnMetadata));
                        return $"{column} {op} {parameterName}";
                    }

                case "LIKE":
                    {
                        var parameterName = $"@p{parameterIndex++}";
                        parameters.Add(new SqlParameter(parameterName, $"%{condition.Value}%"));
                        return $"{column} LIKE {parameterName}";
                    }

                case "STARTS_WITH":
                    {
                        var parameterName = $"@p{parameterIndex++}";
                        parameters.Add(new SqlParameter(parameterName, $"{condition.Value}%"));
                        return $"{column} LIKE {parameterName}";
                    }

                case "ENDS_WITH":
                    {
                        var parameterName = $"@p{parameterIndex++}";
                        parameters.Add(new SqlParameter(parameterName, $"%{condition.Value}"));
                        return $"{column} LIKE {parameterName}";
                    }

                case "IS_NULL":
                    return $"{column} IS NULL";

                case "IS_NOT_NULL":
                    return $"{column} IS NOT NULL";

                case "IN":
                case "NOT_IN":
                    {
                        if (condition.Values == null || condition.Values.Count == 0)
                        {
                            throw new InvalidOperationException($"{op} requiere al menos un valor.");
                        }

                        var names = new List<string>();

                        foreach (var value in condition.Values)
                        {
                            var parameterName = $"@p{parameterIndex++}";
                            names.Add(parameterName);
                            parameters.Add(CreateTypedParameter(parameterName, value, columnMetadata));
                        }

                        var sqlOperator = op == "IN" ? "IN" : "NOT IN";

                        return$"{column} {sqlOperator} " + $"({string.Join(", ", names)})";
                    }


                default: throw new InvalidOperationException($"Operador no permitido en la métrica: {condition.Operator}");
            }
        }

        private static void AppendGroupBy(StringBuilder sql,ReportQueryRequest request, Dictionary<string, string> aliases)
            {
                if (request.Metrics == null || request.Metrics.Count == 0)
                {
                    return;
                }

                var groupColumns = new Dictionary<string, ReportColumnReference>( StringComparer.OrdinalIgnoreCase);


                // =========================================
                // COLUMNAS NORMALES
                // =========================================
                foreach (var column in request.Columns)
                {
                    var key =
                        SourceColumnKey(
                            column.SourceId,
                            column.Schema,
                            column.Table,
                            column.Column
                        );

                    groupColumns[key] =
                        new ReportColumnReference
                        {
                            SourceId = column.SourceId,
                            Schema = column.Schema,
                            Table = column.Table,
                            Column = column.Column
                        };
                }

                // =========================================
                // CONCAT
                // =========================================
                foreach (var concat in request.ConcatColumns)
                {
                    foreach (var column in concat.Columns)
                    {
                        var key =
                            SourceColumnKey(
                                column.SourceId,
                                column.Schema,
                                column.Table,
                                column.Column
                            );

                        groupColumns[key] =
                            new ReportColumnReference
                            {
                                SourceId = column.SourceId,
                                Schema = column.Schema,
                                Table = column.Table,
                                Column = column.Column
                            };
                    }
                }

                // =========================================
                // CASE WHEN
                // =========================================
                foreach (var conditional in request.ConditionalColumns)
                {
                    foreach (var caseWhen in conditional.Cases)
                    {
                        foreach (var condition in caseWhen.Conditions)
                        {
                            var key =
                                SourceColumnKey(
                                    condition.SourceId,
                                    condition.Schema,
                                    condition.Table,
                                    condition.Column
                                );

                            groupColumns[key] =
                                new ReportColumnReference
                                {
                                    SourceId =
                                        condition.SourceId,

                                    Schema =
                                        condition.Schema,

                                    Table =
                                        condition.Table,

                                    Column =
                                        condition.Column
                                };
                        }

                        if (
                            caseWhen.Result != null &&
                            string.Equals(
                                caseWhen.Result.ResultType,
                                "COLUMN",
                                StringComparison.OrdinalIgnoreCase
                            )
                        )
                        {
                            AddGroupByCaseResult(groupColumns, caseWhen.Result);
                        }
                    }

                    if (
                        conditional.ElseResult != null &&
                        string.Equals(
                            conditional.ElseResult.ResultType,
                            "COLUMN",
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        AddGroupByCaseResult(groupColumns, conditional.ElseResult);
                    }
                }

                // =========================================
                // GROUP BY EXPLÍCITO
                // =========================================
                foreach (var column in request.GroupBy)
                {
                    var key =
                        SourceColumnKey(
                            column.SourceId,
                            column.Schema,
                            column.Table,
                            column.Column
                        );

                    groupColumns[key] =
                        new ReportColumnReference
                        {
                            SourceId = column.SourceId,
                            Schema = column.Schema,
                            Table = column.Table,
                            Column = column.Column
                        };
                }


                if (groupColumns.Count == 0)
                {
                    return;
                }

                sql.AppendLine();
                sql.AppendLine();
                sql.AppendLine("GROUP BY");

                var expressions =
                    groupColumns.Values
                        .Select(
                            column =>
                            {
                                var alias =
                                    GetTableAlias(
                                        aliases,
                                        column.SourceId
                                    );

                                return
                                    $"    {Quote(alias)}.{Quote(column.Column)}";
                            }
                        );

                sql.Append(
                    string.Join(
                        "," + Environment.NewLine,
                        expressions
                    )
                );
        }

        private static string BuildConditionalColumnExpression(
            ReportConditionalColumn conditional,
            Dictionary<string, string> aliases,
            List<SqlParameter> parameters,
            Dictionary<string, ReportColumnMetadata> metadata,
            ref int parameterIndex)
        {
            if (conditional.Cases == null || conditional.Cases.Count == 0)
            {
                throw new InvalidOperationException($"La columna condicional '{conditional.Alias}' " + "debe contener al menos un WHEN.");
            }

            var sql = new StringBuilder();

            sql.Append("CASE");

            foreach (var caseWhen in conditional.Cases)
            {
                if (caseWhen.Conditions == null || caseWhen.Conditions.Count == 0)
                {
                    throw new InvalidOperationException($"Un WHEN de la columna '{conditional.Alias}' " + "no contiene condiciones.");
                }

                var condition = BuildMetricConditions(caseWhen.Conditions, aliases, parameters, metadata, ref parameterIndex);
                var result = BuildCaseResultExpression(caseWhen.Result, aliases, parameters,ref parameterIndex);
                sql.Append($" WHEN {condition} THEN {result}");
            }

            var elseResult = BuildCaseResultExpression(conditional.ElseResult, aliases, parameters, ref parameterIndex);

            sql.Append($" ELSE {elseResult}");
            sql.Append(" END");

            return sql.ToString();
        }

        private static string BuildCaseResultExpression(ReportCaseResult result, Dictionary<string, string> aliases,List<SqlParameter> parameters, ref int parameterIndex)
        {
            var resultType = (result.ResultType ?? "VALUE").Trim().ToUpperInvariant();

            switch (resultType)
            {
                // =====================================
                // VALOR FIJO
                // =====================================
                case "VALUE":
                    {
                        var parameterName = $"@p{parameterIndex++}";
                        parameters.Add(CreateCaseValueParameter(parameterName, result.Value, result.ValueType));
                        return parameterName;
                    }

                // =====================================
                // COLUMNA
                // =====================================
                case "COLUMN":
                    {
                        var tableAlias = GetTableAlias(aliases, result.SourceId);
                        return $"{Quote(tableAlias)}.{Quote(result.Column)}";
                    }

                // =====================================
                // NULL
                // =====================================
                case "NULL":
                    return "NULL";

                default:throw new InvalidOperationException($"Tipo de resultado CASE no permitido: {result.ResultType}");
            }
        }

        private static SqlParameter CreateCaseValueParameter(string parameterName, string? value, string? valueType)
        {
            var type = (valueType ?? "string").Trim().ToLowerInvariant();

            switch (type)
            {
                case "int":
                    return new SqlParameter(parameterName, SqlDbType.Int)
                    {
                        Value =int.TryParse(value, out var intValue) ? intValue : throw new InvalidOperationException($"El valor '{value}' no es un entero válido.")
                    };

                case "decimal":
                    return new SqlParameter(parameterName, SqlDbType.Decimal)
                    {
                        Value = decimal.TryParse(value, out var decimalValue ) ? decimalValue : throw new InvalidOperationException($"El valor '{value}' no es un decimal válido.")
                    };

                case "date":
                    return new SqlParameter(parameterName, SqlDbType.Date)
                    {
                        Value = DateTime.TryParse(value, out var dateValue) ? dateValue.Date : throw new InvalidOperationException($"El valor '{value}' no es una fecha válida.")
                    };

                case "datetime":
                    return new SqlParameter(parameterName, SqlDbType.DateTime2)
                    {
                        Value = DateTime.TryParse(value, out var dateTimeValue) ? dateTimeValue : throw new InvalidOperationException($"El valor '{value}' no es una fecha válida.")
                    };

                case "bit":
                    return new SqlParameter(parameterName, SqlDbType.Bit)
                    {
                        Value = value == "1" || string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)
                    };

                default:
                    return new SqlParameter(parameterName, SqlDbType.NVarChar)
                    {
                        Value =value ?? string.Empty
                    };
            }
        }

        private static void ValidateConditionalColumn(
    ReportConditionalColumn conditional,
    Dictionary<string, ReportColumnMetadata> metadata,
    Dictionary<string, (string Schema, string Table)> sources
)
        {
            if (
                string.IsNullOrWhiteSpace(
                    conditional.Alias
                )
            )
            {
                throw new InvalidOperationException(
                    "Toda columna condicional debe tener un alias."
                );
            }


            if (
                conditional.Cases == null ||
                conditional.Cases.Count == 0
            )
            {
                throw new InvalidOperationException(
                    $"La columna condicional '{conditional.Alias}' " +
                    "debe contener al menos un WHEN."
                );
            }


            foreach (
                var caseWhen
                in conditional.Cases
            )
            {
                if (
                    caseWhen.Conditions == null ||
                    caseWhen.Conditions.Count == 0
                )
                {
                    throw new InvalidOperationException(
                        $"La columna condicional '{conditional.Alias}' " +
                        "contiene un WHEN sin condiciones."
                    );
                }


                foreach (
                    var condition
                    in caseWhen.Conditions
                )
                {
                    ValidateReference(
                        condition,
                        metadata,
                        sources
                    );
                }


                ValidateCaseResult(
                    caseWhen.Result,
                    metadata,
                    sources
                );
            }


            ValidateCaseResult(
                conditional.ElseResult,
                metadata,
                sources
            );
        }

        private static void ValidateCaseResult(
    ReportCaseResult result,
    Dictionary<string, ReportColumnMetadata> metadata,
    Dictionary<string, (string Schema, string Table)> sources
)
        {
            if (result == null)
            {
                throw new InvalidOperationException(
                    "El resultado del CASE no está configurado."
                );
            }


            var type =
                (result.ResultType ?? string.Empty)
                    .Trim()
                    .ToUpperInvariant();


            if (
                type != "VALUE" &&
                type != "COLUMN" &&
                type != "NULL"
            )
            {
                throw new InvalidOperationException(
                    $"Tipo de resultado CASE no permitido: {result.ResultType}"
                );
            }


            if (type == "COLUMN")
            {
                ValidateReference(
                    result,
                    metadata,
                    sources
                );
            }
        }

        private static void AddGroupByCaseResult(Dictionary<string, ReportColumnReference> columns, ReportCaseResult result)
        {
            var key =
                SourceColumnKey(
                    result.SourceId,
                    result.Schema,
                    result.Table,
                    result.Column
                );

            columns[key] =
                new ReportColumnReference
                {
                    SourceId = result.SourceId,
                    Schema = result.Schema,
                    Table = result.Table,
                    Column = result.Column
                };
        }

        private static SqlParameter CreateTypedParameter(string parameterName, string? value, ReportColumnMetadata metadata)
        {
            if (value == null)
            {
                return new SqlParameter(parameterName, DBNull.Value);
            }

            var type = metadata.DataType.Trim().ToLowerInvariant();

            switch (type)
            {
                case "tinyint":
                    return new SqlParameter(parameterName, SqlDbType.TinyInt)
                    {
                        Value = byte.Parse(value, CultureInfo.InvariantCulture)
                    };

                case "smallint":
                    return new SqlParameter(parameterName, SqlDbType.SmallInt)
                    {
                        Value = short.Parse(value, CultureInfo.InvariantCulture)
                    };

                case "int":
                    return new SqlParameter(parameterName, SqlDbType.Int)
                    {
                        Value = int.Parse(value,CultureInfo.InvariantCulture)
                    };

                case "bigint":
                    return new SqlParameter(parameterName, SqlDbType.BigInt)
                    {
                        Value = long.Parse(value, CultureInfo.InvariantCulture)
                    };

                case "decimal":
                case "numeric":
                    {
                        if (!TryParseDecimal(value, out var decimalValue))
                        {
                            throw new InvalidOperationException($"El valor '{value}' no es un número válido " + $"para {metadata.Schema}.{metadata.Table}.{metadata.Column}.");
                        }
                        return new SqlParameter(parameterName, SqlDbType.Decimal)
                        {
                            Precision = metadata.Precision,
                            Scale = metadata.Scale,
                            Value = decimalValue
                        };
                    }

                case "money":
                case "smallmoney":
                    {
                        if (!TryParseDecimal(value, out var moneyValue))
                        {
                            throw new InvalidOperationException($"El valor '{value}' no es un importe válido.");
                        }
                        return new SqlParameter(parameterName, type == "money" ? SqlDbType.Money : SqlDbType.SmallMoney)
                        {
                            Value = moneyValue
                        };
                    }

                case "float":
                    return new SqlParameter(parameterName, SqlDbType.Float)
                    {
                        Value = double.Parse(value,CultureInfo.InvariantCulture)
                    };

                case "real":
                    return new SqlParameter(parameterName, SqlDbType.Real)
                    {
                        Value = float.Parse(value, CultureInfo.InvariantCulture)
                    };

                case "bit":
                    {
                        var bitValue = value == "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase);
                        return new SqlParameter(parameterName, SqlDbType.Bit)
                        {
                            Value = bitValue
                        };
                    }

                case "date":
                    {
                        var date = ParseDateValue(value, metadata);
                        return new SqlParameter(parameterName, SqlDbType.Date)
                        {
                            Value = date.Date
                        };
                    }

                case "datetime":
                case "smalldatetime":
                case "datetime2":
                    {
                        var date = ParseDateValue(value, metadata);
                        var sqlType =
                            type switch
                            {
                                "datetime2" => SqlDbType.DateTime2,
                                "smalldatetime" => SqlDbType.SmallDateTime,
                                _ => SqlDbType.DateTime
                            };

                        return new SqlParameter(parameterName, sqlType)
                        {
                            Value = date
                        };
                    }

                case "uniqueidentifier":
                    {
                        if (!Guid.TryParse(value, out var guid))
                        {
                            throw new InvalidOperationException(
                                $"El valor '{value}' no es un GUID válido."
                            );
                        }

                        return new SqlParameter(parameterName, SqlDbType.UniqueIdentifier)
                        {
                            Value = guid
                        };
                    }

                case "varchar":
                case "char":
                case "text":
                    return new SqlParameter(parameterName, SqlDbType.VarChar)
                    {
                        Value = value
                    };

                default:
                    return new SqlParameter(parameterName, SqlDbType.NVarChar)
                    {
                        Value = value
                    };
            }
        }

        private static bool TryParseDecimal(string value, out decimal result)
        {
            if ( decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out result))
            {
                return true;
            }

            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.GetCultureInfo("es-MX"),out result);
        }

        private static DateTime ParseDateValue(string value, ReportColumnMetadata metadata)
        {
            var formats =
                new[]
                {
                    "yyyy-MM-dd",
                    "yyyy-MM-ddTHH:mm",
                    "yyyy-MM-ddTHH:mm:ss",
                    "yyyy-MM-dd HH:mm",
                    "yyyy-MM-dd HH:mm:ss"
                };

            if (DateTime.TryParseExact(value, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var result))
            {
                return result;
            }

            // Formato mostrado al usuario en México.
            if (DateTime.TryParse(value, CultureInfo.GetCultureInfo("es-MX"), DateTimeStyles.None,out result))
            {
                return result;
            }

            throw new InvalidOperationException($"El valor '{value}' no es una fecha válida " + $"para {metadata.Schema}.{metadata.Table}.{metadata.Column}.");
        }

        private static Dictionary<string, (string Schema, string Table)>BuildSourceMap(ReportQueryRequest request)
        {
            var sources =
                new Dictionary<
                    string,
                    (string Schema, string Table)
                >(
                    StringComparer.OrdinalIgnoreCase
                );


            var mainSourceId =
                GetMainSourceId(
                    request
                );


            sources.Add(
                mainSourceId,
                (
                    request.MainSchema,
                    request.MainTable
                )
            );


            foreach (var join in request.Joins)
            {
                if (
                    string.IsNullOrWhiteSpace(
                        join.RightSourceId
                    )
                )
                {
                    throw new InvalidOperationException(
                        "Una relación no tiene identificador de fuente."
                    );
                }


                if (
                    sources.ContainsKey(
                        join.RightSourceId
                    )
                )
                {
                    throw new InvalidOperationException(
                        $"La fuente '{join.RightSourceId}' está duplicada."
                    );
                }


                sources.Add(
                    join.RightSourceId,
                    (
                        join.RightSchema,
                        join.RightTable
                    )
                );
            }


            return sources;
        }

        private static void ValidateSource(string sourceId, string schema, string table, Dictionary<string, (string Schema, string Table)> sources)
        {
            if (string.IsNullOrWhiteSpace(sourceId))
            {
                throw new InvalidOperationException($"La referencia {schema}.{table} no tiene SourceId.");
            }

            if (!sources.TryGetValue(sourceId, out var source))
            {
                throw new InvalidOperationException($"La fuente '{sourceId}' no forma parte de la consulta.");
            }

            if (
                !string.Equals(source.Schema, schema, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(source.Table, table, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(
                    $"La fuente '{sourceId}' corresponde a " +
                    $"{source.Schema}.{source.Table}, " +
                    $"no a {schema}.{table}."
                );
            }
        }

        private static string GetMainSourceId(ReportQueryRequest request)
        {
            return string.IsNullOrWhiteSpace(request.MainSourceId) ? "main" : request.MainSourceId;
        }

        private static void ValidateReference(DataBaseDto reference, Dictionary<string, ReportColumnMetadata> metadata, Dictionary<string, (string Schema, string Table)> sources)
        {
            ValidateSource(reference.SourceId, reference.Schema, reference.Table, sources);
            ValidateColumn(reference.Schema, reference.Table, reference.Column, metadata);
        }
    }
}