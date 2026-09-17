(() => {
    const layoutSection = document.getElementById("layoutSection");
    const layoutFormat = document.getElementById("layoutFormat");
    const btnDownloadLayout = document.getElementById("btnDownloadLayout");
    const connectionForm = document.getElementById("connectionForm");
    const downloadUrl = btnDownloadLayout.dataset.downloadUrl;

    let selectedDatabase = null;
    let selectedSchema = null;
    let selectedTable = null;


    // ==========================================
    // TABLA SELECCIONADA
    // ==========================================

    document.addEventListener(
        "sqlTargetSelected",
        function (event) {
            selectedDatabase = event.detail.database;
            selectedSchema = event.detail.schema;
            selectedTable = event.detail.table;

            layoutSection.classList.remove(
                "d-none"
            );
        }
    );


    // ==========================================
    // SELECCIÓN LIMPIADA
    // ==========================================

    document.addEventListener(
        "sqlTargetCleared",
        function () {

            selectedDatabase = null;
            selectedSchema = null;
            selectedTable = null;

            layoutSection.classList.add(
                "d-none"
            );
        }
    );


    // ==========================================
    // DESCARGAR PLANTILLA
    // ==========================================

    btnDownloadLayout.addEventListener(
        "click",
        async function () {

            if (
                !selectedDatabase ||
                !selectedSchema ||
                !selectedTable
            ) {
                alert(
                    "Debe seleccionar una base de datos y una tabla."
                );

                return;
            }

            const format =
                layoutFormat.value;

            const formData =
                new FormData(
                    connectionForm
                );

            formData.append(
                "Database",
                selectedDatabase
            );

            formData.append(
                "Schema",
                selectedSchema
            );

            formData.append(
                "Table",
                selectedTable
            );

            formData.append(
                "Format",
                format
            );

            try {

                btnDownloadLayout.disabled =
                    true;

                btnDownloadLayout.innerText =
                    "Generando plantilla...";

                const response =
                    await fetch(
                        downloadUrl,
                        {
                            method: "POST",
                            body: formData
                        }
                    );

                if (!response.ok) {

                    const message =
                        await response.text();

                    throw new Error(
                        message ||
                        `Error HTTP ${response.status}`
                    );
                }

                const blob =
                    await response.blob();

                const url =
                    window.URL.createObjectURL(
                        blob
                    );

                const link =
                    document.createElement(
                        "a"
                    );

                link.href =
                    url;

                link.download =
                    `${selectedTable}_Layout.${format}`;

                document.body.appendChild(
                    link
                );

                link.click();

                link.remove();

                window.URL.revokeObjectURL(
                    url
                );

            }
            catch (error) {

                console.error(error);

                alert(
                    "No fue posible generar la plantilla: "
                    + error.message
                );

            }
            finally {

                btnDownloadLayout.disabled =
                    false;

                btnDownloadLayout.innerText =
                    "Descargar plantilla";
            }
        }
    );
})();