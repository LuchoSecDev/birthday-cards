# Tarjetas de cumpleaños

Tarjetas interactivas que se abren como un libro: pastel con velas que se apagan,
confeti, vibración en el celular y "Cumpleaños feliz" al abrir. Cada persona tiene
su propia carpeta generada, lista para subir a Cloudflare Pages, con vista previa
al compartir el enlace (WhatsApp, Telegram...).

## Estructura

```
plantilla/          código y diseño, igual para todas las personas
  index.html        estructura de la tarjeta (los {{...}} los rellena el script)
  tokens.css        colores y tipografías (cambiar el diseño empieza aquí)
  estilos.css       diseño de la tarjeta
  pastel.css        colores del pastel
  pastel.js         dibujo del pastel (lo comparten la tarjeta y la vista previa)
  tarjeta.js        abrir/cerrar, velas, confeti, vibración, canción
  og.html           plantilla de la imagen de vista previa (og.png, 1200x630)
personas/           un JSON por persona: textos, número de velas y URL
                    (solo ejemplo.json va a git; los tuyos quedan en tu equipo)
preparar-sitio.ps1  construye sitio/<persona>/
sitio/              salida generada (no se guarda en git)
```

## Hacer una tarjeta nueva

1. Copia `personas/ejemplo.json` como `personas/<persona>.json` (solo minúsculas,
   números y guiones; por ejemplo `ana.json`) y edita los textos.
   `url` es la dirección donde la publicarás, sin `/` final.
   El `.gitignore` deja fuera de git todo `personas/` salvo `ejemplo.json`, para que
   nombres y mensajes personales no terminen en un repositorio público.
2. Constrúyela (necesita Chrome o Edge instalado para generar la imagen):

   ```
   powershell -ExecutionPolicy Bypass -File .\preparar-sitio.ps1 ana
   ```

3. Revisa `sitio/ana/og.png` y sube la carpeta `sitio/ana` a Cloudflare Pages
   (Workers & Pages → Create → Pages → Upload assets). Para actualizar una ya
   publicada: Create deployment y sube la carpeta de nuevo.

El script valida el JSON y explica qué campo está mal antes de generar nada.

## Probar en local

Abrir `sitio/<persona>/index.html` con doble clic funciona en la mayoría de navegadores,
pero lo más fiel a Cloudflare es servir la carpeta:

```
python -m http.server 8765 --directory sitio/ana
```

y abrir http://localhost:8765.

## Cosas a saber

- `preparar-sitio.ps1` debe guardarse en **UTF-8 con BOM**: Windows PowerShell 5.1 lee
  los `.ps1` sin BOM como ANSI y rompería las tildes y la ñ de la vista previa.
- La vista previa la leen apps que **no ejecutan JavaScript**; por eso sus textos van
  escritos en el HTML por el script y la imagen es un PNG, no la tarjeta en vivo.
- WhatsApp guarda la vista previa de enlaces ya compartidos: un cambio solo se ve en
  enlaces compartidos después.
- Si el subdominio lleva ñ o tildes, `url` va en Punycode (`xn--...`), que es como
  las apps piden la imagen.
- En iPhone no vibra (Safari no tiene la API de vibración) y la música no suena con
  el interruptor de silencio activado.
