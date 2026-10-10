"""Current additions to the historical v4 sous-vide reference; preserve its practical presets."""
from copy import deepcopy

INTRO = ('Choose chilled/thawed or frozen explicitly. Start timing after the bag is submerged and the preheated bath has recovered. '
         'Measure the thickest part and keep portions in one layer. The calculator distinguishes meat heating, soft-salmon recipe times and lean-fish pasteurization.')

def update_tables(original):
    tables=deepcopy(original)
    for t in tables:
        if 'State' in t['cols']:
            col=t['cols'].index('State')
            for row in t['rows']:
                if row[col] in ('Thawed','Defrosted'): row[col]='Chilled / thawed'
        if t['id']=='beef':
            row=deepcopy(t['rows'][0]);row[2]='Chilled / thawed';row[5]='1½ h';t['rows'].insert(0,row)
            t['after'].append('These steak windows are practical texture guides, not pasteurization schedules. For other thicknesses, use the meat heat-through calculator above.')
        elif t['id'] in ('pork-ribs','lamb'):
            # Long texture cooks: explicitly show both starting states, without inventing a precise thaw surcharge.
            col=1 if t['id']=='pork-ribs' else 2
            t['cols'].insert(col,'State')
            rows=[]
            for row in t['rows']:
                for state in ('Chilled / thawed','Frozen'):
                    r=deepcopy(row);r.insert(col,state);rows.append(r)
            t['rows']=rows
            t['after'].append('For these long texture cooks, use the same broad window from chilled or frozen. Frozen pieces must be individually separated; a solid frozen bundle or unusually large cut needs a separate schedule.')
        elif t['id']=='lamb-slices':
            rows=[]
            for row in t['rows']:
                r=deepcopy(row);r[2]='Chilled / thawed';r[4]='8–12 h' if 'Shank' in row[0] else '1½–2 h';rows.append(r);rows.append(row)
            t['rows']=rows
        elif t['id']=='chicken-breast':
            for row in t['rows']:
                if row[-1]=='Firmer + safer buffer.': row[-1]='Firmer texture; extra time for frozen heating.'
                if row[-1]=='2 h is often short; 2.5 h is safer.': row[-1]='Thick breast: allow the full listed time.'
            t['after'].append('Poultry needs a temperature-and-thickness-specific pasteurization schedule. Do not substitute the generic meat heating calculator for these chicken presets.')
    cols=['Food','Thickness','State','Temp','Time','Notes']
    rows=[]
    for thick,chilled in [('up to 13 mm',30),('14–25 mm',40),('26–38 mm',60)]:
        rows.append(['Salmon, soft',thick,'Chilled / thawed','50°C',f'{chilled} min','ChefSteps recipe timing; serve immediately. Not pasteurized.'])
        rows.append(['Salmon, soft',thick,'Frozen','50°C',f'{int(chilled*1.5)} min','Estimate: recipe time × 1.5. Not a validated pasteurization schedule.'])
    tables.append({'id':'salmon','title':'Salmon — soft at 50 °C','cols':cols,'rows':rows,'after':[
        'Use salmon suitable for undercooked service with supplier-confirmed parasite controls. Ordinary freezer storage does not establish parasite destruction. Unpasteurized fish is unsuitable for pregnant or immunocompromised people.',
        '<a href="sous-vide-salmon.html">Full salmon recipe: bagging, cooking and crisp-skin finish →</a>',
        'Sources: <a href="https://www.chefsteps.com/recipes/sous-vide-salmon">ChefSteps salmon recipe</a>; <a href="https://www.chefsteps.com/guides-tools/you-can-cook-frozen-food-sous-vide-without-defrosting-here-s-how">ChefSteps frozen-food guidance</a>.']})
    for ident,title,food,minutes in [
        ('salmon-pasteurized','Salmon — pasteurized at 60 °C','Salmon, fatty fish',[40,50,60,75,90,120,135,150]),
        ('lean-fish','Lean fish — pasteurized at 60 °C','Cod or similar lean fish',[30,35,50,60,75,105,120,135])]:
        rows=[]
        for i,time in enumerate(minutes):
            mm=(i+1)*5
            rows.append([food,f'{mm} mm','Chilled / thawed','60°C',f'{time} min','Starts at 5°C; includes heating and pasteurization.'])
            rows.append([food,f'{mm} mm','Frozen → thaw first','60°C',f'Thaw, then {time} min','Thaw in the fridge to 5°C first. Thawing time is additional.'])
        tables.append({'id':ident,'title':title,'cols':cols,'rows':rows,'after':[
            'Measure the thickest part; round up to the next 5 mm row. These are Baldwin’s separate fatty- and lean-fish schedules. They are not interchangeable.',
            'Remove reduced-oxygen retail packaging before fridge thawing. These schedules start with fully thawed fish, not a frozen centre.',
            'Source: <a href="https://douglasbaldwin.com/sous-vide.html#Fish_and_Shellfish">Baldwin, Table 3.1 — fish pasteurization</a>.']})
    return tables
