namespace SqlDataImporter.Models
{
    public class ReportQueryRequest
    {
        public string Server { get; set; } = string.Empty;
        public string User { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Database { get; set; } = string.Empty;
        public string MainSchema { get; set; } = string.Empty;
        public string MainTable { get; set; } = string.Empty;
        public List<ReportColumn> Columns { get; set; } = new();
        public List<ReportConcatColumn> ConcatColumns { get; set; } = new();
        public List<ReportJoin> Joins { get; set; } = new();
        public List<ReportFilter> Filters { get; set; } = new();
        public List<ReportOrder> OrderBy { get; set; } = new();
    }

    public class ReportColumn
    {
        public string Schema { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public string Column { get; set; } = string.Empty;
        public string? Alias { get; set; }
    }

    public class ReportJoin
    {
        public string JoinType { get; set; } = "INNER";
        public string LeftSchema { get; set; } = string.Empty;
        public string LeftTable { get; set; } = string.Empty;
        public string LeftColumn { get; set; } = string.Empty;
        public string RightSchema { get; set; } = string.Empty;
        public string RightTable { get; set; } = string.Empty;
        public string RightColumn { get; set; } = string.Empty;
    }

    public class ReportFilter
    {
        public string LogicalOperator { get; set; } = "AND";
        public string Schema { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public string Column { get; set; } = string.Empty;
        public string Operator { get; set; } = "=";
        public string? Value { get; set; }
        public string? ValueTo { get; set; }
        public List<string> Values { get; set; } = new();
    }

    public class ReportOrder
    {
        public string Schema { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public string Column { get; set; } = string.Empty;
        public string Direction { get; set; } = "ASC";
    }

    public class ReportConcatColumn
    {
        public List<ReportColumnReference> Columns { get; set; } = new();
        public string Separator { get; set; } = " ";
        public string Alias { get; set; } = string.Empty;
    }

    public class ReportColumnReference
    {
        public string Schema { get; set; } = string.Empty;
        public string Table { get; set; } = string.Empty;
        public string Column { get; set; } = string.Empty;
    }
}