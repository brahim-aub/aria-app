import { BODY_PART_LABEL, EQUIPMENT_LABEL, EXERCISE_LIST, EXERCISES } from '@/data/exercises';
import { DAY_LONG, defaultDays, generateTemplates, GOAL_LABEL, LEVEL_LABEL } from '@/data/generator';
import { moveSessionIn } from '@/store/AppStore';
import type { AppData, BodyPart, MealItem, MealPlan, NutritionPrefs, Profile, SessionExercise, WorkoutSession } from '@/store/types';

import { addDays, dateKey, formatKey } from './date';
import { AiAuth, generateJSON, GeminiContent } from './gemini';
import { DIET_LABEL, energyTargets, JOB_LABEL } from './nutrition';
import { euro, storeTotals } from './prices';
import { getRange } from './schedule';
import { estimateMinutes, newId, prescriptionLabel } from './workout';

// ───────── Schéma de réponse ─────────

const BODY_PARTS = Object.keys(BODY_PART_LABEL);
const EQUIPMENTS = Object.keys(EQUIPMENT_LABEL);

const sessionSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    focus: { type: 'string' },
    format: { type: 'string', enum: ['sets', 'circuit'] },
    warmup: { type: 'boolean' },
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string' },
          sets: { type: 'integer' },
          reps: { type: 'integer' },
          seconds: { type: 'integer' },
          restSec: { type: 'integer' },
          weightKg: { type: 'number' },
        },
        required: ['exerciseId', 'sets', 'restSec'],
      },
    },
  },
  required: ['title', 'exercises'],
};

const COACH_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Message au sportif, en français, tutoiement, court.' },
    quickReplies: { type: 'array', items: { type: 'string' }, description: '0 à 3 réponses rapides que le sportif pourrait taper ensuite.' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'replace_session',
              'skip_session',
              'move_session',
              'restore_session',
              'add_limitation',
              'remove_limitation',
              'update_profile',
              'regenerate_plan',
              'create_custom_session',
              'set_nutrition_prefs',
              'generate_meal_plan',
              'edit_meal_plan',
              'project_weight',
              'search_prices',
              'log_weight',
            ],
          },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          toDate: { type: 'string', description: 'YYYY-MM-DD' },
          reason: { type: 'string' },
          session: sessionSchema,
          bodyPart: { type: 'string', enum: BODY_PARTS },
          note: { type: 'string' },
          endDate: { type: 'string', description: 'YYYY-MM-DD' },
          limitationId: { type: 'string' },
          profile: {
            type: 'object',
            properties: {
              sessionsPerWeek: { type: 'integer' },
              sessionMinutes: { type: 'integer' },
              trainingDays: { type: 'array', items: { type: 'integer' } },
              equipment: { type: 'array', items: { type: 'string', enum: EQUIPMENTS } },
              place: { type: 'string', enum: ['maison', 'salle', 'exterieur'] },
              goal: { type: 'string', enum: Object.keys(GOAL_LABEL) },
              level: { type: 'string', enum: Object.keys(LEVEL_LABEL) },
              weightKg: { type: 'number' },
              job: { type: 'string', enum: ['assis', 'debout', 'physique'] },
            },
          },
          nutritionPrefs: {
            type: 'object',
            properties: {
              diet: { type: 'string', enum: Object.keys(DIET_LABEL) },
              likes: { type: 'string' },
              dislikes: { type: 'string' },
              allergies: { type: 'string' },
              mealsPerDay: { type: 'integer' },
              cookingTime: { type: 'string', enum: ['rapide', 'moyen', 'long'] },
              budget: { type: 'string', enum: ['serre', 'moyen', 'large'] },
              weeklyBudget: { type: 'number', description: 'Budget courses max en €/semaine, 0 = sans limite' },
              stores: { type: 'array', items: { type: 'string' }, description: 'Magasins où l’utilisateur fait ses courses (3 max)' },
            },
          },
          mealInstructions: { type: 'string' },
          weightKg: { type: 'number' },
          kcal: { type: 'integer', description: 'project_weight : kcal mangées par jour (omis = moyenne du plan de repas)' },
          weeks: { type: 'integer', description: 'project_weight : durée en semaines (4 = 1 mois)' },
        },
        required: ['type'],
      },
    },
  },
  required: ['reply', 'actions'],
};

export type CoachAction = {
  type: string;
  date?: string;
  toDate?: string;
  reason?: string;
  session?: { title: string; focus?: string; format?: 'sets' | 'circuit'; warmup?: boolean; exercises: SessionExercise[] };
  bodyPart?: string;
  note?: string;
  endDate?: string;
  limitationId?: string;
  profile?: Partial<Profile>;
  nutritionPrefs?: Partial<NutritionPrefs>;
  mealInstructions?: string;
  weightKg?: number;
  kcal?: number;
  weeks?: number;
};

export type CoachResponse = { reply: string; quickReplies?: string[]; actions: CoachAction[] };

// ───────── Contexte envoyé au modèle ─────────

function describeProfile(d: AppData) {
  const p = d.profile;
  return [
    `Prénom : ${p.name || 'inconnu'} · ${p.sex} · ${p.age} ans · ${p.heightCm} cm · ${p.weightKg} kg`,
    `Objectif : ${GOAL_LABEL[p.goal]} · Niveau : ${LEVEL_LABEL[p.level]} · Pratique avant l'app : ${p.history}`,
    `Lieu : ${p.place} · Matériel : ${p.equipment.length ? p.equipment.map((e) => EQUIPMENT_LABEL[e]).join(', ') : 'aucun (poids du corps)'}`,
    `Rythme : ${p.sessionsPerWeek} séances/semaine de ${p.sessionMinutes} min, les ${p.trainingDays.map((i) => DAY_LONG[i]).join(', ')}`,
    `Travail : ${JOB_LABEL[p.job]}`,
  ].join('\n');
}

function describeSession(s: WorkoutSession) {
  return `« ${s.title} » (~${estimateMinutes(s)} min, ${s.format === 'circuit' ? 'circuit' : 'séries'}) : ${s.exercises
    .map((e) => `${e.exerciseId} ${prescriptionLabel(e)}`)
    .join(', ')}`;
}

function describeSchedule(d: AppData) {
  const today = dateKey();
  return getRange(d, addDays(today, -3), 17)
    .filter((day) => day.session || day.log)
    .map((day) => {
      const label = `${day.date} (${formatKey(day.date, { weekday: 'long' })})${day.date === today ? " = AUJOURD'HUI" : ''}`;
      const status = { planned: 'prévue', done: 'FAITE', skipped: 'annulée/décalée', missed: 'manquée', rest: 'repos' }[day.status];
      const extra = [day.modified ? `modifiée${day.reason ? ` (${day.reason})` : ''}` : '', day.adaptations.length ? `auto-adaptée douleur: ${day.adaptations.join('; ')}` : '']
        .filter(Boolean)
        .join(' · ');
      return `- ${label} [${status}] ${day.session ? describeSession(day.session) : day.log?.title ?? ''}${extra ? ` — ${extra}` : ''}`;
    })
    .join('\n');
}

function describeCatalog() {
  return EXERCISE_LIST.filter((e) => e.category !== 'warmup')
    .map((e) => `${e.id} | ${e.name} | ${e.muscles.join(',')} | ${e.equipment.join('+') || 'aucun'} | ${e.stresses.join(',') || '-'} | ${e.mode} | niv${e.level}`)
    .join('\n');
}

export function buildSystemPrompt(d: AppData) {
  const today = dateKey();
  const t = energyTargets(d);
  const lims = d.limitations.filter((l) => l.endDate >= today);
  const prefs = d.nutrition.prefs;
  const recent = d.logs
    .slice(0, 5)
    .map((l) => `- ${l.date.slice(0, 10)} ${l.title}, ${l.durationMin} min, difficulté ${l.difficulty}/5, énergie ${l.energy}/5${l.note ? `, note : ${l.note}` : ''}`)
    .join('\n');

  return `Tu es « Aria », le coach sportif et nutritionnel personnel intégré à l'app Aria Sport. Tu parles français, tu tutoies, tu es chaleureux, motivant et concret. Tes réponses sont courtes (2 à 6 phrases, listes à puces si utile), lisibles sur téléphone, avec 1 emoji maximum. Beaucoup d'utilisateurs débutent : explique simplement, sans jargon.

TON RÔLE : tu peux MODIFIER l'app directement via le champ "actions" (le planning, le profil, les douleurs, la nutrition). Quand l'utilisateur demande un changement, FAIS-LE avec les actions puis confirme en une phrase ce que tu as changé. Ne dis jamais que tu as modifié quelque chose sans l'action correspondante. Si la demande est ambiguë, pose UNE question courte et ne fais aucune action.

CATALOGUE D'EXERCICES (id | nom | muscles | matériel requis | articulations sollicitées | mode reps/time | niveau)
${describeCatalog()}

ACTIONS DISPONIBLES
- replace_session {date, session, reason} : remplace la séance d'un jour (ou en crée une un jour de repos). Utilise UNIQUEMENT des exerciseId du catalogue. Mode "reps" → renseigne reps ; mode "time" → renseigne seconds. restSec entre 15 et 180. session.warmup=true sauf si très peu de temps.
- skip_session {date, reason} : annule la séance d'un jour.
- move_session {date, toDate, reason} : décale une séance (l'app décale en cascade si le jour cible est occupé).
- restore_session {date} : remet la séance d'origine du programme.
- add_limitation {bodyPart, note, endDate} : enregistre une douleur/blessure jusqu'à endDate (par défaut 14 jours).
- remove_limitation {limitationId} : la douleur est terminée.
- update_profile {profile} : change durablement matériel, lieu, objectif, niveau, rythme, jours (0=lundi…6=dimanche), durée, poids, travail. Le programme est régénéré automatiquement si besoin.
- regenerate_plan : reconstruit tout le programme à partir du profil.
- create_custom_session {session} : enregistre une séance dans « Mes séances » sans la planifier.
- set_nutrition_prefs {nutritionPrefs} : enregistre goûts, dégoûts, allergies, régime, nb de repas, temps de cuisine, budget.
- search_prices : obtient les prix indicatifs des ingrédients du plan de repas dans les magasins choisis (stores). Ne donne JAMAIS de prix toi-même : c'est l'app qui les cherche.
- edit_meal_plan {mealInstructions} : MODIFIE le plan de repas EXISTANT sans le refaire : remplacer un aliment, changer un repas, enlever un ingrédient. Tout le reste du plan reste identique. mealInstructions = la modification précise (ex. « remplace les flocons d'avoine par du pain complet »).
- project_weight {kcal, weeks} : projette l'évolution du poids si l'utilisateur mange kcal par jour pendant weeks semaines (« si je mange comme ça pendant 1 mois, mon poids ? »). Sans kcal, l'app prend la moyenne de son plan de repas. NE calcule JAMAIS toi-même une évolution de poids : lance cette action, l'app répond avec le calcul.
- generate_meal_plan {mealInstructions} : lance la création d'un plan de repas sur 7 jours (fais-le seulement si les préférences sont connues ; sinon pose d'abord 2-3 questions sur les goûts).
- log_weight {weightKg} : enregistre une pesée.

RÈGLES
- « J'ai que X minutes » → replace_session du jour avec une version raccourcie qui garde les mêmes muscles (moins de séries/exercices, repos plus courts) tenant en X minutes échauffement compris.
- « Pas de matériel / pas accès à la salle aujourd'hui » → replace_session du jour avec des exercices sans matériel ciblant les mêmes muscles.
- « La séance ne me plaît pas » → propose une alternative différente (replace_session) et demande ce qui ne lui plaisait pas si ce n'est pas clair.
- « Pas le temps, décale à demain » → move_session.
- Douleur → add_limitation (zone + durée) et conseille de consulter un professionnel si la douleur est vive, persistante ou suite à un choc. Tu n'es pas médecin : pas de diagnostic.
- Changement durable (« je vais maintenant à la salle », « je veux 4 séances ») → update_profile.
- Ne change jamais une séance déjà FAITE. Ne touche qu'aux dates demandées.
- Reste prudent avec les débutants : volumes modestes, techniques simples.
- Prix et budget : n'invente ni n'estime aucun prix. Pour connaître le coût des repas, enregistre les magasins (set_nutrition_prefs.stores) si besoin puis utilise search_prices. Si l'utilisateur donne un budget, enregistre weeklyBudget puis lance generate_meal_plan, puis search_prices.
- Plan de repas : si un plan existe et que l'utilisateur veut juste changer un aliment ou un repas, utilise edit_meal_plan (jamais generate_meal_plan, qui refait tout). Si c'est un aliment qu'il n'aime pas, ajoute-le aussi à ses dégoûts avec set_nutrition_prefs (dislikes = anciens dégoûts + le nouveau). N'utilise generate_meal_plan que s'il demande de tout refaire.
- Ta réponse annonce ce que tu lances (« je modifie tes menus »), jamais le résultat : c'est l'app qui exécute ensuite et confirme. Ne dis donc jamais « c'est fait » ni un montant pour une action nutrition que tu viens de lancer.
- Nutrition : reste cohérent avec les besoins calculés, pas de régimes extrêmes (jamais sous le métabolisme de base), oriente vers un professionnel en cas de pathologie ou de trouble alimentaire.
- quickReplies : suggestions courtes et utiles (ex. « Merci ! », « Et pour demain ? »).

# SITUATION ACTUELLE DE L'UTILISATEUR
(Tout ce qui précède est fixe ; ce qui suit change à chaque message. Cet ordre permet à Gemini de réutiliser la partie fixe en cache.)

Date du jour : ${today} (${formatKey(today, { weekday: 'long' })}).

PROFIL
${describeProfile(d)}

DOULEURS / LIMITATIONS ACTIVES
${lims.length ? lims.map((l) => `- id=${l.id} : ${BODY_PART_LABEL[l.bodyPart]} jusqu'au ${l.endDate} (${l.note})`).join('\n') : 'aucune'}
(L'app remplace AUTOMATIQUEMENT tous les exercices qui sollicitent une zone douloureuse dans les séances concernées. Pour une douleur, utilise add_limitation : inutile de réécrire chaque séance.)

PLANNING (de J-3 à J+13)
${describeSchedule(d) || 'aucune séance'}

DERNIÈRES SÉANCES
${recent || 'aucune pour le moment'}

NUTRITION
Besoins calculés par l'app : ${t.target} kcal/jour (métabolisme ${t.bmr}, quotidien ${t.daily}, sport ~${t.trainingPerDay}/jour), protéines ${t.proteinG} g, glucides ${t.carbsG} g, lipides ${t.fatG} g.
Préférences ${d.nutrition.prefsSet ? 'renseignées' : 'PAS ENCORE renseignées'} : régime ${DIET_LABEL[prefs.diet]}, aime « ${prefs.likes || '?'} », n'aime pas « ${prefs.dislikes || '?'} », allergies « ${prefs.allergies || 'aucune'} », ${prefs.mealsPerDay} repas/jour, temps de cuisine ${prefs.cookingTime}, budget ${prefs.budget}${prefs.weeklyBudget ? ` (max ${prefs.weeklyBudget} €/semaine)` : ''}, magasins : ${prefs.stores?.length ? prefs.stores.join(', ') : 'pas encore choisis'}.
Plan de repas actuel : ${describeMealPlan(d)}.
Pesées : ${d.weights.length ? d.weights.slice(-4).map((w) => `${w.date.slice(0, 10)} ${w.kg} kg`).join(', ') : 'aucune'}.`;
}

function describeMealPlan(d: AppData) {
  const plan = d.nutrition.plan;
  if (!plan) return 'aucun';
  const check = d.nutrition.priceCheck;
  let cost = '';
  if (check && check.planCreatedAt === plan.createdAt) {
    const totals = storeTotals(check)
      .map((t) => `${t.store} ${euro(t.basket)} (${t.found}/${t.total} produits trouvés)`)
      .join(', ');
    cost = `. Prix indicatifs relevés le ${check.searchedAt.slice(0, 10)}, ticket de caisse de la semaine : ${totals}`;
  }
  return `oui (créé le ${plan.createdAt.slice(0, 10)}, ${plan.targetKcal} kcal${cost})`;
}

// ───────── Appel ─────────

export async function askCoach(d: AppData, ai: AiAuth, userText: string): Promise<CoachResponse> {
  const history: GeminiContent[] = d.chat
    .filter((m) => !m.error && m.text.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
  const lastTurn = history[history.length - 1];
  // Le message de l'utilisateur est en général déjà dans l'historique (sauf appel direct).
  if (!(lastTurn?.role === 'user' && lastTurn.parts[0].text === userText)) history.push({ role: 'user', parts: [{ text: userText }] });
  // Gemini veut un premier tour "user".
  while (history.length && history[0].role !== 'user') history.shift();
  const res = await generateJSON<CoachResponse>({
    ...ai,
    kind: 'chat',
    system: buildSystemPrompt(d),
    contents: history,
    schema: COACH_SCHEMA,
    temperature: 0.6,
  });
  return { reply: String(res.reply ?? '').trim(), quickReplies: (res.quickReplies ?? []).slice(0, 3), actions: Array.isArray(res.actions) ? res.actions : [] };
}

// ───────── Application des actions ─────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string | undefined, fallback: string) => (s && DATE_RE.test(s) ? s : fallback);
const clamp = (v: number | undefined, min: number, max: number, def: number) => Math.min(max, Math.max(min, Math.round(Number.isFinite(v as number) ? (v as number) : def)));
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

function resolveExerciseId(id: string) {
  if (EXERCISES[id]) return id;
  const n = norm(id);
  return EXERCISE_LIST.find((e) => norm(e.id) === n || norm(e.name) === n)?.id;
}

function toSession(raw: NonNullable<CoachAction['session']>, source: WorkoutSession['source']): WorkoutSession | undefined {
  const exercises: SessionExercise[] = [];
  for (const e of raw.exercises ?? []) {
    const id = resolveExerciseId(String(e.exerciseId ?? ''));
    if (!id) continue;
    const ex = EXERCISES[id];
    exercises.push({
      exerciseId: id,
      sets: clamp(e.sets, 1, 10, 3),
      reps: ex.mode === 'reps' ? clamp(e.reps, 1, 100, 10) : undefined,
      seconds: ex.mode === 'time' ? clamp(e.seconds, 5, 3600, 30) : undefined,
      restSec: clamp(e.restSec, 10, 300, 45),
      weightKg: ex.loaded && e.weightKg ? Math.max(0, Number(e.weightKg)) : undefined,
    });
  }
  if (!exercises.length) return undefined;
  return {
    id: newId(),
    title: String(raw.title || 'Séance du coach').slice(0, 60),
    focus: raw.focus,
    format: raw.format === 'circuit' ? 'circuit' : 'sets',
    warmup: raw.warmup !== false,
    cooldown: true,
    exercises,
    source,
  };
}

const PLAN_FIELDS: (keyof Profile)[] = ['sessionsPerWeek', 'sessionMinutes', 'trainingDays', 'equipment', 'place', 'goal', 'level'];

export type ApplyResult = { data: AppData; changes: string[]; mealInstructions?: string; searchPrices: boolean; adaptations: number; nutritionOnly: boolean };

export function applyActions(d0: AppData, actions: CoachAction[]): ApplyResult {
  let d = d0;
  const today = dateKey();
  const changes: string[] = [];
  let mealInstructions: string | undefined;
  let adaptations = 0;
  let touchedTraining = false;
  let searchPricesRequested = false;
  const short = (k: string) => formatKey(k, { weekday: 'long', day: 'numeric', month: 'short' });
  const tomorrow = addDays(today, 1);
  const ofDay = (k: string) => (k === today ? "d'aujourd'hui" : k === tomorrow ? 'de demain' : `du ${short(k)}`);
  const toDay = (k: string) => (k === today ? "à aujourd'hui" : k === tomorrow ? 'à demain' : `au ${short(k)}`);

  for (const a of actions) {
    if (!['set_nutrition_prefs', 'generate_meal_plan', 'search_prices', 'log_weight'].includes(a.type)) touchedTraining = true;
    switch (a.type) {
      case 'replace_session': {
        const date = validDate(a.date, today);
        if (d.logs.some((l) => l.scheduledDate === date) || !a.session) break;
        const s = toSession(a.session, 'ai');
        if (!s) break;
        d = { ...d, overrides: { ...d.overrides, [date]: { kind: 'replace', session: s, reason: a.reason } } };
        changes.push(`Séance ${ofDay(date)} remplacée : ${s.title} (~${estimateMinutes(s)} min)`);
        adaptations++;
        break;
      }
      case 'skip_session': {
        const date = validDate(a.date, today);
        // Une séance déjà faite ne s'annule pas.
        if (d.logs.some((l) => l.scheduledDate === date)) break;
        d = { ...d, overrides: { ...d.overrides, [date]: { kind: 'skip', reason: a.reason } } };
        changes.push(`Séance ${ofDay(date)} annulée`);
        adaptations++;
        break;
      }
      case 'move_session': {
        const from = validDate(a.date, today);
        const to = validDate(a.toDate, addDays(from, 1));
        // Ni séance déjà faite, ni décalage dans le passé.
        if (d.logs.some((l) => l.scheduledDate === from) || to < today) break;
        const before = d;
        d = moveSessionIn(d, from, to, a.reason);
        if (d !== before) {
          changes.push(`Séance ${ofDay(from)} décalée ${toDay(to)}`);
          adaptations++;
        }
        break;
      }
      case 'restore_session': {
        const date = validDate(a.date, today);
        const overrides = { ...d.overrides };
        delete overrides[date];
        d = { ...d, overrides };
        changes.push(`Séance d'origine rétablie (${short(date)})`);
        break;
      }
      case 'add_limitation': {
        if (!a.bodyPart || !BODY_PARTS.includes(a.bodyPart)) break;
        // Entre demain et 3 mois : au-delà, mieux vaut consulter et refaire le point.
        const wanted = validDate(a.endDate, addDays(today, 14));
        const endDate = wanted < addDays(today, 1) ? addDays(today, 1) : wanted > addDays(today, 90) ? addDays(today, 90) : wanted;
        d = {
          ...d,
          limitations: [...d.limitations, { id: newId(), bodyPart: a.bodyPart as BodyPart, note: a.note || 'Douleur signalée au coach', startDate: today, endDate }],
        };
        changes.push(`${BODY_PART_LABEL[a.bodyPart]} ménagé jusqu'au ${formatKey(endDate, { day: 'numeric', month: 'long' })} : exercices adaptés`);
        adaptations++;
        break;
      }
      case 'remove_limitation': {
        const l = d.limitations.find((x) => x.id === a.limitationId);
        if (!l) break;
        d = { ...d, limitations: d.limitations.filter((x) => x.id !== l.id) };
        changes.push(`${BODY_PART_LABEL[l.bodyPart]} : plus de restriction`);
        break;
      }
      case 'update_profile': {
        if (!a.profile) break;
        const patch: Partial<Profile> = {};
        const p = a.profile;
        if (p.sessionsPerWeek) patch.sessionsPerWeek = clamp(p.sessionsPerWeek, 1, 7, 3);
        if (p.sessionMinutes) patch.sessionMinutes = clamp(p.sessionMinutes, 5, 120, 30);
        if (Array.isArray(p.trainingDays) && p.trainingDays.length)
          patch.trainingDays = [...new Set(p.trainingDays.map((x) => clamp(x, 0, 6, 0)))].sort();
        if (Array.isArray(p.equipment)) patch.equipment = p.equipment.filter((x) => EQUIPMENTS.includes(x));
        if (p.place) patch.place = p.place;
        if (p.goal && p.goal in GOAL_LABEL) patch.goal = p.goal;
        if (p.level && p.level in LEVEL_LABEL) patch.level = p.level;
        if (p.job) patch.job = p.job;
        if (p.weightKg) patch.weightKg = Math.round(Number(p.weightKg) * 10) / 10;
        const profile: Profile = { ...d.profile, ...patch };
        // Les jours d'entraînement restent cohérents avec la fréquence.
        if (patch.trainingDays) profile.sessionsPerWeek = patch.trainingDays.length;
        else if (profile.trainingDays.length !== profile.sessionsPerWeek) profile.trainingDays = defaultDays(profile.sessionsPerWeek);
        const regen = PLAN_FIELDS.some((f) => JSON.stringify(profile[f]) !== JSON.stringify(d.profile[f]));
        d = { ...d, profile };
        if (regen) d = regenerate(d);
        changes.push(regen ? 'Profil mis à jour et programme reconstruit' : 'Profil mis à jour');
        adaptations++;
        break;
      }
      case 'regenerate_plan': {
        d = regenerate(d);
        changes.push('Programme reconstruit');
        adaptations++;
        break;
      }
      case 'create_custom_session': {
        if (!a.session) break;
        const s = toSession(a.session, 'custom');
        if (!s) break;
        d = { ...d, customSessions: [s, ...d.customSessions], counters: { ...d.counters, customCreated: d.counters.customCreated + 1 } };
        changes.push(`Séance « ${s.title} » ajoutée à Mes séances`);
        break;
      }
      case 'set_nutrition_prefs': {
        if (!a.nutritionPrefs) break;
        const n = a.nutritionPrefs;
        const prefs = { ...d.nutrition.prefs };
        if (n.diet && n.diet in DIET_LABEL) prefs.diet = n.diet;
        if (typeof n.likes === 'string') prefs.likes = n.likes;
        if (typeof n.dislikes === 'string') prefs.dislikes = n.dislikes;
        if (typeof n.allergies === 'string') prefs.allergies = n.allergies;
        if (n.mealsPerDay) prefs.mealsPerDay = clamp(n.mealsPerDay, 2, 6, 3);
        if (n.cookingTime) prefs.cookingTime = n.cookingTime;
        if (n.budget) prefs.budget = n.budget;
        if (typeof n.weeklyBudget === 'number' && n.weeklyBudget >= 0) prefs.weeklyBudget = Math.round(n.weeklyBudget);
        if (Array.isArray(n.stores) && n.stores.length) prefs.stores = n.stores.map((x) => String(x).trim()).filter(Boolean).slice(0, 3);
        d = { ...d, nutrition: { ...d.nutrition, prefs, prefsSet: true } };
        changes.push('Préférences alimentaires enregistrées');
        break;
      }
      case 'generate_meal_plan':
        mealInstructions = a.mealInstructions || '';
        break;
      case 'search_prices':
        searchPricesRequested = true;
        break;
      case 'log_weight': {
        const kg = Number(a.weightKg);
        if (!(kg > 25 && kg < 350)) break;
        d = { ...d, weights: [...d.weights, { id: newId(), date: new Date().toISOString(), kg }], profile: { ...d.profile, weightKg: kg } };
        changes.push(`Pesée enregistrée : ${kg} kg`);
        break;
      }
    }
  }
  return { data: d, changes, mealInstructions, searchPrices: searchPricesRequested, adaptations, nutritionOnly: !touchedTraining };
}

function regenerate(d: AppData): AppData {
  const today = dateKey();
  return {
    ...d,
    plan: { startDate: today, templates: generateTemplates(d.profile) },
    overrides: Object.fromEntries(Object.entries(d.overrides).filter(([k]) => k < today)),
  };
}

// ───────── Plan de repas ─────────

const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    targetKcal: { type: 'integer' },
    proteinG: { type: 'integer' },
    carbsG: { type: 'integer' },
    fatG: { type: 'integer' },
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'string' },
          kcal: { type: 'integer' },
          meals: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                time: { type: 'string' },
                kcal: { type: 'integer' },
                proteinG: { type: 'integer' },
                recipe: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      food: { type: 'string' },
                      qty: { type: 'string' },
                      kcal: { type: 'integer' },
                      grams: { type: 'integer', description: 'Poids consommé en grammes (ml pour les liquides)' },
                      search: { type: 'string', description: 'Nom précis du produit en rayon, sans marque ni quantité (ex. fromage blanc 0%)' },
                    },
                    required: ['food', 'qty', 'kcal', 'grams', 'search'],
                  },
                },
              },
              required: ['name', 'kcal', 'items'],
            },
          },
        },
        required: ['day', 'kcal', 'meals'],
      },
    },
    groceries: { type: 'array', items: { type: 'string' } },
    tips: { type: 'array', items: { type: 'string' } },
  },
  required: ['targetKcal', 'proteinG', 'carbsG', 'fatG', 'days', 'groceries', 'tips'],
};

export async function generateMealPlan(d: AppData, ai: AiAuth, instructions = '', priceInfo = ''): Promise<MealPlan> {
  const t = energyTargets(d);
  const p = d.profile;
  const prefs = d.nutrition.prefs;
  const today = dateKey();
  const days = getRange(d, today, 7).map((day) => {
    const name = formatKey(day.date, { weekday: 'long' });
    return `${name} : ${day.session && day.status !== 'skipped' ? `séance « ${day.session.title} » (~${estimateMinutes(day.session)} min)` : 'repos'}`;
  });
  const system = `Tu es un nutritionniste du sport bienveillant. Tu crées des plans de repas simples, réalistes, en français (tu tutoies l'utilisateur, y compris dans les conseils), avec des aliments trouvables en supermarché en France. Quantités en grammes ou en unités usuelles. Recettes en 1 à 2 phrases. Pour CHAQUE aliment, donne aussi : grams (poids réellement consommé, en g ou ml) et search (nom PRÉCIS du produit tel qu'il est vendu en rayon, sans marque ni quantité : « fromage blanc 0% », « pâtes complètes », « blanc de poulet », « lait demi-écrémé » — ce nom sert à chercher son prix en magasin). Ne donne aucun prix. Les kcal doivent être réalistes et la somme d'une journée proche de la cible (±5 %), un peu plus les jours d'entraînement et un peu moins les jours de repos.`;
  const user = `Crée mon plan de repas pour les 7 prochains jours (en commençant par ${formatKey(today, { weekday: 'long' })}).
Profil : ${p.sex}, ${p.age} ans, ${p.heightCm} cm, ${p.weightKg} kg. Objectif : ${GOAL_LABEL[p.goal]}. Travail : ${JOB_LABEL[p.job]}.
Cible moyenne : ${t.target} kcal/jour, protéines ${t.proteinG} g, glucides ${t.carbsG} g, lipides ${t.fatG} g.
Semaine d'entraînement : ${days.join(' ; ')}.
Régime : ${DIET_LABEL[prefs.diet]}. J'aime : ${prefs.likes || 'pas précisé'}. Je n'aime pas : ${prefs.dislikes || 'rien de spécial'}. Allergies/intolérances : ${prefs.allergies || 'aucune'}.
${prefs.mealsPerDay} repas par jour (collations comprises). Temps de cuisine : ${prefs.cookingTime}. Budget : ${prefs.budget}${prefs.weeklyBudget ? `, maximum ${prefs.weeklyBudget} € pour la nourriture mangée dans la semaine (privilégie des aliments économiques)` : ''}.${prefs.stores?.length ? ` Courses chez : ${prefs.stores.join(', ')} (choisis des produits qu'on y trouve).` : ''}
${priceInfo ? `${priceInfo}
` : ''}${instructions ? `Demande particulière : ${instructions}` : ''}
Ajoute une liste de courses regroupée (max 30 lignes) et 3 à 5 conseils courts.`;
  const res = await generateJSON<Omit<MealPlan, 'createdAt'>>({
    ...ai,
    kind: 'meal',
    system,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    schema: MEAL_SCHEMA,
    timeoutMs: 120000,
    temperature: 0.8,
  });
  if (!Array.isArray(res.days) || !res.days.length) throw new Error('Plan de repas vide');
  return {
    createdAt: new Date().toISOString(),
    targetKcal: res.targetKcal || t.target,
    proteinG: res.proteinG || t.proteinG,
    carbsG: res.carbsG || t.carbsG,
    fatG: res.fatG || t.fatG,
    days: res.days.map((day) => ({
      day: day.day,
      kcal: day.kcal || (day.meals ?? []).reduce((s, m) => s + (m.kcal || 0), 0),
      meals: (day.meals ?? []).map((m) => ({ ...m, items: m.items ?? [] })),
    })),
    groceries: res.groceries ?? [],
    tips: res.tips ?? [],
  };
}

/**
 * Modifie le plan de repas existant sans le refaire : le modèle ne renvoie que les repas changés
 * (jour + position), le reste du plan est conservé tel quel.
 */
export async function editMealPlan(d: AppData, ai: AiAuth, instruction: string): Promise<{ plan: MealPlan; changed: number }> {
  const plan = d.nutrition.plan;
  if (!plan) throw new Error('Il n’y a pas encore de plan de repas à modifier.');
  const prefs = d.nutrition.prefs;
  const listing = plan.days
    .map((day, di) => `[jour ${di}] ${day.day}\n` + day.meals.map((m, mi) => `  [repas ${mi}] ${m.name} (${m.kcal} kcal) : ${m.items.map((it) => `${it.food} ${it.qty}`).join(', ')}`).join('\n'))
    .join('\n');
  const system = `Tu modifies un plan de repas existant en français. Ne change QUE les repas concernés par la demande ; tous les autres restent intacts. Garde environ les mêmes kcal et protéines pour chaque repas modifié. Pour chaque aliment, donne food, qty, kcal, grams et search (nom précis du produit en rayon, sans marque). Ne donne aucun prix.`;
  const user = `Plan actuel :
${listing}

Régime : ${DIET_LABEL[prefs.diet]}. Je n'aime pas : ${prefs.dislikes || 'rien de spécial'}. Allergies : ${prefs.allergies || 'aucune'}.
Modification demandée : ${instruction}
Renvoie uniquement les repas modifiés (day = numéro de jour, meal = numéro du repas) et la liste de courses complète mise à jour.`;
  const res = await generateJSON<{ edits: { day: number; meal: number; name: string; kcal: number; proteinG?: number; recipe?: string; items: MealItem[] }[]; groceries?: string[] }>({
    ...ai,
    kind: 'meal',
    system,
    contents: [{ role: 'user', parts: [{ text: user }] }],
    schema: {
      type: 'object',
      properties: {
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              day: { type: 'integer' },
              meal: { type: 'integer' },
              name: { type: 'string' },
              kcal: { type: 'integer' },
              proteinG: { type: 'integer' },
              recipe: { type: 'string' },
              items: MEAL_SCHEMA.properties.days.items.properties.meals.items.properties.items,
            },
            required: ['day', 'meal', 'name', 'kcal', 'items'],
          },
        },
        groceries: { type: 'array', items: { type: 'string' } },
      },
      required: ['edits'],
    },
    timeoutMs: 90000,
    temperature: 0.5,
  });
  const days = plan.days.map((day) => ({ ...day, meals: [...day.meals] }));
  let changed = 0;
  for (const e of res.edits ?? []) {
    const day = days[e.day];
    if (!day || !day.meals[e.meal] || !Array.isArray(e.items) || !e.items.length) continue;
    const old = day.meals[e.meal];
    day.meals[e.meal] = { ...old, name: e.name || old.name, kcal: e.kcal || old.kcal, proteinG: e.proteinG ?? old.proteinG, recipe: e.recipe ?? old.recipe, items: e.items };
    day.kcal = day.meals.reduce((s, m) => s + (m.kcal || 0), 0);
    changed++;
  }
  if (!changed) throw new Error('Je n’ai trouvé aucun repas à modifier.');
  return { plan: { ...plan, createdAt: new Date().toISOString(), days, groceries: res.groceries?.length ? res.groceries : plan.groceries }, changed };
}
