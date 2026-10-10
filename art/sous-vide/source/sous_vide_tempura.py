"""Illustrated standalone sous-vide and tempura recipes; home adaptations of linked methods."""
from kit import Recipe, Step

SALMON_TIMES = '<table class="mini"><thead><tr><th>Thickness</th><th>Chilled / thawed</th><th>Frozen (estimate)</th></tr></thead><tbody><tr><td>up to 13 mm</td><td>30 min</td><td>45 min</td></tr><tr><td>14–25 mm</td><td>40 min</td><td>60 min</td></tr><tr><td>26–38 mm</td><td>60 min</td><td>90 min</td></tr></tbody></table>'

salmon = Recipe(
 slug='sous-vide-salmon', title='Sous vide salmon', group='Sous vide', serves=2,
 blurb='Soft, moist salmon at 50 °C, with thickness-based chilled and frozen timings and an optional crisp-skin finish.',
 yields='2 portions', total='~1 h; longer from frozen',
 intro='Measure thickness, not weight. This page uses ChefSteps’ <b>50 °C soft-salmon method</b>, with a separate estimate for frozen portions. For other sizes and the firmer 60 °C pasteurized option, see the <a href="sous-vide.html#salmon">salmon reference table</a>.',
 equipment=['Immersion circulator and water bath','Heat-rated sous-vide pouches','Ruler','Fish spatula','Frying pan'],
 ingredients=[('Salmon', [('Salmon portions, pin bones removed','2 × 150–180 g'),('Fine salt','3 g'),('Olive oil','2 tsp')]),('To finish',[('Neutral frying oil','1 tsp'),('Lemon wedges','2'),('Dill','a few sprigs, optional')])],
 steps=[
  Step('Measure, season and bag', ['Measure the <b>thickest part</b> of each portion; use the larger size if they share a bag. This schedule covers portions no thicker than <b>38 mm</b>.', 'Season with salt and bag with olive oil in <b>one layer</b>. Use a gentle vacuum so the fish keeps its shape. For frozen fish, remove the retail wrapping and rebag while still frozen.'], time='~10 min',uses=['Salmon portions, pin bones removed','Fine salt','Olive oil']),
  Step('Cook at 50 °C', ['Preheat the bath to <b>50 °C</b>. Submerge the pouch fully, with water circulating around it. Start timing once the bath recovers its temperature.', SALMON_TIMES, 'Round thickness <b>up</b> to the next row. Frozen times are <b>approximate</b>: ChefSteps’ general 50% extra-time guidance applied to its salmon recipe. These are texture timings, <b>not pasteurization times</b>.'],heat='50 °C bath',time='30–90 min'),
  Step('Dry; crisp the skin if you like', ['Lift the fish out carefully with a fish spatula and pat dry. Skinless salmon can go straight to the plate.', 'For skin-on portions, heat the neutral oil in a pan and sear <b>skin-side down</b> until crisp, about <b>30–60 seconds</b>. Keep the flesh intact; avoid a long second cook.'],heat='high',time='~2 min',uses=['Neutral frying oil']),
  Step('Serve immediately', 'Plate gently with lemon and optional dill. The centre should be soft and moist, with flakes that separate under light pressure. Serve straight away; this low-temperature recipe is not a cook-chill storage method.',uses=['Lemon wedges','Dill'])],
 notes=[('Choosing salmon for 50 °C','Use salmon suitable for undercooked service with supplier-confirmed parasite controls. Ordinary freezer storage does not prove parasite destruction. This unpasteurized preparation is unsuitable for pregnant or immunocompromised people; choose a fully cooked option instead.'),('Firmer, pasteurized salmon','For chilled salmon, Baldwin’s fatty-fish table at <b>60 °C</b> includes both heating and bacterial reduction: 20 mm → 75 min; 25 mm → 90 min; 30 mm → 120 min. Do not apply these chilled times directly to frozen fish. Thaw in the fridge first, removing reduced-oxygen retail packaging before thawing.'),('Thickness calculator','Use the <a href="sous-vide.html#thickness">thickness calculator</a> for the same soft-salmon schedule. It keeps salmon timings separate from meat heating estimates.')],
 sources=[('ChefSteps — sous vide salmon','https://www.chefsteps.com/recipes/sous-vide-salmon'),('ChefSteps — cooking from frozen','https://www.chefsteps.com/guides-tools/you-can-cook-frozen-food-sous-vide-without-defrosting-here-s-how'),('Baldwin — fish and shellfish','https://douglasbaldwin.com/sous-vide.html#Fish_and_Shellfish'),('FDA — seafood hazards guidance','https://www.fda.gov/files/food/published/SeafoodHazardsGuide-CompleteDocument-June2022.pdf')])

fries = Recipe(
 slug='sous-vide-fries',title='Brined sous vide French fries',group='Sous vide',serves=2,
 blurb='ChefSteps-style thick fries: cook in brine, dry, par-fry, freeze, then finish hot for a crisp crust and fluffy centre.',
 yields='2 generous portions',total='~1½ h prep, plus freezing',
 intro='A home adaptation of ChefSteps’ thick-cut method, with <b>18 mm fries</b>. The freezer step comes <b>after the first fry</b>. Make the batch ahead, then fry from frozen to serve.',
 equipment=['Immersion circulator and water bath','Heat-rated sous-vide pouches for 90 °C','Scale accurate to 0.1 g','Deep heavy pot','Oil thermometer','Wire rack and tray','Mesh spider or slotted spoon'],
 ingredients=[('Potatoes',[('Peeled floury potatoes (Russet or similar)','500 g')]),('Brine',[('Water (brine)','500 g'),('Salt (brine)','7.5 g'),('Glucose syrup DE 42','5 g (or 1.25 g granulated sugar)'),('Baking soda','1.25 g')]),('Frying',[('Neutral frying oil','enough for 5–7 cm depth'),('Fine salt to finish','to taste')])],
 steps=[
  Step('Cut and bag with brine',['Cut potatoes into <b>18 mm square batons</b>. Mix all brine ingredients until dissolved.','Bag <b>500 g potatoes with 500 g prepared brine</b> in one layer; a little brine remains. Seal without crushing, or clip the open pouch mouth above the bath.'],time='~15 min',uses=['Peeled floury potatoes (Russet or similar)','Water (brine)','Salt (brine)','Glucose syrup DE 42','Baking soda']),
  Step('Cook the potatoes',['Heat the bath to <b>90 °C</b>. Submerge the potatoes and cook about <b>25 minutes</b> after temperature recovers.','A baton should be very tender through the centre but still lift intact.'],heat='90 °C bath',time='~25 min'),
  Step('Dry, then par-fry',['Drain gently onto a rack. Cool and dry until no surface water remains.','Heat oil to <b>130 °C</b>. Fry small batches about <b>8 minutes</b>, until the outside sets but stays pale. Drain on the rack. Keep the pot no more than half full.'],heat='130 °C oil',time='~30–45 min',uses=['Neutral frying oil']),
  Step('Freeze after the first fry','Cool the par-fried fries. Freeze spaced apart on the rack until solid, about <b>4 hours</b>; then transfer to an airtight freezer bag.',heat='off',time='4 h or overnight'),
  Step('Final fry from frozen','Heat oil to <b>190 °C</b>. Remove loose ice and fry small frozen batches about <b>3 minutes</b>, until golden and crisp. Drain, salt and serve immediately.',heat='190 °C oil',time='~3 min per batch',uses=['Fine salt to finish'])],
 notes=[('What the brine does','Salt seasons the potato, glucose helps browning and baking soda encourages a rougher surface. Weigh the soda carefully: too much can make the potatoes break apart or taste alkaline.'),('Sugar is not a 1:1 substitute','For this batch use <b>5 g glucose syrup or 1.25 g granulated sugar</b>, not both. The substitution follows ChefSteps’ stated ratio.'),('Different potato or thickness?','The 25-minute cook and first fry are guides for these thick batons. Check tenderness before draining. Thin fries need a different schedule; do not run them through this one unchanged.')],
 sources=[('ChefSteps — thick-cut French fries','https://www.chefsteps.com/recipes/thick-cut-french-fries')])

BATTER=[('Plain flour (batter)','100 g'),('Cornstarch (batter)','30 g'),('Ice-cold sparkling water','200 ml'),('Beaten egg','25 g (½ large egg)')]
SAUCE=[('Dashi (dipping sauce)','150 ml'),('Soy sauce (dipping sauce)','2 tbsp'),('Mirin (dipping sauce)','2 tbsp')]
BOWL='Mix the cold water and beaten egg first. Add the flour and cornstarch; stir briefly with chopsticks, leaving small lumps. Keep the bowl over ice. Make the batter only when the oil is ready.'
DIP='Simmer the dashi, soy sauce and mirin for 1 minute, then set aside as a dipping sauce (tentsuyu).'
OTHER=('Other good tempura choices','Try sweet potato or lotus root in 5–10 mm slices; kabocha in thin wedges; aubergine in thin fans; asparagus spears; shiitake caps; small maitake clusters; or fresh shiso leaves, battered on one side. Dry everything first. Roots need longer than leaves: fry separately and test the centre for tenderness.')
SOURCES=[('Kikkoman — seafood and vegetable tempura','https://www.kikkoman.eu/recipes/detail/tempura-with-seafood-and-vegetables'),('Kikkoman — vegetable tempura technique (Japanese)','https://www.kikkoman.co.jp/homecook/washoku/101/')]

shrimp=Recipe(
 slug='jumbo-shrimp-tempura',title='Jumbo shrimp tempura',group='Japanese',serves=2,
 blurb='Large, straight tail-on prawns with a light tempura coat: proper trimming, cold batter and small frying batches.',
 yields='8 large shrimp',total='~35 min',
 intro='Use <b>raw jumbo or king prawns</b>, about 30–40 g each before peeling. Straighten gently so the thickest part cooks evenly. This is a thin tempura coating, without breadcrumbs. For mushrooms, see <a href="king-oyster-tempura.html">king oyster tempura</a>.',
 equipment=['Deep heavy pot','Oil thermometer','Kitchen scissors','Chopsticks','Bowl and ice','Wire rack and tray'],
 ingredients=[('Shrimp',[('Raw jumbo shrimp, shell-on','8 (about 300 g)'),('Plain flour (dusting)','2 tbsp')]),('Batter',BATTER),('Dipping sauce',SAUCE),('To fry and serve',[('Neutral frying oil','enough for 5–7 cm depth'),('Grated daikon','2 tbsp, optional'),('Lemon wedges','2')])],
 steps=[
  Step('Prepare and straighten the shrimp',[DIP,'Thaw frozen shrimp in the fridge first. Peel, keeping the tail fan, and remove the dark vein. Trim the sharp tail tips and scrape out trapped water; pat dry.','Make <b>3 shallow cuts across the belly</b>, then gently press the prawn straighter. Do not cut through or tear the flesh. Keep chilled while the oil heats.'],time='~15 min',uses=['Raw jumbo shrimp, shell-on',*map(lambda x:x[0],SAUCE)]),
  Step('Mix cold batter; coat just before frying',[BOWL,'Heat the oil to <b>175–180 °C</b>. Dust two or three dry shrimp lightly with flour, shake off excess, then dip in batter. Let excess drip; the tail can stay bare.'],heat='175–180 °C oil',time='~5 min',uses=['Plain flour (dusting)',*map(lambda x:x[0],BATTER),'Neutral frying oil']),
  Step('Fry in small batches','Lower two or three shrimp into the oil away from you. Fry about <b>3–4 minutes</b>, turning once, until the coating is pale gold and crisp. The thickest shrimp must be opaque and pearly through the centre; a probe should read <b>63 °C</b>. Let the oil recover between batches and skim loose crumbs.',heat='175–180 °C oil',time='~3–4 min per batch'),
  Step('Drain and eat straight away','Drain briefly on a rack without piling up. Serve immediately with the dipping sauce, optional grated daikon and lemon. The shrimp should stay juicy inside its thin crisp shell of batter.',uses=['Grated daikon','Lemon wedges'])],
 notes=[('For truly huge prawns','If the peeled body is over about 2 cm thick, split it lengthwise before coating, or use smaller prawns. The displayed time is a guide; check the thickest piece instead of relying on the clock.'),('Keep the coating light','Do not whisk the batter smooth, coat the whole batch in advance or crowd the oil. Keep ice outside the batter bowl, not loose in the frying pot.'),OTHER],
 sources=[*SOURCES,('Ajinomoto — shrimp trimming and belly cuts (Japanese)','https://park.ajinomoto.co.jp/recipe/card/700928/')])

mushroom=Recipe(
 slug='king-oyster-tempura',title='King oyster mushroom tempura',group='Japanese',serves=2,
 blurb='Thin lengthwise slices of king oyster mushroom in a delicate crisp batter, with a juicy centre.',
 yields='2 portions',total='~25 min',
 intro='King oyster mushrooms are also sold as <b>eringi</b>: thick ivory stems with small tan caps. Slice them lengthwise so every piece keeps some stem and cap. For seafood, see <a href="jumbo-shrimp-tempura.html">jumbo shrimp tempura</a>.',
 equipment=['Deep heavy pot','Oil thermometer','Chopsticks','Bowl and ice','Wire rack and tray'],
 ingredients=[('Mushrooms',[('King oyster mushrooms','250 g'),('Plain flour (dusting)','2 tbsp')]),('Batter',BATTER),('Dipping sauce',SAUCE),('To fry and serve',[('Neutral frying oil','enough for 5–7 cm depth'),('Fine salt to finish','to taste'),('Lemon wedges','2')])],
 steps=[
  Step('Slice the mushrooms',[DIP,'Wipe the mushrooms clean and trim only the hard base. Cut lengthwise into <b>5 mm slices</b>. Pat dry; avoid soaking them.'],time='~5 min',uses=['King oyster mushrooms',*map(lambda x:x[0],SAUCE)]),
  Step('Mix cold batter; coat a few slices',[BOWL,'Heat oil to <b>170 °C</b>. Lightly dust a few dry slices with flour, shake off excess, dip in batter and let excess drip.'],heat='170 °C oil',time='~5 min',uses=['Plain flour (dusting)',*map(lambda x:x[0],BATTER),'Neutral frying oil']),
  Step('Fry until crisp and tender','Lower a few slices into the oil without overlapping. Fry about <b>2–3 minutes</b>, turning once, until the batter is crisp and pale gold and the mushroom is tender through the centre. Thick slices need longer. Skim loose crumbs and restore <b>170 °C</b> between batches.',heat='170 °C oil',time='~2–3 min per batch'),
  Step('Drain and serve','Drain on a rack, keeping the slices separate. Serve immediately with a little salt and lemon or the dipping sauce. The mushroom inside should be juicy, with a light crisp coating rather than a thick doughy layer.',uses=['Fine salt to finish','Lemon wedges'])],
 notes=[('Other mushrooms','Shiitake caps, small maitake clusters and oyster mushrooms also work. Keep pieces small enough to cook through while the coating stays pale.'),('Vegetarian dipping sauce','Use kombu-shiitake dashi instead of bonito dashi. The batter contains egg; this version is vegetarian with vegetable dashi, not vegan.'),OTHER],
 sources=[('Mizkan — mushroom tempura, 5 mm eringi slices (Japanese)','https://www.mizkan.co.jp/ouchirecipe/recipe/?menu_id=527'),*SOURCES])

RECIPES=[salmon,fries,shrimp,mushroom]
