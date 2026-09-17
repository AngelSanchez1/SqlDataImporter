namespace SqlDataImporter.Models
{
    public class ImportRequest
    {
        public string Server { get; set; } = string.Empty;

        public string User { get; set; } = string.Empty;

        public string Password { get; set; } = string.Empty;

        public string Database { get; set; } = string.Empty;

        public string Schema { get; set; } = string.Empty;

        public string Table { get; set; } = string.Empty;

        public List<string> RuleColumns { get; set; } = [];

        public IFormFile? File { get; set; }
    }
}