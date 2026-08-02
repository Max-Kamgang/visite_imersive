<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ask } from '@/services/guideAgent'

const { t } = useI18n()
const router = useRouter()
const open = ref(false)
const input = ref('')
const busy = ref(false)
const listRef = ref()
const messages = ref([
  { from: 'bot', text: t('guideChat.hello'), links: [] }
])

const suggestions = computed(() => [t('guideChat.sug1'), t('guideChat.sug2'), t('guideChat.sug3')])

async function scrollDown() {
  await nextTick()
  if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
}

async function send(text) {
  const q = (text ?? input.value).trim()
  if (!q || busy.value) return
  messages.value.push({ from: 'me', text: q, links: [] })
  input.value = ''
  busy.value = true
  await scrollDown()
  try {
    const r = await ask(q)
    const links = r.links || []
    messages.value.push({ from: 'bot', text: r.text, links })
    // Redirection directe : une seule destination trouvée → on y emmène l'utilisateur
    // (petit délai pour laisser lire la réponse). Les liens restent cliquables sinon.
    if (links.length === 1) {
      setTimeout(() => { open.value = false; router.push(links[0].to) }, 1400)
    }
  } catch (e) {
    messages.value.push({ from: 'bot', text: t('common.error'), links: [] })
  } finally {
    busy.value = false
    await scrollDown()
  }
}
</script>

<template>
  <div class="guide">
    <transition name="pop">
      <div v-if="open" class="guide__panel">
        <header class="guide__head">
          <span><i class="pi pi-sparkles" /> {{ $t('guideChat.title') }}</span>
          <button :aria-label="$t('common.close')" @click="open = false"><i class="pi pi-times" /></button>
        </header>

        <div ref="listRef" class="guide__msgs">
          <div v-for="(m, i) in messages" :key="i" class="msg" :class="`msg--${m.from}`">
            <p>{{ m.text }}</p>
            <div v-if="m.links?.length" class="msg__links">
              <router-link v-for="(l, j) in m.links" :key="j" :to="l.to" class="msg__link" @click="open = false">
                {{ l.label }} <i class="pi pi-arrow-right" />
              </router-link>
            </div>
          </div>
          <div v-if="busy" class="msg msg--bot"><p class="typing">…</p></div>
        </div>

        <div v-if="messages.length <= 1" class="guide__sugg">
          <button v-for="s in suggestions" :key="s" @click="send(s)">{{ s }}</button>
        </div>

        <form class="guide__input" @submit.prevent="send()">
          <input v-model="input" type="text" :placeholder="$t('guideChat.placeholder')" :disabled="busy" />
          <button type="submit" :disabled="busy || !input.trim()" :aria-label="$t('common.send')"><i class="pi pi-send" /></button>
        </form>
      </div>
    </transition>

    <button class="guide__bubble" :class="{ 'guide__bubble--open': open }" @click="open = !open" :aria-label="$t('guideChat.title')">
      <i :class="open ? 'pi pi-chevron-down' : 'pi pi-comments'" />
      <span v-if="!open" class="guide__bubble-txt">{{ $t('guideChat.help') }}</span>
    </button>
  </div>
</template>

<style scoped>
.guide { position: fixed; right: 20px; bottom: 20px; z-index: 200; display: flex; flex-direction: column; align-items: flex-end; gap: 0.75rem; }
.guide__bubble {
  display: inline-flex; align-items: center; gap: 0.5rem;
  background: var(--site-primary, #a86b2d); color: #fff; border: none; cursor: pointer;
  padding: 0.8rem 1.1rem; border-radius: 999px; font-weight: 700; font-size: 0.9rem;
  box-shadow: 0 10px 30px -8px rgba(62,42,22,0.5);
}
.guide__bubble--open { padding: 0.9rem; }
.guide__bubble-txt { white-space: nowrap; }
.guide__panel {
  width: min(360px, calc(100vw - 40px)); height: 460px; background: #fff;
  border: 1px solid #e7ddcf; border-radius: 18px; overflow: hidden;
  display: flex; flex-direction: column; box-shadow: 0 24px 60px -20px rgba(62,42,22,0.5);
}
.guide__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.8rem 1rem; background: linear-gradient(135deg, #5d3a1c, #3d2611); color: #fff;
  font-family: 'Fraunces', Georgia, serif;
}
.guide__head button { background: transparent; border: none; color: #efe5d6; cursor: pointer; font-size: 1rem; }
.guide__msgs { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; background: #faf7f2; }
.msg { max-width: 88%; }
.msg p { margin: 0; padding: 0.6rem 0.8rem; border-radius: 12px; font-size: 0.9rem; line-height: 1.45; }
.msg--bot { align-self: flex-start; }
.msg--bot p { background: #fff; border: 1px solid #e7ddcf; color: #2b2620; }
.msg--me { align-self: flex-end; }
.msg--me p { background: var(--site-primary, #a86b2d); color: #fff; }
.msg__links { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.4rem; }
.msg__link { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; font-weight: 700; color: var(--site-primary, #a86b2d); }
.typing { letter-spacing: 0.2em; }
.guide__sugg { display: flex; flex-wrap: wrap; gap: 0.4rem; padding: 0 0.8rem 0.6rem; background: #faf7f2; }
.guide__sugg button { background: #fff; border: 1px solid #e7ddcf; border-radius: 999px; padding: 0.35rem 0.7rem; font-size: 0.78rem; cursor: pointer; color: #4b4034; }
.guide__sugg button:hover { border-color: var(--site-primary, #a86b2d); }
.guide__input { display: flex; gap: 0.5rem; padding: 0.7rem; border-top: 1px solid #e7ddcf; background: #fff; }
.guide__input input { flex: 1; border: 1px solid #e7ddcf; border-radius: 10px; padding: 0.55rem 0.7rem; outline: none; font-family: inherit; }
.guide__input button { background: var(--site-primary, #a86b2d); color: #fff; border: none; border-radius: 10px; width: 42px; cursor: pointer; }
.guide__input button:disabled { opacity: 0.5; cursor: default; }
.pop-enter-active, .pop-leave-active { transition: transform 0.18s ease, opacity 0.18s ease; transform-origin: bottom right; }
.pop-enter-from, .pop-leave-to { transform: scale(0.85); opacity: 0; }
</style>
