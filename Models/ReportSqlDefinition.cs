using Microsoft.Data.SqlClient;

namespace SqlDataImporter.Models
{
    public class ReportSqlDefinition
    {
        public string Sql { get; set; } = string.Empty;
        public List<SqlParameter> Parameters { get; set; } = new();
    }
}