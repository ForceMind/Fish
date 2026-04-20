# Fishing Joy

[🇬🇧 English](./README.md) | [🇨🇳 中文](./README.zh.md) | [🇯🇵 日本語](./README.ja.md) | [🇪🇸 Español](./README.es.md)

Fishing Joy es un juego de pesca para navegador construido con **PixiJS v8** y **Tone.js**. No necesita proceso de build y funciona como un sitio estático local.

## Características

- Distorsión de agua con WebGL y composición por capas
- Aparición dinámica de peces y formaciones de bancos
- Economía local de monedas y ajuste de potencia del cañón
- Efectos de sonido sintetizados y música de fondo en bucle
- Carga directa de scripts desde [index.html](./index.html)

## Inicio rápido

### Ejecución con un clic en Windows

Haz doble clic en [run.bat](./run.bat).

El script:

- busca `py` o `python`
- inicia un servidor local en `http://localhost:8080/`
- abre el juego en tu navegador predeterminado

### Ejecución manual

```powershell
cd E:\Privy\Fish
python -m http.server 8080
```

Después abre [http://localhost:8080](http://localhost:8080).

## Requisitos

- Python 3 disponible como `py` o `python`
- Navegador moderno con WebGL habilitado
- Acceso a Internet para cargar PixiJS y Tone.js desde CDN en [index.html](./index.html)

## Estructura del proyecto

- [index.html](./index.html): entrada de la página y orden de carga
- [src](./src): lógica del juego, renderizado, audio y entidades
- [images](./images): sprites y texturas de la interfaz
- [loop-01.mp3](./loop-01.mp3): música de fondo en bucle

## Notas

- Usa un servidor estático local en lugar de abrir `index.html` con `file://`.
- Las monedas ahora se gestionan solo en memoria local durante la partida.
