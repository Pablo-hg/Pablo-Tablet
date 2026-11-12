"""Variantes de presentación del calendario B. Solo genera bocetos.

python3 docs/design/issue-72/render_calendar_options.py --png
Los PNG de revisión se guardan en output/issue72/calendario/ (ignorado).
"""
from datetime import date, timedelta
from pathlib import Path
from html import escape
import sys
sys.dont_write_bytecode = True
from render_proposals import Sketch, ROOT, render_png

COLORS = {
    'blue': ('#91b1ff', '#2a4067'),
    'mint': ('#83dfc1', '#24473f'),
    'coral': ('#ffb29c', '#503c3d'),
    'sun': ('#ffda8d', '#4a4335'),
}
EVENTS = {
    10: [('Reunión', 'blue'), ('Paseo', 'mint')],
    11: [('Dentista', 'coral')],
    12: [('Recados', 'sun')],
    14: [('Comida', 'mint')],
    18: [('Revisión', 'blue')],
    19: [('Entrega', 'coral'), ('Recados', 'sun'), ('Llamada', 'blue'), ('Paseo', 'mint')],
    24: [('Recados', 'sun')],
}
UPCOMING = [
    ('Reunión de equipo', 'Hoy · 18:00', 'blue'),
    ('Paseo', 'Hoy · 19:30', 'mint'),
    ('Dentista', 'Mañana · 10:30', 'coral'),
    ('Recados', 'Jue 12 · 18:00', 'sun'),
]
NAMES = {1: 'Etiquetas suaves', 2: 'Líneas de color', 3: 'Puntos y texto'}


class CalendarOption(Sketch):
    def __init__(self, variant, compact=False):
        super().__init__('b')
        self.variant, self.compact = variant, compact
        self.w, self.h = (680, 680) if compact else (1000, 760)
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc">',
            f'<title id="title">Calendario B, ejemplo {variant}: {NAMES[variant]}</title>',
            '<desc id="desc">Boceto sin implementar, datos ficticios de noviembre de 2026. El día actual 10 conserva fondo, borde, círculo y etiqueta Hoy. Los eventos mantienen sus colores y texto más pequeño; los mismos próximos eventos aparecen a la derecha.</desc>',
        ]
        self.rect(0, 0, self.w, self.h, 'bg', 0, False)

    def circle(self, x, y, radius, color):
        self.parts.append(f'<circle cx="{x}" cy="{y}" r="{radius}" fill="{self.color(color)}"/>')

    def chip(self, x, y, width, title, color):
        foreground, background = COLORS[color]
        small = self.compact
        font = 11.5 if small else 13
        height = 17 if small else 20
        limit = max(3, int((width-12)/(font*.53)))
        label = title if len(title) <= limit else title[:limit-1]+'…'
        if self.variant == 1:
            self.rect(x, y, width, height, background, 4, False)
            self.rect(x, y+3, 3, height-6, foreground, 1, False)
            self.text(x+7, y+height-5, label, font, foreground, 500)
        elif self.variant == 2:
            self.rect(x+1, y+2, 3, height-4, foreground, 1, False)
            self.text(x+9, y+height-5, label, font, foreground, 500)
        else:
            self.circle(x+4, y+height/2, 3, foreground)
            self.text(x+12, y+height-5, label, font, 'text')

    def upcoming(self, x, y, width):
        self.text(x, y, 'Próximos eventos', 16 if self.compact else 18, weight=600)
        row_height = 76 if self.compact else 83
        for i, (title, when, color) in enumerate(UPCOMING):
            foreground, background = COLORS[color]
            top = y+20+i*row_height
            if self.variant == 1:
                self.rect(x, top, width, row_height-12, background, 10, False)
                self.rect(x+10, top+13, 3, row_height-38, foreground, 1, False)
                tx = x+23
            elif self.variant == 2:
                self.rect(x, top+9, 3, row_height-28, foreground, 1, False)
                tx = x+15
                if i:
                    self.line(x+15, top-3, x+width, top-3)
            else:
                self.circle(x+5, top+20, 4, foreground)
                tx = x+19
                if i:
                    self.line(x+19, top-3, x+width, top-3)
            if self.compact and title == 'Reunión de equipo':
                self.text(tx, top+22, 'Reunión de', 14, weight=500)
                self.text(tx, top+40, 'equipo', 14, weight=500)
                self.text(tx, top+58, when, 12, 'muted')
            else:
                self.text(tx, top+25, title, 14 if self.compact else 16, weight=500)
                self.text(tx, top+48, when, 12 if self.compact else 14, 'muted')
        foot = y+20+4*row_height+15
        self.line(x, foot-12, x+width, foot-12)
        self.text(x, foot+12, 'Los colores son los de', 12 if self.compact else 14, 'muted')
        self.text(x, foot+33, 'cada evento.', 12 if self.compact else 14, 'muted')

    def draw(self):
        compact = self.compact
        self.text(24, 28, f'Ejemplo {self.variant} · {NAMES[self.variant]}', 14, 'muted', 600)
        self.rect(16, 48, self.w-32, self.h-64)
        self.icon('calendar', 36, 70, 22, 'accent')
        self.text(70, 88, 'Calendario', 22, weight=600)
        self.text(36, 119, 'Noviembre de 2026', 15, 'muted')
        self.text(self.w-36, 88, 'Ver calendario ›', 13 if compact else 15, 'muted', anchor='end')
        sidebar = 178 if compact else 256
        sx = self.w-sidebar-36
        gx, gy = 36, 154
        gw = sx-gx-30
        height = self.h-gy-52
        cw, rh = gw/7, (height-30)/6
        self.line(sx-16, gy-10, sx-16, self.h-36)
        for i, letter in enumerate(['L', 'M', 'X', 'J', 'V', 'S', 'D']):
            self.text(gx+cw*(i+.5), gy, letter, 12 if compact else 14, 'muted', 600, 'middle')
        start = date(2026, 11, 1)-timedelta(days=6)
        for index in range(42):
            day = start+timedelta(days=index)
            col, row = index % 7, index//7
            x, y = gx+col*cw, gy+16+row*rh
            today = day == date(2026, 11, 10)
            items = EVENTS.get(day.day, []) if day.month == 11 else []
            if today:
                self.rect(x+1, y, cw-2, rh-4, '#263c61', 9, 'accent')
                self.circle(x+17, y+18, 13 if compact else 15, 'accent')
                self.text(x+17, y+23, day.day, 13 if compact else 15, 'ink', 700, 'middle')
                self.text(x+cw-7, y+23, 'HOY', 8.5 if compact else 10, 'text', 700, 'end')
            else:
                self.text(x+8, y+23, day.day, 14 if compact else 16, 'text' if day.month == 11 else 'muted', 500)
                if row:
                    self.line(x+3, y, x+cw-3, y)
            count = min(len(items), 1 if compact or len(items) > 2 else 2)
            for j, (title, color) in enumerate(items[:count]):
                self.chip(x+5, y+34+j*23, cw-10, title, color)
            if len(items) > count:
                self.text(x+8, y+rh-9, f'+{len(items)-count}', 10 if compact else 12, 'muted', 600)
        self.upcoming(sx, gy, sidebar)
        self.parts.append('</svg>')
        filename = f'calendar-b{self.variant}-{"compact" if compact else "detail"}.svg'
        path = ROOT / 'assets' / filename
        path.write_text('\n'.join(self.parts)+'\n', encoding='utf-8')
        return path


if __name__ == '__main__':
    paths = [CalendarOption(variant, compact).draw() for variant in (1, 2, 3) for compact in (False, True)]
    if '--png' in sys.argv:
        render_png(paths, ROOT.parents[2] / 'output' / 'issue72' / 'calendario')
    else:
        print(f'{len(paths)} bocetos de calendario generados.')
