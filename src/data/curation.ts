/*
 * Ce pune planul implicit: feluri pe care le recunoști după nume. Rețetele de mai jos rămân în aplicație
 * (le găsești la Rețete), dar intră în plan doar dacă alegi bucătăria lor. Lista e făcută de mână, rețetă cu rețetă.
 */
export const NOT_FAMILIAR = new Set<string>(["burger_kofta_pita", "er_lahmacun", "er_pastitsio", "fasole_usturoi_lamaie", "koshari", "linte_tahini", "ll_galuste_slovacesti_reteta_traditionala_a", "ll_salata_mimoza_reteta_festiva_de_salata_i", "ll_salata_panzanella_salata_italiana_de_ros", "ll_salata_tabbouleh_cu_sau_fara_bulgur_cu_v", "mdb_52767", "mdb_52769", "mdb_52786", "mdb_52804", "mdb_52817", "mdb_52836", "mdb_52838", "mdb_52840", "mdb_52859", "mdb_52862", "mdb_52878", "mdb_52880", "mdb_52881", "mdb_52884", "mdb_52886", "mdb_52888", "mdb_52889", "mdb_52898", "mdb_52899", "mdb_52906", "mdb_52911", "mdb_52924", "mdb_52926", "mdb_52933", "mdb_52939", "mdb_52942", "mdb_52967", "mdb_52979", "mdb_52987", "mdb_52988", "mdb_52991", "mdb_52992", "mdb_53005", "mdb_53017", "mdb_53029", "mdb_53035", "mdb_53036", "mdb_53040", "mdb_53042", "mdb_53043", "mdb_53045", "mdb_53046", "mdb_53052", "mdb_53056", "mdb_53063", "mdb_53093", "mdb_53098", "mdb_53102", "mdb_53103", "mdb_53104", "mdb_53109", "mdb_53116", "mdb_53117", "mdb_53119", "mdb_53122", "mdb_53123", "mdb_53124", "mdb_53127", "mdb_53128", "mdb_53129", "mdb_53130", "mdb_53131", "mdb_53133", "mdb_53148", "mdb_53149", "mdb_53154", "mdb_53162", "mdb_53163", "mdb_53165", "mdb_53169", "mdb_53170", "mdb_53171", "mdb_53174", "mdb_53181", "mdb_53183", "mdb_53186", "mdb_53221", "mdb_53225", "mdb_53253", "mdb_53260", "mdb_53274", "mdb_53276", "mdb_53277", "mdb_53278", "mdb_53292", "mdb_53314", "mdb_53324", "mdb_53335", "mdb_53336", "mdb_53340", "mdb_53341", "mdb_53342", "mdb_53343", "mdb_53350", "mdb_53381", "mdb_53382", "mdb_53385", "mdb_53387", "mdb_53391", "mdb_53392", "mdb_53393", "mdb_53394", "mdb_53395", "mdb_53404", "mdb_53405", "mdb_53407", "mdb_53409", "mdb_53410", "mdb_53414", "mdb_53445", "mdb_53459", "mdb_53463", "mdb_53464", "mdb_53466", "mdb_53467", "mdb_53470", "mdb_53485", "mdb_53517", "mdb_53519", "mdb_53520", "mdb_53551", "pita_falafel", "pui_piri_piri", "salata_cuscus_vinete", "tajine_miel", "tajine_pui_cartofi_dulci", "ut_anzac_biscuits", "ut_bacalhau_a_bras", "ut_ballokume", "ut_begova_corba", "ut_bitterballen", "ut_bosanski_lonac", "ut_butter_tarts", "ut_byrek_me_spinaq", "ut_cachapas", "ut_carbonade_flamande", "ut_cepelinai", "ut_chiles_en_nogada", "ut_clam_chowder", "ut_fabada_asturiana", "ut_farikal", "ut_fergese", "ut_flia", "ut_frango_piri_piri", "ut_fritule", "ut_indio_viejo", "ut_iskender_kebab", "ut_jota", "ut_judd_mat_gaardebounen", "ut_kaesespaetzle", "ut_kama", "ut_kanelbullar", "ut_kapustnica", "ut_key_lime_pie", "ut_kjotsupa", "ut_kohuke", "ut_kranjska_klobasa", "ut_kugelis", "ut_kulajda", "ut_lamingtons", "ut_leche_flan", "ut_lohikeitto", "ut_mangu", "ut_mercimek_corbasi", "ut_mole_poblano", "ut_moules_marinieres", "ut_mulgipuder", "ut_pastel_de_nata", "ut_pastizzi", "ut_patatas_bravas", "ut_pierogi_ruskie", "ut_potica", "ut_risalamande", "ut_risotto_alla_milanese", "ut_roast_beef_yorkshire", "ut_rolex_uganda", "ut_sakotis", "ut_saltibarsciai", "ut_sauerbraten", "ut_sernik", "ut_shepherds_pie", "ut_silpancho", "ut_sklandrausis", "ut_skolebrod", "ut_sladke_buchty", "ut_sticky_toffee_pudding", "ut_svickova", "ut_tave_elbasani", "ut_tave_kosi", "ut_tourtiere", "ut_trdelnik", "ut_vepro_knedlo_zelo", "ut_vigoron", "ut_zagorski_strukli", "vinete_linte_tahini", "vinete_naut_nuci"]);

/** nume pe înțelesul tuturor (fără cuvinte străine pe care nu le știe nimeni) */
export const PLAIN_NAME: Record<string, string> = {
 "baba_ganoush": "Salată de vinete cu tahini și lipie",
 "mdb_52929": "Gogoșele mici",
 "ll_liptauer_pasta_aperitiv_din_branza_condi": "Pastă de brânză cu boia și ceapă",
 "ll_spatzle_sau_noknedli_galuscute_servite_c": "Gălușcuțe de casă",
 "ll_povitica_cozonac_cu_foarte_multa_nuca_re": "Cozonac cu multă nucă",
 "mdb_53100": "Prăjiturele cu afine și lămâie",
 "mdb_52901": "Prăjiturele cu stafide",
 "mdb_52902": "Prăjitură cu ovăz și ghimbir",
 "mdb_52932": "Prăjitură cu sirop la cuptor",
 "er_rosti": "Turtă de cartofi rași",
 "mdb_52931": "Tartă cu zahăr",
 "ut_menemen": "Ouă cu roșii și ardei la tigaie",
 "er_shakshouka_cu_carne_de_miel": "Ouă în sos de roșii cu carne tocată",
 "ll_bab_gulyas": "Gulaș cu fasole",
 "ll_bogracs_gulyas": "Gulaș la ceaun",
 "ll_fasole_scazuta_de_post_la_cuptor_reteta": "Fasole albă scăzută la cuptor",
 "ll_mancare_de_vara_cu_ardei_peperonata": "Mâncare de ardei cu roșii",
 "ll_kleftiko_de_miel_reteta_greceasca_a_cele": "Miel la cuptor în hârtie, cu cartofi",
 "ut_koettbullar": "Chiftele suedeze cu sos cremos",
 "er_pelmeni": "Colțunași cu carne (pelmeni)",
 "er_tocanita_ungureasca_porkolt": "Tocăniță ungurească de porc",
 "ll_supa_de_rosii_cu_paste_de_casa_tarhana": "Supă de roșii cu paste de casă",
 "ll_tarator_supa_rece_cu_castraveti_si_ustur": "Supă rece de castraveți cu iaurt",
 "ll_lucskos_reteta_ungureasca_de_zama_de_var": "Zamă de varză murată cu afumătură",
 "ll_taitei_cu_cartofi_grenadiermarsch_reteta": "Tăiței cu cartofi și cârnați",
 "ut_schweinshaxe": "Ciolan de porc la cuptor",
 "ll_smora_coapta_sau_kaiserschmarrn_reteta_d": "Șmoră (clătită ruptă, din Banat)",
 "bigos": "Varză murată cu carne și cârnați",
 "er_sarmale_sparte": "Sarmale sparte",
 "gazpacho": "Supă rece de roșii (gazpacho)",
 "ll_gazpacho_reteta_de_supa_rece_ideala_in_v": "Supă rece de roșii cu legume",
 "pui_ardei_rosii": "Pui cu ardei și roșii"
};

/** linte, năut, bulgur, quinoa, tahini, cușcuș: bune, dar nu de bază în bucătăria de acasă; apar mai rar */
export const LESS_COMMON_INGREDIENTS = new Set(['linte', 'linte_verde', 'naut', 'bulgur', 'quinoa', 'tahini', 'cuscus', 'lapte_cocos', 'tofu']);

/** aceleași valori ca în planner (CUISINE_FAM), pentru rețetele fără `familiar` */
export const CUISINE_DEFAULT: Record<string, number> = { ro: 1, it: 0.9, eu: 0.85, med: 0.8, us: 0.65, mx: 0.5, or: 0.55, as: 0.45, in: 0.45 };

/** feluri care se mănâncă lângă altceva, nu ca gustare: rămân la Rețete, dar planul nu le pune la gustare */
export const SIDE_DISH = /^(Piure|Cartofi |Gălușcuțe|Legume rădăcinoase|Conopidă la cuptor|Felii de conopidă|Dovlecei pane|Spanac|Crochete de cartofi|Turtă de cartofi|Roșii provensale|Porumb cu|Bastonașe de dovlecei|Ciuperci gratinate|Ciuperci cu brânză|Broccoli cu iaurt|Tocinei|Nokedli|Lipii cu ceapă|Plăcinte pe lespede|Vinete coapte|Iaurt cu spanac)/;

/** mic dejunuri pe care le aștepți cu drag (planul le preferă dimineața) */
export const BREAKFAST_FAVORITES = new Set<string>([
  'toast_avocado_ou', 'ou_fiert_avocado', 'tartine_avocado_post', 'll_oua_coapte_in_avocado', 'oua_posate_somon', 'paine_prajita_ou',
  'omleta_legume', 'omleta_ciuperci', 'omleta_frantuzeasca', 'omleta_cuptor_legume', 'omleta_cartofi_carnati', 'll_omleta_cu_sunca', 'll_omleta_cu_legume',
  'ochiuri_rosii', 'jumari_ceapa_verde', 'shakshuka_feta', 'clatite_americane', 'pancakes_banana', 'mini_clatite_pufoase',
  'clatite_branza', 'clatite_gem', 'll_clatite_simple_reteta_video_pas_cu_pas', 'sandvis_cald_sunca', 'mamaliga_branza', 'tortilla_spaniola', 'll_placinte_la_tigaie_cu_branza_si_verdetur',
  'iaurt_banana_arahide', 'overnight_oats', 'bruschete_rosii', 'er_toast_cu_ricotta_si_lamaie', 'tartine_ricotta_pere',
]);

/** doar primăvara (urzici, lobodă, leurdă, ștevie) */
export const SPRING_ONLY = /urzic|lobod|leurd|ștevie|stevie/i;
