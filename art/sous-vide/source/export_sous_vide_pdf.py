#!/usr/bin/env python3
"""Generate current EN/RU printable tables from the same canonical rows as the website.
Requires reportlab. Run from any directory; outputs recipes/assets/*_v5*.pdf.
"""
from pathlib import Path
import sys,re
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'src'))
from content import SOUS_VIDE,SV_INTRO
from i18n import Translator
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape,A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
fonts=[Path('/System/Library/Fonts/Supplemental/Arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
font=next(p for p in fonts if p.exists());pdfmetrics.registerFont(TTFont('Body',str(font)))
bold=font.with_name('Arial Bold.ttf') if font.name=='Arial.ttf' else font.with_name('DejaVuSans-Bold.ttf')
pdfmetrics.registerFont(TTFont('BodyBold',str(bold)))
pdfmetrics.registerFontFamily('Body',normal='Body',bold='BodyBold',italic='Body',boldItalic='BodyBold')
ink=colors.HexColor('#312b25');accent=colors.HexColor('#bc481e');muted=colors.HexColor('#74685d')
style=ParagraphStyle('body',fontName='Body',fontSize=8.5,leading=12,textColor=ink,spaceAfter=5)
head=ParagraphStyle('head',parent=style,fontName='BodyBold',fontSize=18,leading=23,spaceAfter=10)
sub=ParagraphStyle('sub',parent=style,fontName='BodyBold',fontSize=13,leading=17,spaceBefore=16,spaceAfter=8,keepWithNext=True)
cell=ParagraphStyle('cell',parent=style,fontSize=7.5,leading=10,spaceAfter=0)
label=ParagraphStyle('label',parent=cell,fontName='BodyBold')
def clean(s):
 s=re.sub(r'<a href="([^"]+)">([^<]+)</a>',lambda m:f'<link href="{m[1] if m[1].startswith("https://") else "https://www.ilyadays.com/food/"+m[1].replace(".html","")}">{m[2]}</link>',s)
 return s.replace('–','-').replace('—','-').replace('−','-').replace('→','-&gt;').replace('’',"'")
def footer(c,d):
 c.setFont('Body',8);c.setFillColor(muted);c.drawString(36,20,'ilyadays.com | v5 | 2026-10-11');c.drawRightString(806,20,str(d.page))
for lang in ('en','ru'):
 T=Translator(lang);tr=lambda s:T(s,'site')
 target=ROOT/'assets'/('sous_vide_quick_tables_v5'+('_ru' if lang=='ru' else '')+'.pdf')
 doc=SimpleDocTemplate(str(target),pagesize=landscape(A4),rightMargin=36,leftMargin=36,topMargin=32,bottomMargin=36,title='Sous vide tables v5',author='ilyadays')
 story=[Paragraph('Су-вид: время и температура' if lang=='ru' else 'Sous vide: time and temperature',head),Paragraph(clean(tr(SV_INTRO)),style)]
 intro=('На сайте есть калькулятор толщины для мяса, лосося и нежирной рыбы. В этом PDF приведены фиксированные режимы. Прогрев не равен пастеризации. Для низкотемпературного лосося выбирайте подходящую рыбу с подтверждённой защитой от паразитов.' if lang=='ru' else 'The website includes a thickness calculator for meat, salmon and lean fish. This PDF contains fixed schedules. Heating through is not pasteurization. Low-temperature salmon requires suitable fish with confirmed parasite controls.')
 story.append(Paragraph(intro,style))
 for ti,t in enumerate(SOUS_VIDE):
  section=[Paragraph(clean(tr(t['title'])),sub)]
  n=len(t['cols']);widths={5:[145,110,55,110,350],6:[115,70,110,45,100,330],7:[90,60,100,75,45,80,320]}[n]
  columns=[tr(x) for x in t['cols']]
  rows=[[tr(x) for x in row] for row in t['rows']]
  if t['id'] in ('salmon-pasteurized','lean-fish'):
   # Pair chilled/frozen rows for a compact printed table; frozen explicitly requires thawing.
   columns=[tr('Food'),tr('Thickness'),tr('Temp'),('Охлаждённое, 5 °C' if lang=='ru' else 'Chilled, 5°C'),('Замороженное: сначала разморозить' if lang=='ru' else 'Frozen: thaw first'),tr('Notes')]
   rows=[[cold[0],cold[1],cold[3],cold[4],frozen[4],cold[5]+' '+frozen[5]] for cold,frozen in zip(rows[::2],rows[1::2])]
   widths=[110,60,45,90,125,340]
  data=[[Paragraph(clean(x),label) for x in columns]]+[[Paragraph(clean(x),cell) for x in row] for row in rows]
  table=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
  table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#f0e7da')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.white,colors.HexColor('#faf7f1')]),('LINEBELOW',(0,0),(-1,0),.7,accent),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#e2d9cc')),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)]))
  section.extend([table,Spacer(1,9)])
  for a in t['after']:section.append(Paragraph(clean(tr(a)),style))
  story.append(KeepTogether(section))
 doc.build(story,onFirstPage=footer,onLaterPages=footer)
 print(target)
