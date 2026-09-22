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

            // =====================================
            // COLUMNAS CONDICIONALES
            // =====================================
            foreach (var conditional in request.ConditionalColumns)
            {
                var expression = BuildConditionalColumnExpression(conditional, tableAliases, result.Parameters, ref parameterIndex);
                var outputName = ResolveOutputName(conditional.Alias, "case", conditional.Alias, outputNames);
                selectExpressions.Add($"    {expression} AS {Quote(outputName)}");
            }

            // =====================================
            // METRICAS / AGREGADOS
            // =====================================

            foreach (var metric in request.Metrics)
            {
                var expression = BuildMetricExpression(metric, tableAliases, result.Parameters, ref parameterIndex);
                var outputName = ResolveOutputName(metric.Alias, "metric", metric.Alias, outputNames);

                selectExpressions.Add(
                    $"    {expression} AS {Quote(outputName)}"
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

        private static void ValidateRequest(ReportQueryRequest request, Dictionary<string, ReportColumnMetadata> metadata)
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

            foreach (var conditional in request.ConditionalColumns)
            {
                ValidateConditionalColumn(conditional, metadata);
            }

            foreach (var metric in request.Metrics)
            {
                ValidateMetric(metric, metadata);
            }

            foreach (var group in request.GroupBy)
            {
                ValidateColumn(group.Schema, group.Table, group.Column, metadata);
            }

            foreach (var having in request.Having)
            {
                ValidateColumn(having.Schema, having.Table, having.Column, metadata);
            }

            foreach (var join in request.Joins)
            {
                if (
                    string.IsNullOrWhiteSpace(join.LeftSchema) ||
                    string.IsNullOrWhiteSpace(join.LeftTable) ||
                    string.IsNullOrWhiteSpace(join.LeftColumn) ||
                    string.IsNullOrWhiteSpace(join.RightSchema) ||
                    string.IsNullOrWhiteSpace(join.RightTable) ||
                    string.IsNullOrWhiteSpace(join.RightColumn)
                )
                {
                    throw new InvalidOperationException(
                        $"La relación con {join.LeftTable} está incompleta. " +
                        "Seleccione la tabla origen, columna origen, " +
                        "tabla relacionada y columna relacionada."
                    );
                }

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
    Dictionary<string, ReportColumnMetadata> metadata
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

            if (string.IsNullOrWhiteSpace(metric.Alias))
            {
                throw new InvalidOperationException(
                    "Toda métrica debe tener un alias."
                );
            }


            // COUNT(*) puede no tener columna.
            var countAll =
                function == "COUNT" &&
                string.IsNullOrWhiteSpace(metric.Column);


            if (!countAll)
            {
                ValidateColumn(
                    metric.Schema,
                    metric.Table,
                    metric.Column,
                    metadata
                );


                var columnMetadata =
                    metadata[
                        ColumnKey(
                            metric.Schema,
                            metric.Table,
                            metric.Column
                        )
                    ];


                if (function is "SUM" or "AVG" && !IsNumericType(columnMetadata.DataType))
                {
                    throw new InvalidOperationException(
                        $"{function} solamente puede utilizar columnas numéricas. " +
                        $"La columna {metric.Schema}.{metric.Table}.{metric.Column} " +
                        $"es de tipo {columnMetadata.DataType}."
                    );
                }
            }

            foreach (var condition in metric.Conditions)
            {
                ValidateColumn(condition.Schema, condition.Table, condition.Column, metadata);
            }

            if (metric.ArithmeticValue.HasValue)
            {
                var allowedOperators =
                    new[]
                    {
                        "+",
                        "-",
                        "*",
                        "/"
                    };

                if (string.IsNullOrWhiteSpace(metric.ArithmeticOperator) || !allowedOperators.Contains(metric.ArithmeticOperator))
                {
                    throw new InvalidOperationException("El operador aritmético de la métrica no es válido.");
                }

                if (function == "COUNT")
                {
                    throw new InvalidOperationException("COUNT no admite transformación aritmética sobre la columna.");
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

        private static string BuildMetricExpression(ReportMetric metric, Dictionary<string, string> aliases, List<SqlParameter> parameters, ref int parameterIndex)
        {
            var function = metric.Function.Trim().ToUpperInvariant();

            if (function == "COUNT" && string.IsNullOrWhiteSpace(metric.Column))
            {
                if (metric.Conditions == null || metric.Conditions.Count == 0)
                {
                    return "COUNT(*)";
                }

                var condition = BuildMetricConditions(metric.Conditions, aliases, parameters, ref parameterIndex);

                return $"COUNT(CASE WHEN {condition} THEN 1 END)";
            }

            var tableAlias = GetTableAlias(aliases, metric.Schema, metric.Table);
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
            var conditions = BuildMetricConditions(metric.Conditions, aliases, parameters, ref parameterIndex);

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

        private static string BuildMetricConditions(List<ReportMetricCondition> conditions, Dictionary<string, string> aliases, List<SqlParameter> parameters, ref int parameterIndex)
        {
            var expressions = new List<string>();

            for (var i = 0; i < conditions.Count; i++)
            {
                var condition = conditions[i];
                var expression = BuildMetricCondition(condition, aliases, parameters, ref parameterIndex);

                if (i > 0)
                {
                    var logical = string.Equals(condition.LogicalOperator, "OR", StringComparison.OrdinalIgnoreCase) ? "OR" : "AND";
                    expressions.Add(logical);
                }

                expressions.Add(expression);
            }

            return string.Join(" ", expressions);
        }

        private static string BuildMetricCondition(ReportMetricCondition condition, Dictionary<string, string> aliases, List<SqlParameter> parameters, ref int parameterIndex)
        {
            var tableAlias = GetTableAlias(aliases, condition.Schema, condition.Table);
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
                        parameters.Add(new SqlParameter(parameterName, condition.Value ?? (object)DBNull.Value));
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
                            parameters.Add(new SqlParameter(parameterName, value));
                        }

                        var sqlOperator = op == "IN" ? "IN" : "NOT IN";

                        return$"{column} {sqlOperator} " + $"({string.Join(", ", names)})";
                    }


                default: throw new InvalidOperationException($"Operador no permitido en la métrica: {condition.Operator}");
            }
        }

        private static void AppendGroupBy(StringBuilder sql, ReportQueryRequest request, Dictionary<string, string> aliases)
        {
            if (request.Metrics == null || request.Metrics.Count == 0)
            {
                return;
            }

            var groupColumns = new Dictionary<string, ReportColumnReference>(StringComparer.OrdinalIgnoreCase);

            // =========================================
            // 1. COLUMNAS NORMALES DEL SELECT
            // =========================================
            foreach (var column in request.Columns)
            {
                var key =ColumnKey(column.Schema, column.Table, column.Column);
                groupColumns[key] =
                    new ReportColumnReference
                    {
                        Schema = column.Schema,
                        Table = column.Table,
                        Column = column.Column
                    };
            }

            // =========================================
            // 2. COLUMNAS UTILIZADAS EN CONCAT
            // =========================================
            foreach (var concat in request.ConcatColumns)
            {
                foreach (var column in concat.Columns)
                {
                    var key = ColumnKey(column.Schema, column.Table, column.Column);
                    groupColumns[key] =
                        new ReportColumnReference
                        {
                            Schema = column.Schema,
                            Table = column.Table,
                            Column = column.Column
                        };
                }
            }

            // =========================================
            // 3. COLUMNAS UTILIZADAS EN CASE WHEN
            // =========================================
            foreach (var conditional in request.ConditionalColumns)
            {
                if (conditional.Cases == null)
                {
                    continue;
                }

                foreach (var caseWhen in conditional.Cases)
                {
                    // -------------------------------------
                    // Columnas utilizadas en el WHEN
                    // -------------------------------------
                    if (caseWhen.Conditions != null)
                    {
                        foreach (var condition in caseWhen.Conditions)
                        {
                            if (string.IsNullOrWhiteSpace(condition.Schema) || string.IsNullOrWhiteSpace(condition.Table) || string.IsNullOrWhiteSpace(condition.Column))
                            {
                                continue;
                            }

                            var key = ColumnKey(condition.Schema, condition.Table, condition.Column);
                            groupColumns[key] =
                                new ReportColumnReference
                                {
                                    Schema = condition.Schema,
                                    Table = condition.Table,
                                    Column = condition.Column
                                };
                        }
                    }

                    // -------------------------------------
                    // Si THEN devuelve otra columna
                    // -------------------------------------
                    if (caseWhen.Result != null && string.Equals(caseWhen.Result.ResultType, "COLUMN", StringComparison.OrdinalIgnoreCase))
                    {
                        AddGroupByCaseResult(groupColumns, caseWhen.Result);
                    }
                }

                // -----------------------------------------
                // Si ELSE devuelve otra columna
                // -----------------------------------------
                if (conditional.ElseResult != null && string.Equals(conditional.ElseResult.ResultType, "COLUMN", StringComparison.OrdinalIgnoreCase))
                {
                    AddGroupByCaseResult(groupColumns, conditional.ElseResult);
                }
            }

            // =========================================
            // 4. GROUP BY EXPLÍCITO
            // =========================================
            foreach (var column in request.GroupBy)
            {
                var key = ColumnKey(column.Schema,column.Table, column.Column);
                groupColumns[key] =
                    new ReportColumnReference
                    {
                        Schema = column.Schema,
                        Table = column.Table,
                        Column = column.Column
                    };
            }

            // =========================================
            // SIN COLUMNAS PARA AGRUPAR
            // =========================================
            if (groupColumns.Count == 0)
            {
                return;
            }

            // =========================================
            // GENERAR GROUP BY
            // =========================================
            sql.AppendLine();
            sql.AppendLine();
            sql.AppendLine(
                "GROUP BY"
            );

            var expressions =
                groupColumns.Values
                    .Select(
                        column =>
                        {
                            var alias = GetTableAlias(aliases,column.Schema,column.Table);
                            return $"    {Quote(alias)}.{Quote(column.Column)}";
                        }
                    );

            sql.Append(string.Join("," + Environment.NewLine, expressions));
        }

        private static string BuildConditionalColumnExpression(ReportConditionalColumn conditional, Dictionary<string, string> aliases, List<SqlParameter> parameters, ref int parameterIndex)
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

                var condition = BuildMetricConditions(caseWhen.Conditions, aliases, parameters, ref parameterIndex);
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
                        var tableAlias = GetTableAlias(aliases, result.Schema, result.Table);
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

        private static void ValidateConditionalColumn(ReportConditionalColumn conditional, Dictionary<string, ReportColumnMetadata> metadata)
        {
            if (string.IsNullOrWhiteSpace(conditional.Alias))
            {
                throw new InvalidOperationException("Toda columna condicional debe tener un alias.");
            }

            if (conditional.Cases == null || conditional.Cases.Count == 0)
            {
                throw new InvalidOperationException($"La columna condicional '{conditional.Alias}' " + "debe contener al menos un WHEN.");
            }

            foreach (var caseWhen in conditional.Cases)
            {
                if (caseWhen.Conditions == null || caseWhen.Conditions.Count == 0)
                {
                    throw new InvalidOperationException($"La columna condicional '{conditional.Alias}' " + "contiene un WHEN sin condiciones.");
                }

                foreach (var condition in caseWhen.Conditions)
                {
                    ValidateColumn(condition.Schema, condition.Table, condition.Column, metadata);
                }

                ValidateCaseResult(caseWhen.Result, metadata);
            }

            ValidateCaseResult(conditional.ElseResult, metadata);
        }

        private static void ValidateCaseResult(ReportCaseResult result, Dictionary<string, ReportColumnMetadata> metadata)
        {
            var type = (result.ResultType ?? string.Empty).Trim().ToUpperInvariant();

            if (type != "VALUE" && type != "COLUMN" && type != "NULL")
            {
                throw new InvalidOperationException($"Tipo de resultado CASE no permitido: {result.ResultType}");
            }

            if (type == "COLUMN")
            {
                ValidateColumn(result.Schema, result.Table, result.Column, metadata);
            }
        }

        private static void AddGroupByCaseResult(Dictionary<string, ReportColumnReference> columns, ReportCaseResult result)
        {
            var key = ColumnKey(result.Schema, result.Table, result.Column);

            columns[key] =
                new ReportColumnReference
                {
                    Schema = result.Schema,
                    Table = result.Table,
                    Column = result.Column
                };
        }
    }
}