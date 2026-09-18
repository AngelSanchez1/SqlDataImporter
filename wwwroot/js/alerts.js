window.AppAlert = {
    success: function (title, message = "") {
        return Swal.fire({
            icon: "success",
            title: title,
            text: message,
            confirmButtonText: "Aceptar"
        });
    },
    error: function (title, message = "") {
        return Swal.fire({
            icon: "error",
            title: title,
            text: message,
            confirmButtonText: "Aceptar"
        });
    },
    warning: function (title,mmessage = "") {
        return Swal.fire({
            icon: "warning",
            title: title,
            text: message,
            confirmButtonText: "Aceptar"
        });
    },
    info: function (title, message = "") {
        return Swal.fire({
            icon: "info",
            title: title,
            text: message,
            confirmButtonText: "Aceptar"
        });
    },
    confirm: function (
        title,
        message = "",
        confirmText = "Confirmar",
        cancelText = "Cancelar"
    ) {
        return Swal.fire({
            icon: "question",
            title: title,
            text: message,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            reverseButtons: true
        });
    },
    loading: function (
        title = "Procesando...",
        message = "Espere un momento."
    ) {
        Swal.fire({
            title: title,
            text: message,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    },
    close: function () {
        Swal.close();
    }
};