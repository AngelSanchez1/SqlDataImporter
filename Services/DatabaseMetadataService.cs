using Microsoft.Data.SqlClient;
using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public class DatabaseMetadataService : IDatabaseMetadataService
    {
        public async Task<List<string>> GetDatabasesAsync(string server, string user, string password)
        {
            var databases = new List<string>();

            var builder = new SqlConnectionStringBuilder
            {
                DataSource = server,
                UserID = user,
                Password = password,
                TrustServerCertificate = true,
                ConnectTimeout = 10
            };

            await using var connection = new SqlConnection(builder.ConnectionString);

            await connection.OpenAsync();

            const string query = @"
                SELECT name
                FROM sys.databases
                WHERE state = 0
                  AND HAS_DBACCESS(name) = 1
                ORDER BY name;                
            ";

            await using var command = new SqlCommand(query, connection);

            await using var reader = await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                databases.Add(reader.GetString(0));
            }

            return databases;
        }

        public async Task<List<TableInfo>> GetTablesAsync(string server, string user, string password, string database)
        {
            var tables = new List<TableInfo>();

            var builder = new SqlConnectionStringBuilder
            {
                DataSource = server,
                UserID = user,
                Password = password,
                InitialCatalog = database,
                TrustServerCertificate = true,
                ConnectTimeout = 10
            };

            await using var connection =
                new SqlConnection(builder.ConnectionString);

            await connection.OpenAsync();

            const string query = @"
                SELECT
                    s.name AS SchemaName,
                    t.name AS TableName
                FROM sys.tables t
                INNER JOIN sys.schemas s
                    ON t.schema_id = s.schema_id
                WHERE t.is_ms_shipped = 0
                ORDER BY
                    s.name,
                    t.name;
                ";

            await using var command =
                new SqlCommand(query, connection);

            await using var reader =
                await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                tables.Add(new TableInfo
                {
                    Schema = reader.GetString(0),
                    Name = reader.GetString(1)
                });
            }

            return tables;
        }

        public async Task<List<ColumnInfo>> GetColumnsAsync(string server, string user, string password, string database, string schema, string table)
        {
            var columns = new List<ColumnInfo>();

            var builder =
                new SqlConnectionStringBuilder
                {
                    DataSource = server,
                    UserID = user,
                    Password = password,
                    InitialCatalog = database,
                    TrustServerCertificate = true,
                    ConnectTimeout = 10
                };

            await using var connection = new SqlConnection(builder.ConnectionString);

            await connection.OpenAsync();

            const string query = @"
                SELECT
                    c.column_id,
                    c.name AS ColumnName,
                    t.name AS DataType,
                    c.max_length,
                    c.precision,
                    c.scale,
                    c.is_nullable,
                    c.is_identity,
                    c.is_computed,
                    dc.definition AS DefaultValue
                FROM sys.columns c
                INNER JOIN sys.tables tb
                    ON c.object_id = tb.object_id
                INNER JOIN sys.schemas s
                    ON tb.schema_id = s.schema_id
                INNER JOIN sys.types t
                    ON c.user_type_id = t.user_type_id
                LEFT JOIN sys.default_constraints dc
                    ON c.default_object_id = dc.object_id
                WHERE
                    s.name = @Schema
                    AND tb.name = @Table
                ORDER BY
                    c.column_id;
                ";

            await using var command =new SqlCommand(query, connection);

            command.Parameters.AddWithValue("@Schema", schema);
            command.Parameters.AddWithValue("@Table", table);

            await using var reader =
                await command.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                columns.Add(
                    new ColumnInfo
                    {
                        ColumnId = reader.GetInt32(0),
                        Name = reader.GetString(1),
                        DataType = reader.GetString(2),
                        MaxLength = reader.GetInt16(3),
                        Precision = reader.GetByte(4),
                        Scale = reader.GetByte(5),
                        IsNullable = reader.GetBoolean(6),
                        IsIdentity = reader.GetBoolean(7),
                        IsComputed = reader.GetBoolean(8),
                        DefaultValue = reader.IsDBNull(9) ? null : reader.GetString(9)
                    });
            }

            return columns;
        }
    }
}
