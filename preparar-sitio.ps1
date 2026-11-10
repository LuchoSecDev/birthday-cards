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
if ($null -ne $datos.numero) {
    # Velas con forma de número (ej. 18): caben máximo dos cifras sobre el pastel.
    if (-not ($datos.numero -is [int]) -or $datos.numero -lt 1 -or $datos.numero -gt 99) {
        $errores += "'numero' debe ser un número entero entre 1 y 99."
    }
} elseif (-not ($datos.velas -is [int]) -or $datos.velas -lt 1 -or $datos.velas -gt 9) {
    # Más de 9 no caben sobre el piso de arriba del pastel.
    $errores += "'velas' debe ser un número entero entre 1 y 9 (o usa 'numero' para velas con forma de número)."
}
# Temas definidos en plantilla\tokens.css; uno nuevo hay que añadirlo en los dos sitios.
$temas = "coral", "azul"
$tema = if ($null -ne $datos.tema) { $datos.tema } else { "coral" }
if ($tema -notin $temas) {
    $errores += "'tema' debe ser uno de: $($temas -join ', ')."
}
# Qué pasa al apagar la última vela (lo interpreta plantilla\tarjeta.js).
$finales = "confeti", "fuegos"
if ($null -ne $datos.final -and $datos.final -notin $finales) {
    $errores += "'final' debe ser uno de: $($finales -join ', ')."
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

foreach ($archivo in "tokens.css", "pastel.css", "estilos.css", "pastel.js", "fuegos.js", "tarjeta.js") {
    Copy-Item (Join-Path $plantilla $archivo) $salida
}

# Escapar solo & < > " para que unas comillas en los textos no rompan las etiquetas <meta>.
# (HtmlEncode de .NET también convierte tildes y ñ en &#241;: es válido, pero
# las tildes tal cual son más seguras para los lectores de vista previa.)
$enc = { param($texto) $texto.Replace("&", "&amp;").Replace("<", "&lt;").Replace(">", "&gt;").Replace('"', "&quot;") }
$velasAlt = if ($null -ne $datos.numero) { "velas con forma del número $($datos.numero)" } else { "$($datos.velas) velas encendidas" }
$reemplazos = @{
    "{{TEMA}}"        = $tema # ya validado contra $temas
    "{{TITULO}}"      = & $enc $datos.previa.titulo
    "{{DESCRIPCION}}" = & $enc $datos.previa.descripcion
    "{{URL}}"         = & $enc $datos.url
    "{{IMAGEN_ALT}}"  = & $enc "Pastel con $velasAlt y el texto ¡Feliz cumpleaños! para $($datos.nombre)"
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

# ---------- 3b. Icono de la pestaña (favicon.svg) ----------
# Los colores se leen de tokens.css (una sola fuente de verdad): primero el tema por
# defecto (:root { ... }) y encima los del tema elegido (:root[data-tema="..."] { ... }).
$tokens = [System.IO.File]::ReadAllText((Join-Path $plantilla "tokens.css"), [System.Text.Encoding]::UTF8)
function Get-Colores([string]$bloque) {
    $mapa = @{}
    foreach ($m in [regex]::Matches($bloque, '--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,8})')) {
        $mapa[$m.Groups[1].Value] = $m.Groups[2].Value
    }
    return $mapa
}
$colores = Get-Colores ([regex]::Match($tokens, ':root\s*\{([^}]*)\}').Groups[1].Value)
if ($tema -ne "coral") {
    $bloqueTema = [regex]::Match($tokens, ':root\[data-tema="' + $tema + '"\]\s*\{([^}]*)\}').Groups[1].Value
    $colorTema = Get-Colores $bloqueTema
    foreach ($k in $colorTema.Keys) { $colores[$k] = $colorTema[$k] }
}
$icono = [System.IO.File]::ReadAllText((Join-Path $plantilla "favicon.svg"), [System.Text.Encoding]::UTF8)
# {{ACCENT_DEEP}} -> --accent-deep, {{FROSTING_2}} -> --frosting-2, etc.
$icono = [regex]::Replace($icono, '\{\{([A-Z0-9_]+)\}\}', {
    param($m)
    $token = $m.Groups[1].Value.ToLower().Replace("_", "-")
    if (-not $colores.ContainsKey($token)) { throw "favicon.svg usa {{$($m.Groups[1].Value)}}, pero tokens.css no define --$token." }
    $colores[$token]
})
$favicon = Join-Path $salida "favicon.svg"
[System.IO.File]::WriteAllText($favicon, $icono, $utf8SinBom)

# ---------- 4. Imágenes PNG: vista previa e icono para iPhone ----------
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

# Fotografía un archivo con el navegador sin ventana y comprueba que salió la imagen.
function Capturar([string]$archivo, [string]$png, [int]$ancho, [int]$alto, [string]$extra) {
    $perfil = Join-Path $env:TEMP "og-chrome-profile" # perfil aparte: no toca tu navegador
    # Chrome escribe avisos inofensivos en stderr; con "Stop", PowerShell 5.1 los convierte en
    # error fatal. Se relaja solo aquí: el éxito real se comprueba abajo (que exista el PNG).
    $ErrorActionPreference = "Continue"
    $argumentos = @("--headless=new", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=$perfil",
        "--window-size=$ancho,$alto", "--virtual-time-budget=5000", "--screenshot=$png")
    if ($extra) { $argumentos += $extra }
    & $navegador @argumentos $archivo 2>$null | Out-Null
    $ErrorActionPreference = "Stop"
    if (-not (Test-Path $png) -or (Get-Item $png).Length -eq 0) {
        throw "No se generó $png a partir de $archivo."
    }
}

# og.html se copia junto a datos.js y pastel.js para que sus rutas relativas funcionen.
$ogTemporal = Join-Path $salida "og.html"
$png = Join-Path $salida "og.png"
Copy-Item (Join-Path $plantilla "og.html") $ogTemporal
Capturar $ogTemporal $png 1200 630
Remove-Item $ogTemporal

# Safari e iPhone (pantalla de inicio) usan un PNG de 180x180 en vez del SVG; fondo transparente.
# Se fotografía una mini página con el icono a 180x180: abrir el SVG solo no sirve, porque
# Chrome sin ventana tiene un ancho mínimo y lo dibuja más grande que la captura.
$iconoTemporal = Join-Path $salida "icono.html"
[System.IO.File]::WriteAllText($iconoTemporal,
    '<!doctype html><body style="margin:0"><img src="favicon.svg" width="180" height="180" style="display:block"></body>',
    $utf8SinBom)
Capturar $iconoTemporal (Join-Path $salida "apple-touch-icon.png") 180 180 "--default-background-color=00000000"
Remove-Item $iconoTemporal

Write-Output "Listo: $salida"
Write-Output "Sube esa carpeta a Cloudflare Pages. Revisa la imagen: $png"
