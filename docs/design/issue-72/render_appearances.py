"""Comparable, fictional visual studies for #72; never imports app state.

python3 docs/design/issue-72/render_appearances.py
python3 docs/design/issue-72/render_appearances.py --png
Only --png uses existing system librsvg/cairo. No product dependencies.
"""
from datetime import date, timedelta
from html import escape
from pathlib import Path
import json
import sys
sys.dont_write_bytecode = True
from render_proposals import ICONS, render_png

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'assets' / 'appearances'
THEMES = [
    dict(id='warm', name='Cálido', concept='Papel y terracota', bg='#f3ede3', panel='#fffcf5', inner='#eee4d6', text='#30281f', muted='#665b4e', line='#c3b4a2', accent='#9b4228', ink='#ffffff', radius=26, control=12, font='sans-serif', heading='serif', border=1, dark=False, detail='Superficies de papel, títulos serenos y profundidad suave.', benefit='Separa las zonas de lectura con calidez y pocos adornos.', risk='Comprobar los estados secundarios sobre el fondo crema.'),
    dict(id='amoled', name='AMOLED', concept='Instrumentos nocturnos', bg='#000000', panel='#0d1316', inner='#152124', text='#edf9f8', muted='#a4bbb9', line='#405a5b', accent='#6be4df', ink='#052321', radius=12, control=7, font='monospace', heading='sans-serif', border=1, dark=True, detail='Negro puro, contornos técnicos y cifras monoespaciadas.', benefit='Jerarquía clara para lectura nocturna, sin resplandores continuos.', risk='Validar brillo, halos y legibilidad física; sin prometer ahorro en la T65.'),
    dict(id='retro', name='Retro', concept='Estudio de los setenta', bg='#e9dfc6', panel='#fbf1d6', inner='#e9ddbb', text='#302e21', muted='#665b3b', line='#968765', accent='#984025', ink='#fff9e9', radius=30, control=10, font='sans-serif', heading='serif', border=2, dark=False, detail='Crema, tinta oliva, cabeceras con serif y esquinas asimétricas.', benefit='Da carácter a títulos y contenido sin convertirlos en decoración.', risk='Evitar que la serif o los contornos carguen los tamaños pequeños.'),
    dict(id='glass', name='Cristal', concept='Vidrio y luz', bg='#162b47', panel='#2c4161', inner='#3a5274', text='#faf8ff', muted='#d0d9ec', line='#8297b7', accent='#ddd2ff', ink='#251b45', radius=30, control=18, font='sans-serif', heading='sans-serif', border=1, dark=True, detail='Superficies luminosas, reflejo superior y acento lavanda.', benefit='Distingue planos con una base de lectura estable.', risk='El boceto usa color opaco; el contraste compuesto y el coste del blur se medirán al implementar.'),
    dict(id='original', name='Original', concept='Azul en calma', bg='#101d32', panel='#1c3048', inner='#29405a', text='#f5f7ff', muted='#bccbdd', line='#526c88', accent='#a5b4fc', ink='#14203b', radius=20, control=12, font='sans-serif', heading='sans-serif', border=1, dark=True, detail='Azul profundo, superficies mates y jerarquía tranquila.', benefit='Conserva familiaridad con la dirección B ya elegida.', risk='No dejar que el fondo o demasiadas capas compitan con los datos.'),
    dict(id='nordic', name='Nórdico', concept='Claro y botánico', bg='#eceee8', panel='#ffffff', inner='#e9eee5', text='#182219', muted='#53604f', line='#a6b39e', accent='#9be25f', ink='#15270b', radius=32, control=18, font='sans-serif', heading='sans-serif', border=0, dark=False, detail='Blanco mate, verde vivo y un bloque de hora oscuro.', benefit='Destaca dato principal y selección, inspirado en la primera referencia.', risk='Reservar el verde intenso a acciones/selección y mantener las señales de evento.'),
    dict(id='swiss', name='Suizo', concept='Precisión azul', bg='#eeefed', panel='#ffffff', inner='#e9edfa', text='#101923', muted='#4b586b', line='#a6b3c5', accent='#2051e5', ink='#ffffff', radius=6, control=5, font='sans-serif', heading='sans-serif', border=1, dark=False, detail='Azul eléctrico, rótulos precisos, títulos firmes y radios contenidos.', benefit='Una lectura editorial y técnica inspirada en la segunda referencia.', risk='Mantener suficiente aire y no convertir cada fila en una caja.'),
    dict(id='mediterranean', name='Mediterráneo', concept='Cal y cerámica', bg='#f3ebdc', panel='#fffdf7', inner='#e9e1cf', text='#20374b', muted='#546572', line='#aca58f', accent='#23559b', ink='#ffffff', radius=34, control=14, font='sans-serif', heading='serif', border=1, dark=False, detail='Marfil, azul cerámico, arcos discretos y pequeños acentos terracota.', benefit='Una identidad luminosa y doméstica con títulos fáciles de distinguir.', risk='Los arcos y detalles se mantienen fuera del texto y del área útil.'),
    dict(id='monochrome', name='Monocromo', concept='Tinta y papel', bg='#e9e9e6', panel='#ffffff', inner='#efefec', text='#171717', muted='#575754', line='#777773', accent='#171717', ink='#ffffff', radius=2, control=2, font='sans-serif', heading='serif', border=1, dark=False, detail='Blanco/negro, serif editorial y separadores de tinta.', benefit='Estados distinguibles por forma, texto y contorno.', risk='Conservar el color informativo de los eventos; monocromo es el marco, no una pérdida de señales.'),
    dict(id='brutalist', name='Brutalista', concept='Bloques expresivos', bg='#d9e7f5', panel='#fffdf5', inner='#dce7fa', text='#111827', muted='#3c485d', line='#111827', accent='#fee72a', ink='#111827', radius=0, control=0, font='sans-serif', heading='sans-serif', border=3, dark=False, detail='Contornos negros, sombra desplazada y acentos amarillo/azul.', benefit='Hace muy explícitos los límites, estados y acciones.', risk='Contener sombras dentro del margen y evitar saturación o vibración visual.'),
]
PAGES = ['dashboard', 'assistant', 'calendar', 'clock', 'weather', 'notes', 'gallery', 'settings']
NAMES = {
    'dashboard': ('Inicio', 'Home'), 'assistant': ('Asistente', 'Assistant'),
    'calendar': ('Calendario', 'Calendar'), 'clock': ('Reloj', 'Clock'),
    'weather': ('Tiempo', 'Weather'), 'notes': ('Notas', 'Notes'),
    'gallery': ('Galería', 'Gallery'), 'settings': ('Ajustes', 'Settings'),
}
EVENTS = {11: [('Reunión', 'Meeting', 'blue'), ('Paseo', 'Walk', 'mint')],
          12: [('Dentista', 'Dentist', 'coral')], 13: [('Recados', 'Errands', 'sun')],
          18: [('Revisión', 'Review', 'blue')], 24: [('Comida', 'Lunch', 'mint')]}


class Study:
    def __init__(self, theme, page, portrait=False, lang='es', editing=False):
        self.p, self.page, self.portrait, self.lang, self.editing = theme, page, portrait, lang, editing
        self.w, self.h = (800, 1200) if portrait else (1280, 800)
        title = f'{theme["name"]} · {self.t(*NAMES[page])} · {"Vertical" if portrait else "Horizontal"}'
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="title desc">',
                      f'<title id="title">{escape(title)}</title>',
                      '<desc id="desc">Propuesta visual con contenido ficticio. Controles dibujados; no es una captura de la aplicación ni una especificación funcional completa.</desc>',
                      '<defs><linearGradient id="glass" x2="1" y2="1"><stop stop-color="#293f76"/><stop offset=".55" stop-color="#183346"/><stop offset="1" stop-color="#252344"/></linearGradient></defs>']
        self.rect(0, 0, self.w, self.h, 'bg', 0)
        if theme['id'] == 'glass':
            self.parts.append(f'<rect width="{self.w}" height="{self.h}" fill="url(#glass)"/>')
            self.parts.append('<circle cx="110" cy="60" r="220" fill="#8c89ff" opacity=".1"/>')
        self.text(32, 33, 'PABLO TABLET', 12, 'muted', 700, tracking=2)
        self.text(32, 77, self.t('Buenos días, Pablo', 'Good morning, Pablo') if page == 'dashboard' else self.t(*NAMES[page]), 30, weight=700, heading=True)
        self.text(self.w-32, 36, self.t('Miércoles, 11 de noviembre', 'Wednesday, November 11'), 14, 'muted', anchor='end')
        if editing:
            self.text(self.w-32, 73, self.t('Edición · mismos límites', 'Edit · same bounds'), 14, 'muted', anchor='end')

    def t(self, es, en):
        return en if self.lang == 'en' else es

    def color(self, role):
        return self.p.get(role, role)

    def rect(self, x, y, w, h, fill='panel', radius=None, stroke=None, width=1, extra=''):
        radius = self.p['control'] if radius is None else radius
        self.parts.append(f'<rect x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" rx="{radius:g}" fill="{self.color(fill)}" stroke="{self.color(stroke) if stroke else "none"}" stroke-width="{width:g}" {extra}/>')

    def text(self, x, y, value, size=16, color='text', weight=400, anchor='start', heading=False, tracking=0):
        self.parts.append(f'<text x="{x:g}" y="{y:g}" fill="{self.color(color)}" font-family="{self.p["heading" if heading else "font"]}" font-size="{size:g}" font-weight="{weight}" text-anchor="{anchor}" letter-spacing="{tracking:g}">{escape(str(value))}</text>')

    def line(self, x1, y1, x2, y2, color='line', width=1):
        self.parts.append(f'<path d="M{x1:g} {y1:g} L{x2:g} {y2:g}" fill="none" stroke="{self.color(color)}" stroke-width="{width:g}"/>')

    def icon(self, name, x, y, size=22, color='muted'):
        name = 'home' if name == 'dashboard' else name
        if color == 'accent' and self.p['id'] in ('nordic', 'brutalist'):
            color = '#42672a' if self.p['id'] == 'nordic' else 'text'
        self.parts.append(f'<path d="{ICONS[name]}" transform="translate({x:g} {y:g}) scale({size/24:g})" fill="none" stroke="{self.color(color)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>')

    def pane(self, x, y, w, h, title='', icon=None, widget=None, inverse=False):
        tid = self.p['id']
        if tid in ('warm', 'retro'):
            self.rect(x, y+4, w, h, '#d2c3ab', self.p['radius'])
        if tid == 'brutalist':
            self.rect(x+4, y+4, w, h, 'text', 0)
        fill = '#182219' if inverse else 'panel'
        if tid == 'retro':
            r = self.p['radius']
            d = f'M{x+r} {y}H{x+w-8}Q{x+w} {y} {x+w} {y+8}V{y+h-r}Q{x+w} {y+h} {x+w-r} {y+h}H{x+8}Q{x} {y+h} {x} {y+h-8}V{y+r}Q{x} {y} {x+r} {y}Z'
            self.parts.append(f'<path d="{d}" fill="{self.color(fill)}" stroke="{self.p["line"]}" stroke-width="2"/>')
        else:
            self.rect(x, y, w, h, fill, self.p['radius'], 'line' if self.p['border'] else None, self.p['border'])
        if widget:
            # Invisible geometry marker remains independent of theme decoration.
            self.parts.append(f'<rect data-widget="{widget}" x="{x:g}" y="{y:g}" width="{w:g}" height="{h:g}" fill="none"/>')
        if tid == 'glass':
            self.line(x+22, y+2, x+w-22, y+2, '#b1bfe0')
        if tid == 'swiss':
            self.rect(x+18, y+20, 3, 20, 'accent', 0)
        if tid == 'mediterranean':
            self.parts.append(f'<path d="M{x+w-52} {y+30}a16 16 0 0 1 32 0" fill="none" stroke="#b9623d" stroke-width="3"/>')
        if title:
            if icon:
                self.icon(icon, x+22, y+22, color='accent')
            self.text(x+54 if icon else x+22, y+39, title, 19, weight=700, heading=True)
            if tid == 'monochrome':
                self.line(x+22, y+54, x+w-22, y+54, 'text', 1.5)
        if widget and self.editing:
            self.rect(x+3, y+3, w-6, h-6, 'none', max(0, self.p['radius']-3), 'accent', 2)
            for hx, hy in ((x+w/2-22, y+8), (x+w-52, y+h/2-22)):
                self.rect(hx, hy, 44, 44, 'accent', self.p['control'])
                self.text(hx+22, hy+28, '↕' if hy == y+8 else '↔', 20, 'ink', 600, 'middle')

    def button(self, x, y, w, label, primary=False):
        self.rect(x, y, w, 44, 'accent' if primary else 'inner', stroke=None if primary else 'line')
        self.text(x+w/2, y+28, label, 14, 'ink' if primary else 'text', 650, 'middle')

    def chip(self, x, y, w, label, color='blue', height=24):
        colors = ({'blue': ('#bed0ff', '#263f62'), 'mint': ('#a1e7ca', '#224a40'), 'coral': ('#ffc8b8', '#593e43'), 'sun': ('#ffe0a8', '#51452e')} if self.p['dark'] else
                  {'blue': ('#224690', '#e6edff'), 'mint': ('#235c42', '#dceee2'), 'coral': ('#8b382d', '#f9e2da'), 'sun': ('#70521d', '#f4e9c9')})
        fg, bg = colors[color]
        self.rect(x, y, w, height, bg, min(self.p['control'], 7))
        self.rect(x+2, y+4, 3, height-8, fg, 1)
        self.text(x+10, y+height-7, label, 12, fg, 600)

    def upcoming(self, x, y, w, count=3):
        self.text(x, y, self.t('Próximos eventos', 'Upcoming events'), 17, weight=700, heading=True)
        rows = [(self.t('Reunión de equipo', 'Team meeting'), self.t('Hoy · 18:00', 'Today · 18:00'), 'blue'),
                (self.t('Paseo', 'Walk'), self.t('Hoy · 19:30', 'Today · 19:30'), 'mint'),
                (self.t('Dentista', 'Dentist'), self.t('Mañana · 10:30', 'Tomorrow · 10:30'), 'coral')]
        for i, (name, when, color) in enumerate(rows[:count]):
            top = y+18+i*80
            self.rect(x, top, w, 66, 'inner')
            self.chip(x+10, top+10, w-20, name, color)
            self.text(x+20, top+54, when, 13, 'muted')

    def month(self, x, y, w, h, side=False, title=True):
        if title:
            self.text(x, y+18, self.t('Noviembre 2026', 'November 2026'), 20, weight=700, heading=True)
            y += 44
            h -= 44
        sidew = 208 if side else 0
        gw = w-sidew
        cellw, cellh = gw/7, (h-28)/6
        for i, d in enumerate(self.t('L M X J V S D', 'M T W T F S S').split()):
            self.text(x+cellw*(i+.5), y+12, d, 12, 'muted', 600, 'middle')
        start = date(2026, 10, 26)
        for i in range(42):
            day = start+timedelta(days=i)
            cx, cy = x+i%7*cellw, y+28+i//7*cellh
            current = day == date(2026, 11, 11)
            if i%7 == 0 and i:
                self.line(x, cy-2, x+gw-6, cy-2)
            if current:
                self.rect(cx+2, cy, cellw-5, cellh-5, 'inner', min(self.p['control'], 10), 'accent', 2)
                self.rect(cx+cellw/2-15, cy+5, 30, 30, 'accent', min(self.p['control'], 15))
            self.text(cx+cellw/2, cy+26, day.day, 15, 'ink' if current else 'text' if day.month == 11 else 'muted', 700 if current else 500, 'middle')
            entries = EVENTS.get(day.day, []) if day.month == 11 else []
            if entries:
                es, en, color = entries[0]
                if (cellw >= 70 and cellh >= 60) or (cellw >= 46 and cellh >= 70):
                    label = self.t(es, en)
                    limit = max(2, int((cellw-22)/7.3))
                    if len(label) > limit:
                        label = label[:max(1, limit-1)]+'…'
                    self.chip(cx+4, cy+36, cellw-10, label, color, height=20)
                    if len(entries) > 1:
                        self.text(cx+cellw-9, cy+25 if cellw >= 70 else cy+cellh-4, '+1', 11, 'muted', 600, 'end')
                else:
                    fg = ({'blue': '#bed0ff', 'mint': '#a1e7ca', 'coral': '#ffc8b8', 'sun': '#ffe0a8'} if self.p['dark'] else
                          {'blue': '#224690', 'mint': '#235c42', 'coral': '#8b382d', 'sun': '#70521d'})[color]
                    self.rect(cx+cellw/2-3, cy+39, 6, 6, fg, 3)
                    if len(entries) > 1:
                        self.text(cx+cellw/2+8, cy+45, '+1', 10, 'muted')
        if side:
            self.line(x+gw+4, y, x+gw+4, y+h-8)
            self.upcoming(x+gw+20, y+17, sidew-24)

    def clock(self, x, y, w, h, widget=False):
        inverse = self.p['id'] == 'nordic'
        self.pane(x, y, w, h, widget='clock' if widget else None, inverse=inverse)
        fg, muted = ('#f5fbf0', '#bdcbb7') if inverse else ('text', 'muted')
        self.text(x+22, y+32, self.t('Ahora', 'Now'), 14, muted, 600)
        narrow = w < 300
        self.text(x+22, y+(h*.54 if narrow else 105), '11:30', 56 if narrow else 68, fg, 600 if self.p['id'] in ('swiss', 'brutalist') else 400)
        if not narrow:
            self.text(x+227, y+105, ':24', 22, muted)
        self.text(x+22, y+h-25, self.t('Miércoles, 11 nov', 'Wednesday, Nov 11'), 14, muted)

    def note(self, x, y, w, h, widget=False):
        self.pane(x, y, w, h, self.t('Notas', 'Notes'), 'notes', 'notes' if widget else None)
        self.text(x+22, y+72, self.t('Lista de casa', 'Home checklist'), 18, weight=650)
        items = [('Preparar la mochila', 'Pack the bag'), ('Revisar la agenda', 'Check the calendar'), ('Comprar fruta', 'Buy fruit')]
        # Narrow cards wrap text into explicit lines; same wording in all themes.
        top, step = y+99, 56 if w < 300 else 40
        for i, pair in enumerate(items[:2] if h < 230 else items):
            yy = top+i*step
            self.rect(x+22, yy, 18, 18, 'inner', min(4, self.p['control']), 'muted')
            value = self.t(*pair)
            if w < 240:
                words = value.split()
                split = 2
                self.text(x+50, yy+14, ' '.join(words[:split]), 14)
                if words[split:]:
                    self.text(x+50, yy+32, ' '.join(words[split:]), 14)
            else:
                self.text(x+50, yy+14, value, 14)
        if h > 240:
            self.text(x+22, y+h-24, self.t('Nota 1 de 3', 'Note 1 of 3'), 13, 'muted')

    def weather(self, x, y, w, h, widget=False):
        self.pane(x, y, w, h, self.t('Tiempo', 'Weather'), 'weather', 'weather' if widget else None)
        self.text(x+22, y+76, 'Madrid', 16, 'muted')
        self.icon('weather', x+22, y+99, 40, 'accent')
        self.text(x+22, y+194, '18°', 62, weight=600)
        self.text(x+22, y+226, self.t('Poco nuboso', 'Partly cloudy'), 16)
        if h > 290:
            self.line(x+22, y+250, x+w-22, y+250)
            self.text(x+22, y+279, self.t('Máx. 20° · Mín. 11°', 'High 20° · Low 11°'), 14, 'muted')
            self.text(x+22, y+308, self.t('Sin lluvia · Viento 8 km/h', 'No rain · Wind 8 km/h'), 13, 'muted')

    def dashboard(self):
        cols, rows = (3, 4) if self.portrait else (4, 3)
        gap, left, top, bottom = 18, 32, 106, self.h-88
        cw, rh = (self.w-64-gap*(cols-1))/cols, (bottom-top-gap*(rows-1))/rows
        def area(c, r, cs, rs):
            return left+c*(cw+gap), top+r*(rh+gap), cw*cs+gap*(cs-1), rh*rs+gap*(rs-1)
        x, y, w, h = area(0, 0, 2, 3)
        self.pane(x, y, w, h, self.t('Calendario', 'Calendar'), 'calendar', 'agenda')
        self.month(x+22, y+69, w-44, h-91, side=not self.portrait)
        self.clock(*area(2, 0, 1, 2) if self.portrait else area(2, 0, 2, 1), widget=True)
        self.note(*area(0, 3, 2, 1) if self.portrait else area(2, 1, 1, 2), widget=True)
        self.weather(*area(2, 2, 1, 2) if self.portrait else area(3, 1, 1, 2), widget=True)

    def calendar_page(self):
        cw = self.w-64 if self.portrait else 850
        ch = 648 if self.portrait else 604
        self.pane(32, 106, cw, ch, self.t('Agenda del mes', 'Monthly agenda'), 'calendar')
        self.button(54, 167, 146, self.t('Finalizados', 'Completed'))
        for off, label in ((0, '‹'), (52, self.t('Hoy', 'Today')), (124, '›')):
            self.button(32+cw-208+off, 167, 44 if label in ('‹', '›') else 64, label)
        self.month(54, 233, cw-44, ch-149)
        sx, sy, sw = (32, 776, self.w-64) if self.portrait else (904, 106, 344)
        self.pane(sx, sy, sw, 336)
        self.upcoming(sx+22, sy+35, sw-44)
        if not self.portrait:
            self.pane(sx, 462, sw, 248, self.t('Calendarios', 'Calendars'))
            for i, label in enumerate([self.t('Local · disponible sin red', 'Local · available offline'), 'Google', 'Outlook']):
                self.text(sx+22, 543+i*44, label, 15)
                self.text(sx+sw-24, 543+i*44, '✓' if i == 0 else '›', 18, 'muted', anchor='end')
        self.button(self.w-196, 55, 164, self.t('+ Nuevo evento', '+ New event'), True)

    def clock_page(self):
        if self.portrait:
            self.clock(32, 106, 736, 164)
            regions = [(32, 288, 736, 218), (32, 524, 736, 218)]
            py, ph = 760, 352
        else:
            self.clock(32, 106, 334, 372)
            regions = [(384, 106, 420, 372), (822, 106, 426, 372)]
            py, ph = 496, 216
        for idx, (x, y, w, h) in enumerate(regions):
            self.pane(x, y, w, h, self.t('Alarmas', 'Alarms') if idx == 0 else self.t('Temporizadores', 'Timers'), 'clock')
            self.text(x+22, y+90, '07:30' if idx == 0 else '05:00', 34, weight=600)
            self.text(x+22, y+123, self.t('Entre semana · Despertar', 'Weekdays · Wake up') if idx == 0 else self.t('Lectura · En pausa', 'Reading · Paused'), 15, 'muted')
            self.button(x+22, y+h-65, 148, self.t('Nueva alarma', 'New alarm') if idx == 0 else self.t('Iniciar', 'Start'), idx == 1)
            if idx == 1:
                self.button(x+w-142, y+h-65, 120, self.t('Cronómetro', 'Stopwatch'))
        self.pane(32, py, self.w-64, ph, self.t('Estilo del widget de reloj', 'Clock widget style'))
        self.text(54, py+67, self.t('Se aplica en Inicio · Guardado automático', 'Applied on Home · Saved automatically'), 14, 'muted')
        cols = 2 if self.portrait else 4
        ww = (self.w-108-(cols-1)*12)/cols
        for i, pair in enumerate([('Digital clásico', 'Classic digital'), ('Digital en bloques', 'Block digital'), ('Analógico con números', 'Analog with numbers'), ('Analógico minimalista', 'Minimal analog')]):
            xx, yy = 54+i%cols*(ww+12), py+87+i//cols*119
            self.rect(xx, yy, ww, 104, 'inner', stroke='accent' if i == 0 else 'line', width=2 if i == 0 else 1)
            if i < 2:
                if i == 1:
                    self.rect(xx+ww/2-57, yy+12, 49, 40, 'panel', 5)
                    self.rect(xx+ww/2+8, yy+12, 49, 40, 'panel', 5)
                self.text(xx+ww/2, yy+44, '09:41', 28, anchor='middle')
            else:
                self.parts.append(f'<circle cx="{xx+ww/2}" cy="{yy+33}" r="25" fill="none" stroke="{self.p["muted"]}"/>')
                self.line(xx+ww/2, yy+33, xx+ww/2-12, yy+28, 'text', 2)
                self.line(xx+ww/2, yy+33, xx+ww/2+15, yy+23, 'text', 2)
                if i == 2:
                    self.text(xx+ww/2, yy+17, '12', 8, 'muted', anchor='middle')
            self.text(xx+ww/2, yy+86, self.t(*pair), 14, weight=600, anchor='middle')

    def notes_page(self):
        if self.portrait:
            self.pane(32, 106, 736, 160, self.t('Tus notas', 'Your notes'), 'notes')
            self.button(54, 183, 200, self.t('Lista de casa', 'Home checklist'), True)
            self.button(270, 183, 180, self.t('Texto', 'Text'))
            self.button(466, 183, 180, self.t('Dibujo', 'Drawing'))
            x, y, w, h = 32, 284, 736, 828
        else:
            self.pane(32, 106, 280, 606, self.t('Tus notas', 'Your notes'), 'notes')
            for i, pair in enumerate([('Lista de casa', 'Home checklist'), ('Ideas del fin de semana', 'Weekend ideas'), ('Nuevo dibujo', 'New drawing')]):
                self.rect(54, 182+i*90, 236, 72, 'inner', stroke='accent' if i == 0 else None)
                self.text(68, 211+i*90, self.t(*pair), 15, weight=650)
                self.text(68, 236+i*90, self.t('Guardado local', 'Saved locally'), 12, 'muted')
            x, y, w, h = 330, 106, 918, 606
        self.pane(x, y, w, h, self.t('Lista de casa', 'Home checklist'))
        self.button(x+22, y+64, 118, self.t('Fijar', 'Pin'))
        self.button(x+152, y+64, 132, self.t('Archivar', 'Archive'))
        self.button(x+w-146, y+64, 124, self.t('Nueva nota', 'New note'), True)
        self.line(x+22, y+129, x+w-22, y+129)
        for i, pair in enumerate([('Preparar la mochila', 'Pack the bag'), ('Revisar la agenda de mañana', 'Check tomorrow’s calendar'), ('Comprar fruta y pan', 'Buy fruit and bread')]):
            self.rect(x+30, y+164+i*62, 22, 22, 'inner', 4, 'muted')
            self.text(x+70, y+181+i*62, self.t(*pair), 19)
        self.line(x+22, y+h-110, x+w-22, y+h-110)
        self.text(x+22, y+h-75, self.t('Recordatorio', 'Reminder'), 15, 'muted')
        self.button(x+22, y+h-60, 226, self.t('Elegir fecha y hora', 'Choose date and time'))
        self.text(x+w-22, y+h-30, self.t('Guardado local', 'Saved locally'), 13, 'muted', anchor='end')

    def settings_page(self):
        w = self.w-64
        self.pane(32, 106, w, 172, self.t('Idioma', 'Language'))
        self.text(54, 193, self.t('Idioma de la aplicación', 'Application language'), 17)
        self.button(self.w-236, 174, 182, self.t('Español', 'English'))
        self.text(54, 245, self.t('También se aplica a la administración móvil.', 'Also applies to mobile administration.'), 14, 'muted')
        self.pane(32, 296, w, 270 if self.portrait else 230, self.t('Apariencia', 'Appearance'))
        cols = 5
        cellw = (w-44-12*4)/5
        for i, t in enumerate(THEMES):
            xx, yy = 54+i%cols*(cellw+12), 359+i//cols*(91 if self.portrait else 76)
            self.rect(xx, yy, cellw, 75 if self.portrait else 64, t['bg'], 8, 'accent' if t['id'] == self.p['id'] else 'line', 2 if t['id'] == self.p['id'] else 1)
            self.rect(xx+12, yy+12, 26, 26, t['panel'], min(t['radius'], 8), t['line'])
            self.rect(xx+42, yy+12, 12, 26, t['accent'], min(t['control'], 4))
            self.text(xx+12, yy+(61 if self.portrait else 54), t['name'], 12, t['text'], 600)
        yy = 584 if self.portrait else 544
        hh = 528 if self.portrait else 168
        self.pane(32, yy, w, hh, self.t('Widgets y páginas', 'Widgets and pages'))
        self.text(54, yy+82, self.t('Diseño del paginador', 'Page navigation style'), 16)
        self.button(self.w-274, yy+57, 220, self.t('Dock compacto', 'Compact dock'))
        self.line(54, yy+116, self.w-54, yy+116)
        self.text(54, yy+146, self.t('Posición del dock', 'Dock position'), 16)
        self.text(self.w-65, yy+146, self.t('Abajo  ▾', 'Bottom  ▾'), 16, anchor='end')
        if self.portrait:
            self.text(54, yy+217, self.t('Mantener pantalla encendida', 'Keep screen awake'), 16)
            self.rect(self.w-110, yy+195, 56, 30, 'accent', 15)
            self.rect(self.w-82, yy+199, 22, 22, 'ink', 11)
            self.line(54, yy+251, self.w-54, yy+251)
            self.text(54, yy+288, self.t('Más controles continúan al desplazar', 'More controls continue when scrolling'), 14, 'muted')

    def assistant_page(self):
        self.pane(32, 106, self.w-64, self.h-194, 'Lumi', 'assistant')
        self.text(58, 186, self.t('¿Qué quieres preparar hoy?', 'What would you like to plan today?'), 26, weight=650, heading=True)
        bw = min(self.w-130, 660)
        self.rect(58, 227, bw, 74, 'inner')
        self.text(80, 257, self.t('Consulta tu agenda, el tiempo o tus notas.', 'Check your calendar, weather or notes.'), 17)
        self.text(80, 282, self.t('Las acciones requieren tu confirmación.', 'Actions require your confirmation.'), 14, 'muted')
        self.rect(self.w-58-bw, 333, bw, 58, 'accent')
        self.text(self.w-36-bw, 369, self.t('¿Qué tengo esta tarde?', 'What is on this afternoon?'), 18, 'ink')
        self.rect(58, 423, bw, 124, 'inner')
        self.text(80, 460, self.t('18:00 · Reunión de equipo', '18:00 · Team meeting'), 18, weight=650)
        self.text(80, 494, self.t('19:30 · Paseo', '19:30 · Walk'), 17)
        self.text(80, 526, self.t('Dos eventos en tu calendario local.', 'Two events in your local calendar.'), 14, 'muted')
        yy = self.h-166
        self.rect(54, yy, self.w-240, 56, 'inner', stroke='line')
        self.text(74, yy+35, self.t('Escribe o usa el micrófono…', 'Type or use the microphone…'), 17, 'muted')
        self.button(self.w-170, yy+6, 116, self.t('Hablar', 'Speak'), True)

    def weather_page(self):
        if self.portrait:
            self.weather(32, 106, 736, 348)
            x, y, w, h = 32, 472, 736, 640
        else:
            self.weather(32, 106, 380, 606)
            x, y, w, h = 430, 106, 818, 606
        self.pane(x, y, w, h, self.t('Previsión', 'Forecast'))
        self.text(x+22, y+80, self.t('Próximas horas', 'Next hours'), 16, 'muted')
        for i, (hour, temp) in enumerate([('12:00', '18°'), ('15:00', '20°'), ('18:00', '17°'), ('21:00', '14°')]):
            xx = x+22+i*(w-44)/4
            self.text(xx, y+117, hour, 15)
            self.icon('weather', xx+5, y+139, 26, 'accent')
            self.text(xx, y+196, temp, 26, weight=600)
        self.line(x+22, y+226, x+w-22, y+226)
        for i, pair in enumerate([('Mañana', 'Tomorrow'), ('Viernes', 'Friday'), ('Sábado', 'Saturday'), ('Domingo', 'Sunday')]):
            yy = y+274+i*66
            self.text(x+22, yy, self.t(*pair), 17)
            self.icon('weather', x+w/2-12, yy-20, 24, 'accent')
            self.text(x+w-22, yy, f'{20-i}° / {11-i}°', 17, anchor='end')

    def gallery_page(self):
        self.pane(32, 106, self.w-64, self.h-194, self.t('Tus recuerdos', 'Your memories'), 'gallery')
        self.button(self.w-236, 126, 182, self.t('Añadir fotos', 'Add photos'), True)
        cols, rows = (2, 3) if self.portrait else (3, 2)
        ww = (self.w-132-(cols-1)*16)/cols
        hh = (self.h-340-(rows-1)*16)/rows
        for i in range(6):
            xx, yy = 66+i%cols*(ww+16), 208+i//cols*(hh+16)
            self.rect(xx, yy, ww, hh, 'inner', min(12, self.p['radius']))
            # Neutral illustrations stand in for photos, never recolor real media.
            self.parts.append(f'<circle cx="{xx+ww*.73}" cy="{yy+hh*.28}" r="{hh*.11}" fill="#cfb476"/>')
            self.parts.append(f'<path d="M{xx+12} {yy+hh-12}L{xx+ww*.4} {yy+hh*.4}L{xx+ww*.62} {yy+hh*.7}L{xx+ww*.8} {yy+hh*.52}L{xx+ww-12} {yy+hh-12}Z" fill="#6f9184"/>')
        self.text(66, self.h-110, self.t('6 imágenes de ejemplo · Sin fotografías personales', '6 sample images · No personal photographs'), 14, 'muted')

    def dock(self):
        width, height = 464, 60
        x, y = (self.w-width)/2, self.h-height-12
        self.rect(x, y, width, height, 'panel', min(self.p['radius'], 22), 'line', self.p['border'] or 1)
        for i, page in enumerate(PAGES):
            xx = x+10+i*56
            if page == self.page:
                self.rect(xx, y+6, 48, 48, 'accent', self.p['control'])
            self.icon(page, xx+13, y+19, 22, 'ink' if page == self.page else 'muted')

    def save(self):
        methods = {'dashboard': self.dashboard, 'calendar': self.calendar_page, 'clock': self.clock_page, 'notes': self.notes_page,
                   'settings': self.settings_page, 'assistant': self.assistant_page, 'weather': self.weather_page, 'gallery': self.gallery_page}
        methods[self.page]()
        self.dock()
        self.parts.append('</svg>')
        suffix = '-edit' if self.editing else ''
        path = OUT / f'{self.p["id"]}-{self.page}-{self.lang}-{"portrait" if self.portrait else "landscape"}{suffix}.svg'
        path.write_text('\n'.join(self.parts)+'\n', encoding='utf-8')
        return path


def overview(paths):
    import xml.etree.ElementTree as ET
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="2250" viewBox="0 0 1280 2250"><title>Diez apariencias · Inicio horizontal</title><rect width="1280" height="2250" fill="#f1f0ec"/>']
    for i, theme in enumerate(THEMES):
        x, y = i%2*640+12, i//2*450+8
        parts.append(f'<text x="{x+6}" y="{y+25}" font-family="sans-serif" font-weight="600" font-size="19" fill="#1c2930">{i+1}. {escape(theme["name"])} · {escape(theme["concept"])}</text>')
        svg = ET.parse(OUT/f'{theme["id"]}-dashboard-es-landscape.svg').getroot()
        # Prefix gradient IDs so the inline studies remain independent.
        content = ''.join(ET.tostring(child, encoding='unicode') for child in svg if child.tag.split('}')[-1] not in ('title', 'desc'))
        content = content.replace('id="glass"', f'id="glass-{i}"').replace('url(#glass)', f'url(#glass-{i})')
        parts.append(f'<svg x="{x}" y="{y+40}" width="614.4" height="384" viewBox="0 0 1280 800" overflow="hidden">{content}</svg>')
    parts.append('</svg>')
    path = OUT/'overview.svg'
    path.write_text('\n'.join(parts)+'\n', encoding='utf-8')
    paths.append(path)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    paths = []
    for theme in THEMES:
        for page in PAGES:
            for portrait in (False, True):
                for lang in ('es', 'en'):
                    paths.append(Study(theme, page, portrait, lang).save())
                    if page == 'dashboard':
                        paths.append(Study(theme, page, portrait, lang, editing=True).save())
    overview(paths)
    (ROOT/'appearances-data.js').write_text('window.pabloTabletAppearanceThemes = '+json.dumps(THEMES, ensure_ascii=False, indent=2)+';\n', encoding='utf-8')
    print(f'{len(paths)} SVG generados en {OUT}')
    if '--png' in sys.argv:
        output = ROOT.parents[2] / 'output' / 'issue72' / 'appearances'
        output.mkdir(parents=True, exist_ok=True)
        render_png(paths, output)
