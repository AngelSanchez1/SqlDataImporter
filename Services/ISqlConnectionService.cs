namespace SqlDataImporter.Services
{
    public interface ISqlConnectionService
    {
        Task<bool> TestConnectionAsync(string server, string user, string password);
    }
}