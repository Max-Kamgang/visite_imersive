// Options partagées entre les formulaires de l'administration.

export const MUSEUM_TYPES = [
  'Art',
  'Histoire',
  'Sciences & Techniques',
  'Archéologie',
  'Ethnographie',
  'Histoire naturelle',
  'Autre'
]

export const VISIT_TYPES = [
  'Visite libre',
  'Visite guidée',
  'Visite guidée privée',
  'Atelier pédagogique'
]

export const CURRENCIES = ['€', '$', '£', 'FCFA']

// Un secteur peut être une salle interne ou un espace en plein air
// (ex. les cases Mousgoum reconstituées dans l'enceinte du musée).
export const SECTOR_LOCATIONS = ['Intérieur', 'Extérieur']

// Institutions partenaires auxquelles un musée peut être associé (données fédérées).
export const PARTNER_INSTITUTIONS = ['Grand Palais', 'RMN – Grand Palais', 'Musée du quai Branly']

// Relation entre un objet d'art et un individu (chef) de la généalogie.
export const OBJECT_CHEF_RELATIONS = ['possédé par', 'porté par', 'sculpté par', 'commandé par', 'offert par']

// Titres coutumiers proposés pour un individu de la généalogie.
export const GENEALOGY_TITLES = ["Sa Majesté le Fo'o", "Fo'o", 'Mafo', 'Notable', 'Prince', 'Princesse']

// Sources de la voix pour un assistant vocal (§5.1).
export const VOICE_SOURCES = [
  { label: 'Fichier importé', value: 'import' },
  { label: 'Enregistrement in-app', value: 'enregistrement' },
  { label: 'Synthèse vocale (TTS)', value: 'synthese' }
]

// Langues gérées (site + audio).
export const LANGUES = ['fr', 'en']
