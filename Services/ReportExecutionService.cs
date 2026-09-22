using System.Data;
using Microsoft.Data.SqlClient;
using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public class ReportExecutionService : IReportExecutionService
    {
        private readonly IReportQueryBuilderService _queryBuilder;

        public ReportExecutionService(
            IReportQueryBuilderService queryBuilder
        )
        {
            _queryBuilder = queryBuilder;
        }

        public async Task<DataTable> ExecuteAsync(ReportQueryRequest request, bool preview)
        {
            var connectionString = BuildConnectionString(request);

            await using var connection = new SqlConnection(connectionString);

            await connection.OpenAsync();

            var definition = await _queryBuilder.BuildAsync(connection, request, preview);

            await using var command = new SqlCommand(definition.Sql, connection);

            command.CommandTimeout = 120;

            foreach (var parameter in definition.Parameters)
            {
                command.Parameters.Add(parameter);
            }

            await using var reader = await command.ExecuteReaderAsync();

            var table = new DataTable();

            table.Load(reader);

            return table;
        }

        private static string BuildConnectionString(ReportQueryRequest request)
        {
            var builder =
                new SqlConnectionStringBuilder
                {
                    DataSource = request.Server,
                    InitialCatalog = request.Database,
                    UserID = request.User,
                    Password = request.Password,
                    TrustServerCertificate = true,
                    Encrypt = false
                };

            return builder.ConnectionString;
        }
    }
}