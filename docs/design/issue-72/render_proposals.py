"""Bocetos vectoriales de #72. No importa ni modifica código/datos de la app.

python3 docs/design/issue-72/render_proposals.py
python3 docs/design/issue-72/render_proposals.py --png  # requiere librsvg y libcairo
"""
from pathlib import Path
from html import escape
import sys

ROOT = Path(__file__).resolve().parent
PALETTES = {
    'a': dict(bg='#101a32', panel='#2b3d57', inner='#354962', text='#f7f8ff', muted='#b8c5d9', line='#53647c', accent='#7899ff', ink='#07142d', radius=26),
    'b': dict(bg='#101a32', panel='#1c2c43', inner='#243952', text='#f7f8ff', muted='#b8c5d9', line='#3f536e', accent='#7899ff', ink='#07142d', radius=20),
    'c': dict(bg='#101a32', panel='#17283f', inner='#22364f', text='#f7f8ff', muted='#b8c5d9', line='#52657f', accent='#7899ff', ink='#07142d', radius=10),
}
ICONS = {
    'home': 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',
    'assistant': 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
    'calendar': 'M4 5h16v17H4ZM4 10h16M8 2v6m8-6v6M8 14h2m4 0h2m-8 4h2m4 0h2',
    'clock': 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2',
    'weather': 'M7 17a4 4 0 1 1 1-8 6 6 0 0 1 11 3 3 3 0 1 1 0 6H7ZM6 2v2M1 7h2m7-5 1-1',
    'notes': 'M5 2h10l5 5v15H5ZM14 2v6h6M9 12h7m-7 4h7',
    'gallery': 'M3 4h18v17H3Zm0 13 6-6 5 5 3-3 4 4M16 8h1',
    'settings': 'M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Z',
    'pin': 'M20 9c0 6-8 13-8 13S4 15 4 9a8 8 0 1 1 16 0ZM15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
}


class Sketch:
    def __init__(self, direction, portrait=False, page='dashboard'):
        self.p = PALETTES[direction]
        self.direction, self.portrait, self.page = direction, portrait, page
        self.w, self.h = (800, 1200) if portrait else (1280, 800)
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc">',
                      f'<title id="title">Propuesta {direction.upper()} · {page} · {"vertical" if portrait else "horizontal"}</title>',
                      '<desc id="desc">Boceto de dirección visual, contenido ficticio. No es una captura ni una interfaz funcional. Cuadrícula y destinos existentes conservados.</desc>',
                      '<defs><linearGradient id="wall" x2="1" y2="1"><stop stop-color="#233c66"/><stop offset="1" stop-color="#0c2636"/></linearGradient></defs>']
        self.rect(0, 0, self.w, self.h, fill='bg', radius=0, stroke=False)
        if direction == 'a':
            self.parts.append(f'<rect width="{self.w}" height="{self.h}" fill="url(#wall)"/>')

    def color(self, value):
        return self.p.get(value, value)

    def rect(self, x, y, w, h, fill='panel', radius=None, stroke=True):
        r = self.p['radius'] if radius is None else radius
        border = self.color(stroke) if isinstance(stroke, str) else self.p['line'] if stroke else 'none'
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{self.color(fill)}" stroke="{border}"/>')

    def text(self, x, y, value, size=16, color='text', weight=400, anchor='start'):
        self.parts.append(f'<text x="{x}" y="{y}" font-family="sans-serif" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" fill="{self.color(color)}">{escape(str(value))}</text>')

    def line(self, x1, y1, x2, y2, color='line'):
        self.parts.append(f'<path d="M{x1} {y1}H{x2}" stroke="{self.color(color)}"/>' if y1 == y2 else f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{self.color(color)}"/>')

    def icon(self, name, x, y, size=22, color='muted'):
        self.parts.append(f'<path d="{ICONS[name]}" transform="translate({x} {y}) scale({size/24})" fill="none" stroke="{self.color(color)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')

    def button(self, x, y, w, label, primary=False):
        self.rect(x, y, w, 44, 'accent' if primary else 'inner', radius=12, stroke=not primary)
        self.text(x+w/2, y+28, label, 15, 'ink' if primary else 'text', 600, 'middle')

    def heading(self, title, subtitle):
        self.text(32, 34, 'PABLO TABLET', 12, 'muted', 700)
        self.text(32, 76, title, 30 if self.direction != 'c' else 34, weight=600 if self.direction != 'c' else 700)
        self.text(self.w-32, 37, subtitle, 14, 'muted', anchor='end')

    def card(self, x, y, w, h, title=None, icon=None):
        self.rect(x, y, w, h)
        if self.direction == 'c':
            self.rect(x, y+20, 3, 32, 'accent', 0, False)
        if title:
            if icon:
                self.icon(icon, x+20, y+20, 22, 'accent')
            self.text(x+52 if icon else x+20, y+37, title, 18, weight=600)

    def dock(self, active='home'):
        labels = ['Inicio', 'Asistente', 'Calendario', 'Reloj', 'Tiempo', 'Notas', 'Galería', 'Ajustes']
        names = ['home', 'assistant', 'calendar', 'clock', 'weather', 'notes', 'gallery', 'settings']
        labeled = self.direction == 'c'
        cell = 84 if labeled else 54
        width, height = 8*cell+16, 64
        left, top = (self.w-width)/2, self.h-height-12
        self.rect(left, top, width, height, 'panel', radius=18)
        for i, (name, label) in enumerate(zip(names, labels)):
            x = left+8+i*cell
            if name == active:
                self.rect(x, top+4, cell-4, height-8, 'accent', 12, False)
            self.icon(name, x+(cell-26)/2, top+8 if labeled else top+20, 24, 'ink' if name == active else 'muted')
            if labeled:
                self.text(x+(cell-4)/2, top+49, label, 14, 'ink' if name == active else 'muted', 600 if name == active else 400, 'middle')

    def calendar(self, x, y, w, h, full=False):
        self.card(x, y, w, h, 'Noviembre 2026' if full else 'Calendario', 'calendar')
        self.text(x+20, y+65, 'Vista mensual' if full else 'Noviembre de 2026', 14, 'muted')
        side = w > 490 and not self.portrait and not full
        gx, gy = x+20, y+92
        if full:
            self.button(x+w-322, y+57, 150, 'Ocultar finalizados')
            self.button(x+w-164, y+57, 44, '‹')
            self.button(x+w-112, y+57, 56, 'Hoy')
            self.button(x+w-48, y+57, 44, '›')
            gy += 36
        gw = w-40-(178 if side else 0)
        gh = h-112-(136 if self.portrait else 0)-(36 if full else 0)
        if self.direction == 'a':
            self.rect(gx-6, gy-10, gw+12, gh+16, 'inner', 18)
        cw, ch = gw/7, (gh-26)/6
        for i, label in enumerate(['L', 'M', 'X', 'J', 'V', 'S', 'D']):
            self.text(gx+cw*(i+.5), gy+5, label, 12, 'muted', 600, 'middle')
        for i in range(42):
            col, row = i % 7, i//7
            cx, cy = gx+col*cw, gy+18+row*ch
            day = i-5
            outside = day < 1 or day > 30
            label = day+31 if day < 1 else day-30 if day > 30 else day
            if self.direction == 'a':
                self.rect(cx+2, cy+1, cw-4, ch-5, 'inner', 8)
            elif row and col == 0:
                self.line(gx, cy-2, gx+gw, cy-2)
            if day == 10:
                self.rect(cx+(cw-36)/2, cy+3, 36, 36, 'accent', 18, False)
            self.text(cx+cw/2, cy+27, label, 15, 'ink' if day == 10 else 'muted' if outside else 'text', 700 if day == 10 else 400, 'middle')
            if day in (1, 36):
                self.text(cx+cw/2, cy+46, 'Festivo', 14, 'muted', anchor='middle')
        if side:
            sx = x+w-166
            self.line(sx-14, y+90, sx-14, y+h-22)
            self.text(sx, y+111, 'Próximos eventos', 14, 'muted', 600)
            self.text(sx, y+145, 'No hay próximos', 14, 'muted')
            self.text(sx, y+166, 'eventos.', 14, 'muted')
            self.text(sx, y+224, 'Próximos festivos', 14, 'muted', 600)
            for offset, lines in [(260, ['Día de la', 'Constitución', '6 dic · Todo el día']), (346, ['Inmaculada', 'Concepción', '8 dic · Todo el día'])]:
                for j, text in enumerate(lines):
                    self.text(sx, y+offset+21*j, text, 14, 'muted' if j == 2 else 'text', 400 if j == 2 else 600)
        elif self.portrait:
            self.line(x+20, y+h-132, x+w-20, y+h-132)
            self.text(x+20, y+h-107, 'No hay próximos eventos.', 14, 'muted')
            self.text(x+20, y+h-76, 'Próximos festivos', 14, 'muted', 600)
            self.text(x+20, y+h-50, '6 dic · Día de la Constitución', 14)
            self.text(x+20, y+h-27, '8 dic · Inmaculada Concepción', 14)

    def dashboard(self):
        self.heading('Buenas tardes, Pablo', 'Martes, 10 de noviembre')
        gap, top, bottom, left = 18, 104, self.h-88, 32
        cols, rows = (3, 4) if self.portrait else (4, 3)
        cw, rh = (self.w-64-(cols-1)*gap)/cols, (bottom-top-(rows-1)*gap)/rows
        def area(c, r, cs, rs):
            return left+c*(cw+gap), top+r*(rh+gap), cw*cs+(cs-1)*gap, rh*rs+(rs-1)*gap
        # Mismos tamaños/posiciones en las tres direcciones de cada orientación.
        self.calendar(*area(0, 0, 2, 3))
        x, y, w, h = area(0, 3, 2, 1) if self.portrait else area(2, 0, 2, 1)
        self.card(x, y, w, h)
        self.text(x+20, y+32, 'Ahora', 14, 'muted', 600)
        self.text(x+20, y+108, '16:28', 66, weight=400 if self.direction != 'c' else 600)
        self.text(x+211, y+108, ':59', 23, 'muted')
        self.text(x+w-20, y+h-22, 'Martes, 10 de noviembre', 14, 'muted', anchor='end')
        for name, pos in [('notes', (2, 0, 1, 2) if self.portrait else (2, 1, 1, 2)), ('weather', (2, 2, 1, 2) if self.portrait else (3, 1, 1, 2))]:
            x, y, w, h = area(*pos)
            if name == 'notes':
                self.card(x, y, w, h, 'Notas', 'notes')
                self.text(x+20, y+65, '3 notas guardadas', 14, 'muted')
                if self.direction == 'a':
                    self.rect(x+14, y+84, w-28, h-132, 'inner', 14)
                else:
                    self.line(x+20, y+83, x+w-20, y+83)
                self.text(x+22, y+115, 'Lista de casa', 16, weight=600)
                for n, item in enumerate(['Revisar la agenda', 'Preparar la mochila']):
                    self.rect(x+22, y+139+n*36, 16, 16, 'panel', 4, 'muted')
                    self.text(x+47, y+152+n*36, item, 14)
                self.text(x+20, y+h-24, 'Nota 1 de 3', 14, 'muted')
                self.text(x+w-22, y+h-24, '›', 22, 'muted', anchor='end')
            else:
                self.card(x, y, w, h)
                self.icon('pin', x+22, y+h/2-65, 40, '#ffcd74')
                self.text(x+20, y+h/2+5, 'Configura el tiempo', 17, weight=600)
                self.text(x+20, y+h/2+34, 'Añade una ubicación y', 14, 'muted')
                self.text(x+20, y+h/2+56, 'márcala como Casa.', 14, 'muted')
        self.dock()

    def main_page(self):
        # Exploraciones adicionales de B. No cambia orden ni acciones existentes.
        self.heading({'calendar': 'Calendario', 'notes': 'Notas', 'settings': 'Ajustes'}[self.page], 'Martes, 10 de noviembre')
        if self.page == 'calendar':
            self.calendar(32, 104, 790, 604, full=True)
            self.card(840, 104, 408, 256, 'Martes, 10 de noviembre')
            self.text(860, 190, 'Este día está libre', 22, weight=600)
            self.text(860, 222, 'Añade una cita o recordatorio.', 16, 'muted')
            self.button(860, 278, 154, '+ Crear evento', True)
            self.card(840, 378, 408, 132, 'Próximos eventos')
            self.text(860, 463, 'No hay próximos eventos.', 16, 'muted')
            self.card(840, 528, 408, 180, 'Cuentas sincronizadas')
            self.text(860, 598, 'Google · Sin conectar', 16)
            self.button(1094, 574, 132, 'Conectar')
            self.text(860, 658, 'Outlook · Sin conectar', 16)
            self.button(1094, 634, 132, 'Conectar')
        elif self.page == 'notes':
            self.card(32, 104, 300, 604, 'Mis notas')
            self.button(48, 160, 125, 'Activas', True)
            self.button(181, 160, 135, 'Archivo')
            for i, title in enumerate(['Lista de casa', 'Nuevo dibujo', 'Una idea']):
                self.rect(48, 224+i*90, 268, 74, 'inner' if i == 1 else 'panel', 12, 'accent' if i == 1 else False)
                self.text(64, 254+i*90, title, 16, weight=600 if i == 1 else 400)
                self.text(64, 279+i*90, ['Lista · 2 elementos', 'Dibujo', 'Texto'][i], 14, 'muted')
            self.button(48, 640, 124, '+ Nueva', True)
            self.card(350, 104, 898, 604)
            for i, color in enumerate(['#ff9b80', '#b59aff', '#7cdec2', '#f7c85e']):
                self.rect(374+i*32, 131, 22, 22, color, 11, False)
            self.button(518, 120, 84, 'Fijar')
            self.button(1022, 120, 130, 'Archivar')
            self.button(1160, 120, 64, 'Borrar')
            self.text(374, 217, 'Nuevo dibujo', 24, weight=600)
            self.button(1092, 185, 132, 'Ampliar')
            self.rect(374, 246, 850, 392, 'bg', 14, False)
            for bx, bw, label in [(388, 78, 'Lápiz'), (474, 94, 'Borrador'), (754, 146, 'Grosor: Medio'), (982, 112, 'Deshacer'), (1102, 108, 'Limpiar')]:
                self.button(bx, 260, bw, label, label == 'Lápiz')
            for i, color in enumerate(['#f4f7ff', '#7fa2ff', '#ff9b80', '#7cdec2', '#f7c85e']):
                self.rect(584+i*32, 270, 22, 22, color, 11, False)
            self.parts.append('<path d="M540 556V414L690 340L840 414V556ZM690 340V496M540 414L690 496L840 414M930 410Q1010 352 1070 430T1140 490" stroke="#f4f7ff" stroke-width="4" fill="none" stroke-linejoin="round"/>')
            self.text(374, 671, 'Recordatorio', 14, 'muted')
            self.button(474, 646, 172, 'Sin recordatorio ▾')
            self.button(656, 646, 132, 'Probar aviso')
            self.text(1224, 671, '2 trazos · Dibujo local', 14, 'muted', anchor='end')
        else:
            self.button(1070, 44, 178, 'Volver al inicio')
            self.card(32, 104, 1216, 146, 'Idioma')
            self.text(56, 178, 'Idioma de la aplicación', 16, weight=600)
            self.text(56, 209, 'Se aplica también a la administración móvil.', 14, 'muted')
            self.button(1060, 167, 164, 'Español  ▾')
            self.card(32, 268, 1216, 280, 'Apariencia')
            names = ['Cálido', 'AMOLED', 'Retro', 'Cristal', 'Original', 'Nórdico', 'Suizo', 'Mediterráneo', 'Monocromo', 'Brutalista']
            colors = ['#efe7dc', '#000000', '#e8c994', '#23719b', '#7899ff', '#d8e5db', '#ffffff', '#edb166', '#cccccc', '#ffdc2f']
            for i, (name, color) in enumerate(zip(names, colors)):
                col, row = i % 5, i//5
                x, y = 52+col*236, 331+row*99
                self.rect(x, y, 222, 83, 'inner', 12)
                self.rect(x+12, y+18, 30, 40, color, 6, False)
                self.rect(x+15, y+21, 13, 33, 'panel', 3)
                self.rect(x+31, y+21, 8, 18, 'panel', 2)
                self.rect(x+31, y+43, 8, 11, color, 2)
                self.text(x+54, y+37, name, 15, weight=600)
                if i == 4:
                    self.text(x+54, y+63, '✓ Seleccionado', 14, 'muted')
            self.card(32, 566, 1216, 200, 'Widgets y páginas')
            self.text(56, 643, 'Diseño del paginador', 16)
            self.button(1032, 614, 192, 'Dock compacto  ▾')
            self.line(56, 679, 1224, 679)
            self.text(56, 721, 'Posición del dock', 16)
            self.button(1032, 692, 192, 'Abajo  ▾')
        self.dock(self.page)

    def save(self):
        self.parts.append('</svg>')
        path = ROOT / 'assets' / f'{self.direction}-{self.page}-{"portrait" if self.portrait else "landscape"}.svg'
        path.parent.mkdir(exist_ok=True)
        path.write_text('\n'.join(self.parts)+'\n', encoding='utf-8')
        return path


def render_png(paths, output):
    import ctypes as c
    from ctypes.util import find_library
    from xml.etree import ElementTree
    rsvg, cairo, gobject = [c.CDLL(find_library(name)) for name in ('rsvg-2', 'cairo', 'gobject-2.0')]
    def bind(lib, name, restype, *args):
        function = getattr(lib, name)
        function.restype, function.argtypes = restype, args
        return function
    new_handle = bind(rsvg, 'rsvg_handle_new_from_file', c.c_void_p, c.c_char_p, c.c_void_p)
    new_surface = bind(cairo, 'cairo_image_surface_create', c.c_void_p, c.c_int, c.c_int, c.c_int)
    new_context = bind(cairo, 'cairo_create', c.c_void_p, c.c_void_p)
    class Rectangle(c.Structure):
        _fields_ = [(name, c.c_double) for name in ('x', 'y', 'width', 'height')]
    render = bind(rsvg, 'rsvg_handle_render_document', c.c_int, c.c_void_p, c.c_void_p, c.POINTER(Rectangle), c.c_void_p)
    write_png = bind(cairo, 'cairo_surface_write_to_png', c.c_int, c.c_void_p, c.c_char_p)
    unref = bind(gobject, 'g_object_unref', None, c.c_void_p)
    destroy_context = bind(cairo, 'cairo_destroy', None, c.c_void_p)
    destroy_surface = bind(cairo, 'cairo_surface_destroy', None, c.c_void_p)
    output = Path(output)
    output.mkdir(exist_ok=True)
    for path in paths:
        root = ElementTree.parse(path).getroot()
        width, height = int(root.attrib['width']), int(root.attrib['height'])
        handle = new_handle(str(path).encode(), None)
        surface = new_surface(0, width, height)
        context = new_context(surface)
        viewport = Rectangle(0, 0, width, height)
        if not handle or not render(handle, context, c.byref(viewport), None):
            raise RuntimeError(f'No se pudo renderizar {path}')
        if write_png(surface, str(output / (path.stem+'.png')).encode()):
            raise RuntimeError(f'No se pudo escribir el PNG de {path}')
        destroy_context(context)
        destroy_surface(surface)
        unref(handle)
    print(f'{len(paths)} SVG renderizados en {output}')


if __name__ == '__main__':
    paths = []
    for direction in PALETTES:
        for portrait in (False, True):
            sketch = Sketch(direction, portrait)
            sketch.dashboard()
            paths.append(sketch.save())
    for page in ('calendar', 'notes', 'settings'):
        sketch = Sketch('b', page=page)
        sketch.main_page()
        paths.append(sketch.save())
    if '--png' in sys.argv:
        render_png(paths, '/tmp/pablo-72-propuestas')
    else:
        print(f'{len(paths)} bocetos SVG generados en {ROOT / "assets"}')
