namespace SqlDataImporter.Models
{
    public class ImportExecutionResult
    {
        public int TotalRows { get; set; }
        public int InsertedRows { get; set; }
        public int ExistingRows { get; set; }
        public int DuplicateRows { get; set; }
    }
}