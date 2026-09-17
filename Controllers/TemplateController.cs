using Microsoft.AspNetCore.Mvc;
using SqlDataImporter.Models;

namespace SqlDataImporter.Controllers
{
    public class TemplateController : Controller
    {
        [HttpGet]
        public IActionResult Index()
        {
            return View(new ConnectionRequest());
        }
    }
}