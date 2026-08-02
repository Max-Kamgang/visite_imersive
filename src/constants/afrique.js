// ============================================================================
// RÉFÉRENTIEL AFRIQUE — pays et peuples / chefferies
// ----------------------------------------------------------------------------
// Sert aux listes déroulantes de la recherche d'objets frères.
// Les libellés « en » sont ceux employés par les musées pour cataloguer :
// ce sont EUX qui partent dans les requêtes, pas les libellés français.
//
// Les peuples retenus sont ceux effectivement représentés dans les collections
// muséales (art, regalia, masques) — pas un recensement ethnographique complet.
// Le Cameroun est le plus détaillé : c'est le terrain du projet.
// ============================================================================

export const PAYS_AFRIQUE = [
  {
    code: 'CM', fr: 'Cameroun', en: 'Cameroon',
    peuples: [
      { fr: 'Bamoun (Foumban)', en: 'Bamum' },
      { fr: 'Bamiléké', en: 'Bamileke' },
      { fr: 'Bandjoun', en: 'Bandjoun' },
      { fr: 'Baham', en: 'Baham' },
      { fr: 'Batcham', en: 'Batcham' },
      { fr: 'Bangwa', en: 'Bangwa' },
      { fr: 'Bafut', en: 'Bafut' },
      { fr: 'Babanki', en: 'Babanki' },
      { fr: 'Kom', en: 'Kom' },
      { fr: 'Nso’ (Nsoo)', en: 'Nso' },
      { fr: 'Tikar', en: 'Tikar' },
      { fr: 'Bali', en: 'Bali' },
      { fr: 'Widekum', en: 'Widekum' },
      { fr: 'Mambila', en: 'Mambila' },
      { fr: 'Ejagham (Ekoi)', en: 'Ejagham' },
      { fr: 'Fang', en: 'Fang' },
      { fr: 'Douala', en: 'Duala' },
      { fr: 'Bassa', en: 'Bassa' },
      { fr: 'Mafa (Matakam)', en: 'Mafa' },
      { fr: 'Peul (Foulbé)', en: 'Fulani' },
      { fr: 'Kirdi', en: 'Kirdi' }
    ]
  },
  {
    code: 'NG', fr: 'Nigeria', en: 'Nigeria',
    peuples: [
      { fr: 'Yoruba', en: 'Yoruba' }, { fr: 'Edo (Bénin)', en: 'Edo' },
      { fr: 'Royaume du Bénin', en: 'Benin Kingdom' }, { fr: 'Igbo', en: 'Igbo' },
      { fr: 'Ifé', en: 'Ife' }, { fr: 'Nok', en: 'Nok' }, { fr: 'Nupe', en: 'Nupe' },
      { fr: 'Tiv', en: 'Tiv' }, { fr: 'Ibibio', en: 'Ibibio' }, { fr: 'Ijo (Ijaw)', en: 'Ijo' },
      { fr: 'Idoma', en: 'Idoma' }, { fr: 'Urhobo', en: 'Urhobo' }, { fr: 'Jukun', en: 'Jukun' },
      { fr: 'Hausa', en: 'Hausa' }, { fr: 'Igala', en: 'Igala' }, { fr: 'Mumuye', en: 'Mumuye' }
    ]
  },
  {
    code: 'CD', fr: 'République démocratique du Congo', en: 'Democratic Republic of the Congo',
    peuples: [
      { fr: 'Kuba', en: 'Kuba' }, { fr: 'Luba', en: 'Luba' }, { fr: 'Songye', en: 'Songye' },
      { fr: 'Tchokwé', en: 'Chokwe' }, { fr: 'Pende', en: 'Pende' }, { fr: 'Yaka', en: 'Yaka' },
      { fr: 'Lega', en: 'Lega' }, { fr: 'Mangbetu', en: 'Mangbetu' }, { fr: 'Teke', en: 'Teke' },
      { fr: 'Hemba', en: 'Hemba' }, { fr: 'Kongo', en: 'Kongo' }, { fr: 'Salampasu', en: 'Salampasu' },
      { fr: 'Suku', en: 'Suku' }, { fr: 'Bembe', en: 'Bembe' }, { fr: 'Lulua', en: 'Lulua' },
      { fr: 'Lwalwa', en: 'Lwalwa' }, { fr: 'Kusu', en: 'Kusu' }, { fr: 'Zande', en: 'Zande' }
    ]
  },
  {
    code: 'ML', fr: 'Mali', en: 'Mali',
    peuples: [
      { fr: 'Dogon', en: 'Dogon' }, { fr: 'Bamana (Bambara)', en: 'Bamana' },
      { fr: 'Sénoufo', en: 'Senufo' }, { fr: 'Tellem', en: 'Tellem' },
      { fr: 'Djenné', en: 'Djenne' }, { fr: 'Marka', en: 'Marka' },
      { fr: 'Soninké', en: 'Soninke' }, { fr: 'Touareg', en: 'Tuareg' }
    ]
  },
  {
    code: 'GH', fr: 'Ghana', en: 'Ghana',
    peuples: [
      { fr: 'Ashanti (Asante)', en: 'Asante' }, { fr: 'Akan', en: 'Akan' },
      { fr: 'Fanti', en: 'Fante' }, { fr: 'Éwé', en: 'Ewe' }, { fr: 'Ga', en: 'Ga' },
      { fr: 'Dagomba', en: 'Dagomba' }
    ]
  },
  {
    code: 'CI', fr: "Côte d'Ivoire", en: "Cote d'Ivoire",
    peuples: [
      { fr: 'Baoulé', en: 'Baule' }, { fr: 'Sénoufo', en: 'Senufo' }, { fr: 'Dan', en: 'Dan' },
      { fr: 'Gouro', en: 'Guro' }, { fr: 'Yaouré', en: 'Yaure' }, { fr: 'Lobi', en: 'Lobi' },
      { fr: 'Bété', en: 'Bete' }, { fr: 'Akan', en: 'Akan' }
    ]
  },
  {
    code: 'BJ', fr: 'Bénin', en: 'Benin',
    peuples: [
      { fr: 'Fon', en: 'Fon' }, { fr: 'Yoruba', en: 'Yoruba' },
      { fr: 'Royaume du Dahomey', en: 'Dahomey' }, { fr: 'Éwé', en: 'Ewe' }
    ]
  },
  {
    code: 'BF', fr: 'Burkina Faso', en: 'Burkina Faso',
    peuples: [
      { fr: 'Mossi', en: 'Mossi' }, { fr: 'Bwa', en: 'Bwa' }, { fr: 'Bobo', en: 'Bobo' },
      { fr: 'Lobi', en: 'Lobi' }, { fr: 'Nuna', en: 'Nuna' }, { fr: 'Gurunsi', en: 'Gurunsi' }
    ]
  },
  {
    code: 'GA', fr: 'Gabon', en: 'Gabon',
    peuples: [
      { fr: 'Fang', en: 'Fang' }, { fr: 'Kota', en: 'Kota' }, { fr: 'Punu', en: 'Punu' },
      { fr: 'Tsogho', en: 'Tsogho' }, { fr: 'Kwélé', en: 'Kwele' }, { fr: 'Vuvi', en: 'Vuvi' }
    ]
  },
  {
    code: 'CG', fr: 'Congo (Brazzaville)', en: 'Republic of the Congo',
    peuples: [
      { fr: 'Teke', en: 'Teke' }, { fr: 'Kongo', en: 'Kongo' },
      { fr: 'Kuyu', en: 'Kuyu' }, { fr: 'Bembe', en: 'Bembe' }
    ]
  },
  {
    code: 'AO', fr: 'Angola', en: 'Angola',
    peuples: [
      { fr: 'Tchokwé', en: 'Chokwe' }, { fr: 'Ovimbundu', en: 'Ovimbundu' },
      { fr: 'Kongo', en: 'Kongo' }, { fr: 'Lwena', en: 'Lwena' }
    ]
  },
  {
    code: 'GN', fr: 'Guinée', en: 'Guinea',
    peuples: [
      { fr: 'Baga', en: 'Baga' }, { fr: 'Nalu', en: 'Nalu' },
      { fr: 'Kissi', en: 'Kissi' }, { fr: 'Toma', en: 'Toma' }
    ]
  },
  {
    code: 'SL', fr: 'Sierra Leone', en: 'Sierra Leone',
    peuples: [
      { fr: 'Mende', en: 'Mende' }, { fr: 'Temne', en: 'Temne' },
      { fr: 'Sherbro', en: 'Sherbro' }, { fr: 'Kissi', en: 'Kissi' }
    ]
  },
  {
    code: 'LR', fr: 'Liberia', en: 'Liberia',
    peuples: [
      { fr: 'Dan', en: 'Dan' }, { fr: 'Bassa', en: 'Bassa' },
      { fr: 'Grebo', en: 'Grebo' }, { fr: 'Kran', en: 'Kran' }
    ]
  },
  {
    code: 'SN', fr: 'Sénégal', en: 'Senegal',
    peuples: [
      { fr: 'Wolof', en: 'Wolof' }, { fr: 'Sérère', en: 'Serer' },
      { fr: 'Bassari', en: 'Bassari' }, { fr: 'Peul', en: 'Fulani' }
    ]
  },
  {
    code: 'TD', fr: 'Tchad', en: 'Chad',
    peuples: [{ fr: 'Sao', en: 'Sao' }, { fr: 'Kanem', en: 'Kanem' }, { fr: 'Peul', en: 'Fulani' }]
  },
  {
    code: 'NE', fr: 'Niger', en: 'Niger',
    peuples: [
      { fr: 'Touareg', en: 'Tuareg' }, { fr: 'Haoussa', en: 'Hausa' },
      { fr: 'Songhaï', en: 'Songhai' }, { fr: 'Djerma', en: 'Zarma' }
    ]
  },
  {
    code: 'KE', fr: 'Kenya', en: 'Kenya',
    peuples: [
      { fr: 'Maasaï', en: 'Maasai' }, { fr: 'Kikuyu', en: 'Kikuyu' },
      { fr: 'Turkana', en: 'Turkana' }, { fr: 'Samburu', en: 'Samburu' },
      { fr: 'Kamba', en: 'Kamba' }
    ]
  },
  {
    code: 'TZ', fr: 'Tanzanie', en: 'Tanzania',
    peuples: [
      { fr: 'Makondé', en: 'Makonde' }, { fr: 'Zaramo', en: 'Zaramo' },
      { fr: 'Nyamwezi', en: 'Nyamwezi' }, { fr: 'Sukuma', en: 'Sukuma' },
      { fr: 'Maasaï', en: 'Maasai' }
    ]
  },
  {
    code: 'ET', fr: 'Éthiopie', en: 'Ethiopia',
    peuples: [
      { fr: 'Amhara', en: 'Amhara' }, { fr: 'Oromo', en: 'Oromo' },
      { fr: 'Konso', en: 'Konso' }, { fr: 'Aksoum', en: 'Aksum' }
    ]
  },
  {
    code: 'ZA', fr: 'Afrique du Sud', en: 'South Africa',
    peuples: [
      { fr: 'Zoulou', en: 'Zulu' }, { fr: 'Xhosa', en: 'Xhosa' },
      { fr: 'Ndébélé', en: 'Ndebele' }, { fr: 'Sotho', en: 'Sotho' },
      { fr: 'Tsonga', en: 'Tsonga' }, { fr: 'Venda', en: 'Venda' }, { fr: 'San', en: 'San' }
    ]
  },
  {
    code: 'ZW', fr: 'Zimbabwe', en: 'Zimbabwe',
    peuples: [
      { fr: 'Shona', en: 'Shona' }, { fr: 'Ndébélé', en: 'Ndebele' },
      { fr: 'Grand Zimbabwe', en: 'Great Zimbabwe' }
    ]
  },
  {
    code: 'MZ', fr: 'Mozambique', en: 'Mozambique',
    peuples: [{ fr: 'Makondé', en: 'Makonde' }, { fr: 'Chopi', en: 'Chopi' }]
  },
  {
    code: 'MG', fr: 'Madagascar', en: 'Madagascar',
    peuples: [
      { fr: 'Merina', en: 'Merina' }, { fr: 'Sakalava', en: 'Sakalava' },
      { fr: 'Mahafaly', en: 'Mahafaly' }
    ]
  },
  {
    code: 'EG', fr: 'Égypte', en: 'Egypt',
    peuples: [
      { fr: 'Égypte ancienne', en: 'Ancient Egyptian' },
      { fr: 'Copte', en: 'Coptic' }, { fr: 'Nubien', en: 'Nubian' }
    ]
  },
  {
    code: 'SD', fr: 'Soudan', en: 'Sudan',
    peuples: [
      { fr: 'Nubien', en: 'Nubian' }, { fr: 'Dinka', en: 'Dinka' },
      { fr: 'Shilluk', en: 'Shilluk' }, { fr: 'Koush', en: 'Kush' }
    ]
  },
  {
    code: 'MA', fr: 'Maroc', en: 'Morocco',
    peuples: [{ fr: 'Berbère (Amazigh)', en: 'Berber' }, { fr: 'Rif', en: 'Rif' }]
  },
  {
    code: 'DZ', fr: 'Algérie', en: 'Algeria',
    peuples: [{ fr: 'Berbère (Amazigh)', en: 'Berber' }, { fr: 'Kabyle', en: 'Kabyle' }]
  },
  {
    code: 'UG', fr: 'Ouganda', en: 'Uganda',
    peuples: [{ fr: 'Ganda', en: 'Ganda' }, { fr: 'Nyoro', en: 'Nyoro' }]
  }
].sort((a, b) => a.fr.localeCompare(b.fr, 'fr'))

// Peuples d'un pays donné (par son libellé anglais), triés.
export function peuplesDuPays(paysEn) {
  const p = PAYS_AFRIQUE.find((x) => x.en === paysEn)
  return p ? [...p.peuples].sort((a, b) => a.fr.localeCompare(b.fr, 'fr')) : []
}
