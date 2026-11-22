# Custodios de la Innovación — Estudio de Automatización

Aplicación web full-stack y prototipo funcional desarrollado para el proyecto **«Custodios de la Innovación: Forjando Conexiones Avanzadas»** (*Seminario de Actualización*), orientado a la automatización del proceso empresarial de **Recepción, Validación Tributaria y Causación Contable de Facturas Electrónicas** con arquitectura **Node-RED**, servicios REST, inteligencia artificial aplicada (**Gemini**) e integración real con **Gmail API**.

---

## Módulos y funcionalidades principales

1. **Análisis del Proceso (AS-IS vs. TO-BE)**
   - Caracterización de entradas, salidas, actores, dependencias, puntos de decisión y cuellos de botella.
   - Calculadora interactiva de retorno de inversión (ROI), ahorro de horas-hombre y reducción de retrabajo por errores contables.

2. **Flujo Real Automatizado (Motor Express + Exportación Node-RED)**
   - **Modo 1 · Factura Real**: Carga de archivos reales (`PDF`, `PNG`, `JPG`, `XML UBL 2.1`, `TXT`) o texto plano procesados mediante parser XML determinístico y extracción multimodal con Gemini (`@google/genai` en servidor).
   - **Modo 2 · Carga Estructurada y Pruebas de Fallo**: Escenarios nominales e inyección controlada de fallos (`HTTP 503` con bucle de reintentos exponenciales hasta 3 intentos y `HTTP 422` por XML corrupto o desviación presupuestal).
   - **Modo 3 · Webhooks Reales y Seguridad HMAC-SHA256**: Endpoint público `POST /api/webhook/invoices` con validación opcional de firma criptográfica en la cabecera `X-Webhook-Signature`, botones de prueba en vivo (petición sin firma `401` vs. firma HMAC válida `201/202`), generador de `cURL` y configuración de webhook saliente.
   - **Modo 4 · Bandeja Gmail (Entrada)**: Lectura real de correos y adjuntos desde la bandeja del usuario autorizado (`gmail.readonly`) para ejecutar facturas recibidas por correo directamente en el flujo automatizado, junto con confirmación modal previa al envío de notificaciones reales (`gmail.send`).
   - **Cola de Cuarentena HITL, Libro ERP y Órdenes de Compra**: Persistencia en servidor (`data/automation_db.json`), aprobación/rechazo manual de excepciones, control de idempotencia (`HTTP 409`), exportación **CSV contable** del libro ERP (`ASIENTO`, `Factura`, `NIT`, `Proveedor`, `OC`, `CuentaPUC`, `CentroCosto`, `ValorBruto`, `Retefuente`, `NetoPagar`, `Fecha`) y exportación del flujo importable **`flows.json` para Node-RED**.

3. **Diagrama BPMN 2.0 y Marco Tecnológico**
   - Diagrama vectorial BPMN 2.0 por carriles funcionales (*swimlanes*) con evento intermedio de error, descargable en formato `.svg`.
   - Comparativa arquitectónica por capas y justificación técnica de Node-RED, API-first, OCR con IA y controles determinísticos.

4. **Registro de Pruebas y Observabilidad**
   - Franja de métricas calculadas en tiempo real a partir de las ejecuciones registradas: total de ejecuciones, tasa de causación automática, contención HITL, latencia promedio (`ms`) y confianza media OCR/IA.
   - Bitácora expandible paso a paso (código HTTP, latencia por nodo y payload JSON) y exportación a CSV.

5. **Informe Escrito en PDF (Normas APA 7.ª ed.)**
   - Metadatos editables (estudiante, institución, curso, título, fecha y enlace de YouTube) y carga opcional de capturas externas reales (**Node-RED** y **Gmail**).
   - Descarga directa de archivo vectorial **`Informe_APA_Custodios_Innovacion.pdf`** (tamaño Carta, márgenes de 1 pulgada, tipografía *Times* 12 pt a doble espacio, numeración superior derecha APA, tablas APA, Figura 1 BPMN rasterizada desde SVG, trazas de prueba, figuras adjuntas y referencias con sangría francesa).

6. **Guía de Presentación Oral**
   - Estructura sugerida y guion cronometrado para la sustentación individual en video (10–15 minutos).

---

## Arquitectura y endpoints principales

| Método y Ruta | Descripción |
| :--- | :--- |
| `GET /api/health` | Estado del motor de automatización y disponibilidad de Gemini en servidor. |
| `POST /api/workflow/execute` | Ejecución completa del flujo desde documento real o carga estructurada. |
| `POST /api/webhook/invoices` | Webhook entrante público con verificación opcional `HMAC-SHA256`. |
| `POST /api/ocr/extract` | Extracción XML UBL o OCR multimodal con Gemini para nodos HTTP de Node-RED. |
| `POST /api/tax-registry/validate` | Validación de NIT, orden de compra, tolerancia (%) y simulación de HTTP `503`. |
| `GET / POST /api/erp/entries` | Consulta y causación contable en ERP con control de idempotencia (`HTTP 409`). |
| `GET / POST /api/quarantine` | Gestión de excepciones y resolución *Human-in-the-Loop* (`/resolve`). |
| `GET / POST / DELETE /api/purchase-orders` | CRUD maestro de órdenes de compra autorizadas. |
| `GET /api/gmail/inbox` | Lista correos reales de la bandeja de Gmail (requiere token OAuth Bearer). |
| `POST /api/gmail/process-message` | Descarga adjunto o cuerpo de un correo de Gmail y lo ejecuta en el flujo. |
| `POST /api/notifications/gmail` | Envía notificación real por correo mediante Gmail API tras confirmación explícita. |
| `GET / PUT /api/settings` | Consulta y actualización de tolerancia, umbral IA, correo, webhook saliente y HMAC. |
| `GET / POST / DELETE /api/logs` | Bitácora de ejecuciones y restauración de datos base de prueba. |

---

## Stack tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, jsPDF y `jspdf-autotable`.
- **Backend**: Node.js, Express 4, `@google/genai` (ejecución estricta en servidor).
- **Orquestación externa compatible**: Node-RED (`flows.json` exportable desde la interfaz).
- **Autenticación e integración Google**: Firebase Authentication (Google OAuth popup con token en memoria) y Gmail API (`gmail.readonly` y `gmail.send`).

---

## Configuración y ejecución local

### 1. Variables de entorno
Copia `.env.example` a `.env` y configura las variables requeridas:

- `GEMINI_API_KEY`: clave de API de Gemini para extracción OCR multimodal en `server.ts`.
- `APP_URL`: URL pública donde se aloja la aplicación.

### 2. Instalación y scripts

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo (Express + Vite middleware en el puerto 3000)
npm run dev

# Verificar tipos TypeScript
npm run lint

# Compilar bundle de producción
npm run build

# Iniciar servidor en producción
npm start
```

### 3. Conexión con Node-RED local o en la nube
1. En la pestaña **Flujo Real Automatizado**, haz clic en **«Exportar flows.json (Node-RED)»**.
2. Importa el archivo descargado en tu instancia de Node-RED (`Menú -> Import`).
3. Los nodos HTTP de Node-RED apuntan directamente a `/api/ocr/extract`, `/api/tax-registry/validate`, `/api/erp/entries`, `/api/quarantine` y `/api/notifications/dispatch`.
