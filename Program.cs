using SqlDataImporter.Services;

var builder = WebApplication.CreateBuilder(args);

// Servicios MVC
builder.Services.AddControllersWithViews().AddRazorRuntimeCompilation();

// Servicios propios
#region Servicios
builder.Services.AddScoped<ISqlConnectionService, SqlConnectionService>();
builder.Services.AddScoped<IDatabaseMetadataService, DatabaseMetadataService>();
builder.Services.AddScoped<ILayoutService, LayoutService>();
builder.Services.AddScoped<ISqlImportService, SqlImportService>();
builder.Services.AddScoped<IImportFileReaderService, ImportFileReaderService>();
builder.Services.AddScoped<IReportQueryBuilderService, ReportQueryBuilderService>();
builder.Services.AddScoped<IReportExecutionService, ReportExecutionService>();
#endregion

var app = builder.Build();

// Configuración del pipeline HTTP
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Template}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();