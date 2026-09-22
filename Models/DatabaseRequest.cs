namespace SqlDataImporter.Models
{
    public class DatabaseRequest : ConnectionBase
    {
        public string Database { get; set; } = string.Empty;
    }
}