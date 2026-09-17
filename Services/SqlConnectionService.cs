using Microsoft.Data.SqlClient;

namespace SqlDataImporter.Services
{
    public class SqlConnectionService : ISqlConnectionService
    {

        public async Task<bool> TestConnectionAsync(string server, string user, string password)
        {
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

            return true;
        }
    }
}
