namespace SqlDataImporter.Models
{
    public class ConnectionBase
    {
        public string Server { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class DataBaseDto
    {
        public string Schema { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public string Column { get; set; } = string.Empty;
    }
}