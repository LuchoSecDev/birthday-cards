# Construye la tarjeta de una persona en sitio/<persona>/, lista para subir a Cloudflare Pages.
#
# Uso:   powershell -ExecutionPolicy Bypass -File .\preparar-sitio.ps1 ejemplo
#        (lee personas\ejemplo.json; para alguien nuevo, cópialo como personas\<persona>.json)
#
# Qué hace:
#   1. Valida personas\<persona>.json.
#   2. Copia plantilla\ (css y js) y escribe index.html con los textos de la vista previa
#      (van en el HTML porque WhatsApp y similares no ejecutan JavaScript).
#   3. Escribe datos.js (window.TARJETA = el JSON) para tarjeta.js y og.html.
#   4. Fotografía plantilla\og.html con Chrome/Edge sin ventana como og.png (1200x630).
#
# IMPORTANTE: guarda este archivo en UTF-8 CON BOM. Windows PowerShell 5.1 lee los .ps1
# sin BOM como ANSI y rompería las tildes y la ñ de los textos.

param(
    [Parameter(Mandatory = $true)]
    [string]$Persona
)

$ErrorActionPreference = "Stop"
$utf8SinBom = New-Object System.Text.UTF8Encoding $false

# Solo minúsculas, números y guiones: el nombre se usa como ruta de archivo y carpeta.
if ($Persona -notmatch '^[a-z0-9-]+$') {
    throw "Nombre de persona inválido: '$Persona'. Usa solo minúsculas, números y guiones (ej. ana)."
}

$raiz = $PSScriptRoot
$plantilla = Join-Path $raiz "plantilla"
$archivoDatos = Join-Path $raiz "personas\$Persona.json"
$salida = Join-Path $raiz "sitio\$Persona"

if (-not (Test-Path $archivoDatos)) {
    throw "No existe $archivoDatos. Copia personas\ejemplo.json con ese nombre y edítalo."
}

# ---------- 1. Leer y validar los datos ----------
$json = [System.IO.File]::ReadAllText($archivoDatos, [System.Text.Encoding]::UTF8)
$datos = $json | ConvertFrom-Json

$errores = @()
foreach ($campo in "nombre", "saludo", "firma", "url") {
    if (-not ($datos.$campo -is [string]) -or [string]::IsNullOrWhiteSpace($datos.$campo)) {
        $errores += "'$campo' debe ser un texto no vacío."
    }
}
if (-not $datos.mensaje -or @($datos.mensaje).Count -eq 0 -or (@($datos.mensaje) | Where-Object { -not ($_ -is [string]) -or [string]::IsNullOrWhiteSpace($_) })) {
    $errores += "'mensaje' debe ser una lista con al menos un párrafo de texto."
}
if (-not ($datos.velas -is [int]) -or $datos.velas -lt 1 -or $datos.velas -gt 9) {
    # Más de 9 no caben sobre el piso de arriba del pastel.
    $errores += "'velas' debe ser un número entero entre 1 y 9."
}
if ($datos.url -is [string] -and ($datos.url -notmatch '^https://[^/\s]+$')) {
    $errores += "'url' debe ser solo el dominio con https:// y sin / final (ej. https://ana.tudominio.com)."
}
foreach ($campo in "titulo", "descripcion") {
    if (-not $datos.previa -or [string]::IsNullOrWhiteSpace($datos.previa.$campo)) {
        $errores += "'previa.$campo' debe ser un texto no vacío."
    }
}
if ($errores.Count -gt 0) {
    throw "Datos inválidos en $archivoDatos`n - " + ($errores -join "`n - ")
}

# ---------- 2. Copiar la plantilla y rellenar index.html ----------
# La carpeta sitio\<persona> es solo salida generada: se rehace entera cada vez.
if (Test-Path $salida) { Remove-Item -Recurse -Force $salida }
New-Item -ItemType Directory -Force $salida | Out-Null

foreach ($archivo in "tokens.css", "pastel.css", "estilos.css", "pastel.js", "tarjeta.js") {
    Copy-Item (Join-Path $plantilla $archivo) $salida
}

# Escapar solo & < > " para que unas comillas en los textos no rompan las etiquetas <meta>.
# (HtmlEncode de .NET también convierte tildes y ñ en &#241;: es válido, pero
# las tildes tal cual son más seguras para los lectores de vista previa.)
$enc = { param($texto) $texto.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;") }
$reemplazos = @{
    "{{TITULO}}"      = & $enc $datos.previa.titulo
    "{{DESCRIPCION}}" = & $enc $datos.previa.descripcion
    "{{URL}}"         = & $enc $datos.url
    "{{IMAGEN_ALT}}"  = & $enc "Pastel con $($datos.velas) velas encendidas y el texto ¡Feliz cumpleaños! para $($datos.nombre)"
}
$html = [System.IO.File]::ReadAllText((Join-Path $plantilla "index.html"), [System.Text.Encoding]::UTF8)
foreach ($clave in $reemplazos.Keys) { $html = $html.Replace($clave, $reemplazos[$clave]) }
if ($html -match '\{\{[A-Z_]+\}\}') {
    throw "Quedó un marcador sin rellenar en index.html: $($Matches[0])"
}
[System.IO.File]::WriteAllText((Join-Path $salida "index.html"), $html, $utf8SinBom)

# ---------- 3. datos.js ----------
# Un JSON válido también es JavaScript válido, así que se copia tal cual.
[System.IO.File]::WriteAllText((Join-Path $salida "datos.js"), "window.TARJETA = $($json.Trim());`n", $utf8SinBom)

# ---------- 4. Imagen de vista previa ----------
$navegadores = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$navegador = $navegadores | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $navegador) {
    throw "No encontré Chrome ni Edge: hacen falta para generar og.png (la imagen de la vista previa)."
}

# og.html se copia junto a datos.js y pastel.js para que sus rutas relativas funcionen.
$ogTemporal = Join-Path $salida "og.html"
$png = Join-Path $salida "og.png"
Copy-Item (Join-Path $plantilla "og.html") $ogTemporal
$perfil = Join-Path $env:TEMP "og-chrome-profile" # perfil aparte: no toca tu navegador
# Chrome escribe avisos inofensivos en stderr; con "Stop", PowerShell 5.1 los convierte en
# error fatal. Se relaja solo aquí: el éxito real se comprueba abajo (que exista og.png).
$ErrorActionPreference = "Continue"
& $navegador --headless=new --disable-gpu --hide-scrollbars --user-data-dir="$perfil" `
    --window-size=1200,630 --virtual-time-budget=5000 --screenshot="$png" $ogTemporal 2>$null | Out-Null
$ErrorActionPreference = "Stop"
Remove-Item $ogTemporal

if (-not (Test-Path $png) -or (Get-Item $png).Length -eq 0) {
    throw "No se generó og.png. Abre plantilla\og.html en el navegador para ver si tiene errores."
}

Write-Output "Listo: $salida"
Write-Output "Sube esa carpeta a Cloudflare Pages. Revisa la imagen: $png"
