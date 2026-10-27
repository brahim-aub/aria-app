const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');const path=require('node:path');const vm=require('node:vm');const ts=require('typescript');
function load(file, imports={}, globals={}){const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInNewContext('(function(require,module,exports){'+code+'\n})',{URL,console,setTimeout,clearTimeout,AbortController,Response,Date,...globals})(id=>{if(!(id in imports))throw Error('Unexpected import '+id);return imports[id];},m,m.exports);return m.exports;}
const {singleFlight}=load('singleFlight.ts');
test('les appels simultanés sont mutualisés, puis les résultats et erreurs libèrent la clé',async()=>{
 const flight=singleFlight();let calls=0;let release;const wait=new Promise(r=>{release=r;});
 const work=async()=>{calls++;await wait;return 42;};const a=flight('account1',work),b=flight('account1',work);assert.equal(a,b);release();assert.equal(await a,42);assert.equal(calls,1);
 await flight('account1',work);assert.equal(calls,2);
 await assert.rejects(flight('err',async()=>{throw Error('down');}));assert.equal(await flight('err',async()=>7),7);
});
function gemini(fetch){return load('gemini.ts',{'./singleFlight':{singleFlight},'./supabase':{supabase:null}},{fetch});}
test('le coût distingue les tokens cachés et applique la date de fin du tarif Flash',()=>{
 const {costOf}=gemini();const u={model:'gemini-3.8-flash',tokensIn:1000,tokensCached:800,tokensOut:100};
 assert.ok(Math.abs(costOf(u,new Date('2026-10-27'))-0.000585)<1e-10);
 assert.ok(Math.abs(costOf(u,new Date('2027-01-02'))-0.00117)<1e-10);
 assert.ok(costOf({...u,tokensCached:5000},new Date('2026-10-27'))>=0);
});
test('deux appels Gemini identiques utilisent une réponse, sans partager deux clés personnelles',async()=>{
 let calls=0;const g=gemini(async()=>{calls++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}],usageMetadata:{promptTokenCount:20,cachedContentTokenCount:10,candidatesTokenCount:2}}));});
 let events=0;g.setUsageListener(()=>events++);
 const opts={kind:'chat',system:'s',schema:{type:'object'},contents:[{role:'user',parts:[{text:'hello'}]}],apiKey:'key-a',personalKey:true};
 const result=await Promise.all([g.generateJSON(opts),g.generateJSON(opts)]);assert.equal(calls,1);assert.equal(events,1);assert.equal(result[0].ok,true);
 await Promise.all([g.generateJSON(opts),g.generateJSON({...opts,apiKey:'key-b'})]);assert.equal(calls,3);
});
test('une réponse vide facturable reste comptée, et une réponse rejouée ne compte pas deux fois',async()=>{
 let events=[];const g=gemini(async()=>new Response(JSON.stringify({usageMetadata:{promptTokenCount:20,thoughtsTokenCount:4},error:{message:'limit',code:'OUTPUT_LIMIT'}}),{status:502}));g.setUsageListener(e=>events.push(e));
 const opts={kind:'chat',system:'s',schema:{},contents:[{role:'user',parts:[{text:'hi'}]}],apiKey:'k'};
 await assert.rejects(g.generateJSON(opts));assert.equal(events.length,1);assert.equal(events[0].tokensOut,4);
 const replay=gemini(async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:20}}),{headers:{'x-ai-replayed':'1'}}));replay.setUsageListener(()=>{throw Error('double count');});await replay.generateJSON(opts);
});
function coach(generateJSON){return load('coach.ts',{'@/data/exercises':{BODY_PART_LABEL:{},EQUIPMENT_LABEL:{},EXERCISE_LIST:[],EXERCISES:{}},'@/data/generator':{GOAL_LABEL:{},LEVEL_LABEL:{}},'@/store/AppStore':{},'./date':{},'./gemini':{generateJSON},'./nutrition':{DIET_LABEL:{}},'./prices':{},'./schedule':{},'./workout':{}});}
test('le contexte nutritionnel ciblé garde le contexte complet pour les douleurs, le sport et les suivis ambigus',()=>{
 const {nutritionContextOnly}=coach();const d={chat:[]};assert.equal(nutritionContextOnly(d,'Change mon repas du midi'),true);
 for(const t of ['Adapte ma séance et mes repas','J’ai une douleur après mon repas','Oui','Et demain ?','Je veux prendre du muscle et changer mes menus'])assert.equal(nutritionContextOnly(d,t),false,t);
 assert.equal(nutritionContextOnly({chat:[{role:'user',text:'J’ai une blessure'}]},'Change mon menu'),false);
});
test('les courses sont recalculées à partir des repas, avec unités conservées et décimales françaises',()=>{
 const {shoppingList}=coach();const items=[{food:'Riz',qty:'100 g'},{food:'riz',qty:'50g'},{food:'Lait',qty:'0,5 l'},{food:'Lait',qty:'250 ml'},{food:'Sel',qty:'une pincée'}];
 const list=shoppingList([{meals:[{items}]}]);assert.ok(list.includes('Riz · 150 g'));assert.ok(list.includes('Lait · 0,5 l + 250 ml'));assert.ok(list.includes('Sel · une pincée'));
});


test('modifier un repas conserve les autres, les allergies sont transmises et les courses sont calculées localement',async()=>{
 let captured;
 const c=coach(async opts=>{captured=opts;return {edits:[{day:0,meal:0,name:'Déjeuner',kcal:550,items:[{food:'Pâtes',qty:'100 g',kcal:350}]}]};});
 const unchanged={name:'Dîner',kcal:450,items:[{food:'Riz',qty:'80 g',kcal:250}]};
 const original={createdAt:'2026-10-01',days:[{day:'lundi',kcal:950,meals:[{name:'Déjeuner',kcal:500,items:[{food:'Riz',qty:'100 g'}]},unchanged]}],groceries:['ancienne liste']};
 const data={nutrition:{prefs:{diet:'omnivore',dislikes:'chou',allergies:'arachides'},plan:original}};
 const result=await c.editMealPlan(data,{},'Change le déjeuner');
 assert.equal(result.changed,1);assert.equal(result.plan.days[0].meals[1],unchanged);assert.equal(original.days[0].meals[0].kcal,500);
 assert.ok(captured.contents[0].parts[0].text.includes('arachides'));assert.equal(captured.schema.properties.groceries,undefined);
 assert.ok(result.plan.groceries.includes('Pâtes · 100 g'));assert.ok(result.plan.groceries.includes('Riz · 80 g'));
});
test('un délai dépassé ne déclenche pas une seconde génération sur un autre modèle',async()=>{
 let calls=0;const g=gemini(async()=>{calls++;const error=new Error('abort');error.name='AbortError';throw error;});
 await assert.rejects(g.generateJSON({kind:'chat',system:'s',schema:{},contents:[{role:'user',parts:[{text:'hi'}]}],apiKey:'k'}));assert.equal(calls,1);
});
