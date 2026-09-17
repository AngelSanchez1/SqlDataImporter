using SqlDataImporter.Models;

namespace SqlDataImporter.Services
{
    public interface IDatabaseMetadataService
    {
        Task<List<string>> GetDatabasesAsync(string server, string user, string password);
        Task<List<TableInfo>> GetTablesAsync(string server, string user, string password, string database);
        Task<List<ColumnInfo>> GetColumnsAsync(string server, string user, string password, string database, string schema, string table);
    }
}