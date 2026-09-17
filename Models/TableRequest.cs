namespace SqlDataImporter.Models
{
    public class TableRequest
    {
        public string Server { get; set; } = string.Empty;

        public string User { get; set; } = string.Empty;

        public string Password { get; set; } = string.Empty;

        public string Database { get; set; } = string.Empty;

        public string Schema { get; set; } = string.Empty;

        public string Table { get; set; } = string.Empty;
    }
}