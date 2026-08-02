<script setup>
import { computed } from 'vue'
import { regnesOrdonnes, nomComplet } from '@/services/genealogy'

// FRISE DES RÈGNES — la chefferie vue dans le temps.
//
// L'arbre répond à « qui descend de qui ». Il ne répond pas à « depuis quand »
// ni « combien de temps ». Or c'est la durée qui frappe : voir six règnes
// s'enchaîner sur deux siècles dit l'ancienneté de l'institution mieux qu'un
// paragraphe. D'où cette bande, en complément et non en remplacement.

const props = defineProps({
  people: { type: Array, default: () => [] },
  focusId: { type: [Number, String], default: null }
})
const emit = defineEmits(['focus'])

const regnes = computed(() => regnesOrdonnes(props.people))

// Bornes de la frise, arrondies à la décennie pour que la graduation tombe juste.
const bornes = computed(() => {
  if (!regnes.value.length) return null
  const debut = Math.floor(Math.min(...regnes.value.map((r) => r.debut)) / 10) * 10
  const fin = Math.ceil(Math.max(...regnes.value.map((r) => r.fin)) / 10) * 10
  return { debut, fin, etendue: Math.max(1, fin - debut) }
})

const graduations = computed(() => {
  if (!bornes.value) return []
  const { debut, fin, etendue } = bornes.value
  // Un pas adapté à l'étendue : cinquante ans sur deux siècles, dix ans sur trente.
  const pas = etendue > 400 ? 100 : etendue > 150 ? 50 : etendue > 60 ? 25 : 10
  const out = []
  for (let a = debut; a <= fin; a += pas) out.push({ annee: a, pct: ((a - debut) / etendue) * 100 })
  return out
})

function position(r) {
  const { debut, etendue } = bornes.value
  const gauche = ((r.debut - debut) / etendue) * 100
  const largeur = Math.max(1.6, ((r.fin - r.debut) / etendue) * 100)
  return { left: `${gauche}%`, width: `${Math.min(100 - gauche, largeur)}%` }
}

const duree = (r) => Math.max(0, r.fin - r.debut)
</script>

<template>
  <div v-if="bornes" class="frise">
    <div class="frise__head">
      <h3>{{ $t('genealogy.timelineTitle') }}</h3>
      <span class="frise__span">
        {{ $t('genealogy.timelineSpan', { from: bornes.debut, to: bornes.fin, n: regnes.length }) }}
      </span>
    </div>

    <div class="frise__zone">
      <div class="frise__axe">
        <span v-for="g in graduations" :key="g.annee" class="frise__tick" :style="{ left: `${g.pct}%` }">
          <i />
          <em>{{ g.annee }}</em>
        </span>
      </div>

      <ol class="frise__pistes">
        <li v-for="r in regnes" :key="r.id" class="frise__ligne">
          <button
            type="button"
            class="frise__regne"
            :class="{ on: r.id === focusId, est: r.finEstimee }"
            :style="position(r)"
            :title="$t('genealogy.timelineTip', { name: nomComplet(r), from: r.debut, to: r.fin, n: duree(r) })"
            @click="emit('focus', r.id)"
          >
            <span class="frise__nom">{{ nomComplet(r) }}</span>
          </button>
        </li>
      </ol>
    </div>

    <p class="frise__note"><i class="pi pi-info-circle" /> {{ $t('genealogy.timelineNote') }}</p>
  </div>
</template>

<style scoped>
.frise { border: 1px solid #e8e9e6; border-radius: 14px; background: #fff; padding: 1.1rem 1.3rem 1rem; }
.frise__head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
.frise__head h3 {
  font-family: 'Anton', 'Inter', sans-serif; font-weight: 400; text-transform: uppercase;
  font-size: 1.15rem; letter-spacing: 0.01em; margin: 0; color: #101210;
}
.frise__span { font-size: 0.8rem; color: #7c817b; font-variant-numeric: tabular-nums; }

.frise__zone { position: relative; }
.frise__axe { position: relative; height: 22px; border-bottom: 1px solid #e8e9e6; margin-bottom: 0.5rem; }
.frise__tick { position: absolute; top: 0; transform: translateX(-50%); text-align: center; }
.frise__tick i { display: block; width: 1px; height: 7px; background: #d5d8d3; margin: 12px auto 0; }
.frise__tick em {
  font-style: normal; font-size: 0.68rem; color: #9aa09a;
  font-variant-numeric: tabular-nums; position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
}

.frise__pistes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
.frise__ligne { position: relative; height: 30px; }
.frise__regne {
  position: absolute; top: 0; height: 100%;
  display: flex; align-items: center; padding: 0 0.6rem;
  border: none; border-radius: 6px; cursor: pointer; overflow: hidden;
  background: color-mix(in srgb, var(--site-primary, #0e6f5c) 16%, #fff);
  border-left: 3px solid var(--site-primary, #0e6f5c);
  font-family: inherit; transition: 0.15s;
}
.frise__regne:hover { background: color-mix(in srgb, var(--site-primary, #0e6f5c) 28%, #fff); }
.frise__regne.on { background: var(--gold, #c9a227); border-left-color: #8a6d12; }
/* Hachures discrètes : la fin du règne est déduite du suivant, pas documentée. */
.frise__regne.est::after {
  content: ''; position: absolute; inset: 0 0 0 auto; width: 26px;
  background: repeating-linear-gradient(45deg, transparent 0 3px, rgba(0, 0, 0, 0.07) 3px 6px);
}
.frise__nom {
  font-size: 0.76rem; font-weight: 700; color: #16241d;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.frise__regne.on .frise__nom { color: #14140f; }

.frise__note { margin: 0.9rem 0 0; font-size: 0.74rem; color: #9aa09a; display: flex; align-items: center; gap: 0.35rem; }
.frise__note i { color: var(--gold, #c9a227); }
</style>
