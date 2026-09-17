(() => {

    let selectedDatabase = null;
    let selectedSchema = null;
    let selectedTable = null;

    let selectedImportFile = null;


    const importSection =
        document.getElementById("importSection");

    const ruleColumns =
        document.getElementById("ruleColumns");

    const connectionForm =
        document.getElementById("connectionForm");


    // ==========================================
    // DROPZONE
    // ==========================================

    const importFile =
        document.getElementById("importFile");

    const dropZone =
        document.getElementById("dropZone");

    const btnSelectFile =
        document.getElementById("btnSelectFile");

    const selectedFile =
        document.getElementById("selectedFile");

    const selectedFileName =
        document.getElementById("selectedFileName");

    const selectedFileSize =
        document.getElementById("selectedFileSize");

    const btnRemoveFile =
        document.getElementById("btnRemoveFile");

    const fileError =
        document.getElementById("fileError");

    const btnValidateImport =
        document.getElementById("btnValidateImport");


    // ==========================================
    // TABLA SELECCIONADA
    // ==========================================

    document.addEventListener(
        "sqlTargetSelected",
        async function (event) {

            selectedDatabase =
                event.detail.database;

            selectedSchema =
                event.detail.schema;

            selectedTable =
                event.detail.table;

            limpiarArchivo();

            importSection.classList.remove(
                "d-none"
            );

            await loadColumns();
        }
    );


    // ==========================================
    // TABLA LIMPIADA
    // ==========================================

    document.addEventListener(
        "sqlTargetCleared",
        function () {

            selectedDatabase = null;
            selectedSchema = null;
            selectedTable = null;

            ruleColumns.innerHTML = "";

            limpiarArchivo();

            importSection.classList.add(
                "d-none"
            );
        }
    );


    // ==========================================
    // SELECCIONAR ARCHIVO CON BOTÓN
    // ==========================================

    btnSelectFile.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            importFile.click();
        }
    );


    // También permite hacer click en cualquier parte
    // del Dropzone
    dropZone.addEventListener(
        "click",
        function (event) {

            if (
                event.target === btnSelectFile
            ) {
                return;
            }

            importFile.click();
        }
    );


    importFile.addEventListener(
        "change",
        function () {

            const file =
                this.files.length > 0
                    ? this.files[0]
                    : null;

            procesarArchivoSeleccionado(
                file
            );
        }
    );


    // ==========================================
    // DRAG & DROP
    // ==========================================

    dropZone.addEventListener(
        "dragover",
        function (event) {

            event.preventDefault();

            dropZone.classList.add(
                "is-dragging"
            );
        }
    );


    dropZone.addEventListener(
        "dragleave",
        function () {

            dropZone.classList.remove(
                "is-dragging"
            );
        }
    );


    dropZone.addEventListener(
        "drop",
        function (event) {

            event.preventDefault();

            dropZone.classList.remove(
                "is-dragging"
            );

            if (
                !event.dataTransfer.files ||
                event.dataTransfer.files.length === 0
            ) {
                return;
            }

            if (
                event.dataTransfer.files.length > 1
            ) {

                mostrarErrorArchivo(
                    "Sólo puede seleccionar un archivo por importación."
                );

                return;
            }

            const file =
                event.dataTransfer.files[0];

            procesarArchivoSeleccionado(
                file
            );
        }
    );


    // ==========================================
    // QUITAR ARCHIVO
    // ==========================================

    btnRemoveFile.addEventListener(
        "click",
        function () {

            limpiarArchivo();
        }
    );


    // ==========================================
    // PROCESAR ARCHIVO
    // ==========================================

    function procesarArchivoSeleccionado(
        file
    ) {

        limpiarErrorArchivo();

        if (!file) {
            return;
        }


        const extension =
            obtenerExtension(
                file.name
            );


        if (
            extension !== "xlsx" &&
            extension !== "csv"
        ) {

            limpiarArchivo();

            mostrarErrorArchivo(
                "El archivo debe ser Excel (.xlsx) o CSV (.csv)."
            );

            return;
        }


        // Opcional: límite de 20 MB
        const maxFileSize =
            20 * 1024 * 1024;

        if (
            file.size > maxFileSize
        ) {

            limpiarArchivo();

            mostrarErrorArchivo(
                "El archivo no puede superar los 20 MB."
            );

            return;
        }


        selectedImportFile =
            file;


        selectedFileName.textContent =
            file.name;

        selectedFileSize.textContent =
            formatearTamanoArchivo(
                file.size
            );


        selectedFile.classList.remove(
            "d-none"
        );

        dropZone.classList.add(
            "has-file"
        );


        btnValidateImport.disabled =
            false;
    }


    // ==========================================
    // LIMPIAR ARCHIVO
    // ==========================================

    function limpiarArchivo() {

        selectedImportFile =
            null;

        importFile.value =
            "";

        selectedFileName.textContent =
            "";

        selectedFileSize.textContent =
            "";

        selectedFile.classList.add(
            "d-none"
        );

        dropZone.classList.remove(
            "has-file",
            "is-dragging"
        );

        btnValidateImport.disabled =
            true;

        limpiarErrorArchivo();
    }


    // ==========================================
    // ERROR ARCHIVO
    // ==========================================

    function mostrarErrorArchivo(
        message
    ) {

        fileError.textContent =
            message;

        fileError.classList.remove(
            "d-none"
        );
    }


    function limpiarErrorArchivo() {

        fileError.textContent =
            "";

        fileError.classList.add(
            "d-none"
        );
    }


    // ==========================================
    // EXTENSIÓN
    // ==========================================

    function obtenerExtension(
        fileName
    ) {

        const parts =
            fileName.split(".");

        if (
            parts.length < 2
        ) {
            return "";
        }

        return parts
            .pop()
            .toLowerCase();
    }


    // ==========================================
    // TAMAÑO LEGIBLE
    // ==========================================

    function formatearTamanoArchivo(
        bytes
    ) {

        if (bytes === 0) {
            return "0 bytes";
        }

        const units =
            [
                "bytes",
                "KB",
                "MB",
                "GB"
            ];

        const index =
            Math.floor(
                Math.log(bytes) /
                Math.log(1024)
            );

        const size =
            bytes /
            Math.pow(
                1024,
                index
            );

        return (
            size.toFixed(
                index === 0
                    ? 0
                    : 2
            )
            + " "
            + units[index]
        );
    }


    // ==========================================
    // CARGAR COLUMNAS
    // ==========================================

    async function loadColumns() {

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

        try {

            const response =
                await fetch(
                    "/Connection/GetColumns",
                    {
                        method: "POST",
                        body: formData
                    }
                );

            if (!response.ok) {

                throw new Error(
                    `Error HTTP ${response.status}`
                );
            }

            const data =
                await response.json();

            if (!data.success) {

                throw new Error(
                    data.message
                );
            }

            renderRuleColumns(
                data.columns
            );

        }
        catch (error) {

            console.error(error);

            alert(
                "No fue posible obtener las columnas: "
                + error.message
            );
        }
    }


    // ==========================================
    // MOSTRAR COLUMNAS REGLA
    // ==========================================

    function renderRuleColumns(
        columns
    ) {

        ruleColumns.innerHTML =
            "";

        const availableColumns =
            columns.filter(
                column =>

                    !column.isIdentity &&
                    !column.isComputed &&
                    column.dataType !== "timestamp" &&
                    column.dataType !== "rowversion"
            );


        availableColumns.forEach(
            column => {

                const wrapper =
                    document.createElement(
                        "div"
                    );

                wrapper.className =
                    "form-check mb-2";


                wrapper.innerHTML = `
                    <input
                        class="form-check-input rule-column"
                        type="checkbox"
                        value="${column.name}"
                        id="rule_${column.columnId}">

                    <label
                        class="form-check-label"
                        for="rule_${column.columnId}">

                        ${column.name}

                        <span class="text-muted">
                            (${column.dataType})
                        </span>

                    </label>
                `;


                ruleColumns.appendChild(
                    wrapper
                );
            }
        );
    }

})();