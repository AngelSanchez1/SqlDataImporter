using Microsoft.Data.SqlClient;
using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public interface IReportQueryBuilderService
    {
        Task<ReportSqlDefinition> BuildAsync(SqlConnection connection, ReportQueryRequest request, bool preview);
    }
}