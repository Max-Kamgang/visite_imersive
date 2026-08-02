import { ref } from 'vue'

// Singleton partagé : reflète l'état du thème (clair / sombre).
const isDark = ref(document.documentElement.classList.contains('app-dark'))

export function useTheme() {
  function toggle() {
    isDark.value = !isDark.value
    document.documentElement.classList.toggle('app-dark', isDark.value)
    localStorage.setItem('vi-theme', isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggle }
}
