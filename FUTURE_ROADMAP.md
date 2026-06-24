# Roadmap y Notas Futuras - Dashboard KPIs

Este documento guarda las ideas y arquitecturas discutidas para futuras implementaciones del proyecto, para que puedan ser retomadas en cualquier momento.

## 1. Versión de Escritorio (Desktop App)
El objetivo futuro es transformar la aplicación web actual (React + Vite) en una aplicación de escritorio nativa para lograr mayor integración con el sistema operativo (acceso a archivos locales, notificaciones nativas, ejecución en segundo plano).

**Enfoque Recomendado:**
*   **Tauri:** Utilizar Tauri (basado en Rust) para envolver la aplicación. Es mucho más ligero que Electron y generará ejecutables (.exe) de menor tamaño y con menor consumo de RAM.
*   **Arquitectura:** El frontend (React) se comunicará con el backend de escritorio (Rust) mediante IPC (Inter-Process Communication) para solicitar permisos y lectura de archivos locales de manera segura.
*   **PWA:** Actualmente la app ya tiene configuración básica de PWA (Progressive Web App), lo que permite instalarla desde el navegador como un paso intermedio.

## 2. Integración Bidireccional con Google Sheets
El objetivo es registrar un historial (log) de actividades en un Google Sheet (quién hace qué, cuándo y en qué proyecto) y permitir que los cambios en el Excel se reflejen en la app.

**Enfoques Discutidos:**
*   **Opción A - Google Apps Script (Recomendado por ser simple y sin costo extra):**
    *   Crear un script en el Google Sheet que exponga una URL pública (Web App).
    *   La aplicación React enviará peticiones HTTP POST a esta URL cada vez que un usuario cargue una nota o cambie el estado de un proyecto.
    *   El Apps Script recibe la petición e inserta la fila en la hoja de cálculo.
*   **Opción B - Firebase Cloud Functions (Más robusto):**
    *   Crear una Cuenta de Servicio en Google Cloud con acceso a la Google Sheet.
    *   Desplegar una función en Firebase que se encargue de la autenticación segura.
    *   La app notifica a la Cloud Function, y esta se encarga de escribir/leer en el Google Sheet usando la API oficial de Google Sheets.

*Nota: No guardar nunca credenciales de Google (archivos JSON de Service Accounts) en el código frontend (React) por motivos de seguridad.*
