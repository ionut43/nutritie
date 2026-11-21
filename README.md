# Nutriție

Plan de mese pe săptămână, listă de cumpărături, cămară și calorii. Merge pe iPhone și Android, din același cod (Expo / React Native). Toate datele rămân pe telefon, fără cont și fără server.

---

## Instalare pe Android (gratuit)

1. Copiază `Nutritie.apk` pe telefon (sau descarcă-l din GitHub → Releases).
2. Deschide fișierul și permite „Instalare din surse necunoscute” când ți se cere.
3. Versiunile noi se instalează peste cea veche și datele rămân, pentru că toate sunt semnate cu aceeași cheie.

## Pe iPhone fără nimic instalat (varianta web)

1. O singură dată: pe GitHub, în repo, *Settings → Pages → Source: GitHub Actions*. Apoi *Actions → Aplicația web → Run workflow*. După asta se publică singură la fiecare schimbare.
2. Pe iPhone deschide în **Safari** `https://<cont>.github.io/<repo>/`, apasă **Partajează → Adaugă pe ecranul principal** și deschide-o de acolo.
3. Se deschide pe tot ecranul, ca o aplicație. Datele rămân pe telefon (în memoria Safari a aplicației).

Are aceleași funcții ca aplicația instalată: recunoașterea mâncării din poză (același model, în WebAssembly), citirea bonurilor și a etichetelor (Tesseract), codurile de bare, blocarea cu Face ID (passkey local), backup automat săptămânal. Prețurile reale vin din Monitorul Prețurilor prin GitHub, în fiecare luni. Singura diferență: fără notificări când expiră ceva în cămară (în aplicație vezi oricum ce expiră).

## Instalare pe iPhone (gratuit, fără Mac)

Apple nu permite instalarea gratuită direct dintr-un fișier, așa că sunt doi pași. Ambii sunt gratuiți.

### Pasul 1: GitHub compilează aplicația (o singură dată, apoi la fiecare actualizare)

1. Fă-ți cont gratuit pe github.com și creează un repository **privat** numit `nutritie`.
2. Instalează **GitHub Desktop** pe laptop, clonează repository-ul și copiază în el tot conținutul acestui folder. Nu copia fișierul `CHEI-ANDROID.txt`. Apoi apasă *Commit* și *Push*.
3. Pe github.com: **Settings → Secrets and variables → Actions → New repository secret**. Adaugă cele două valori din `CHEI-ANDROID.txt`:
   - `ANDROID_KEYSTORE_BASE64`
   - `ANDROID_KEYSTORE_PASSWORD`
4. **Actions → Construiește aplicația → Run workflow**. După aproximativ 30–40 de minute, în **Releases** apar `Nutritie.ipa` (iPhone) și `Nutritie.apk` (Android).

> Un repository privat are inclus gratuit timp de build suficient pentru 5–6 build-uri de iPhone pe lună. Unul public nu are limită, iar codul nu conține date personale.

### Pasul 2: instalezi pe iPhone cu Sideloadly (Windows)

1. Instalează **iTunes** și **iCloud** de pe site-ul Apple (varianta „.exe”, nu cea din Microsoft Store), apoi **Sideloadly** de pe sideloadly.io.
2. Conectează iPhone-ul prin cablu și apasă „Ai încredere” pe telefon.
3. Deschide Sideloadly, trage `Nutritie.ipa` în fereastră, scrie Apple ID-ul tău și apasă **Start**.
4. Pe iPhone:
   - **Configurări → General → VPN și gestionare dispozitive** → apasă pe Apple ID-ul tău → *Ai încredere*.
   - **Configurări → Confidențialitate și securitate → Mod dezvoltator → Pornit** (telefonul repornește).

### Fără grija celor 7 zile: SideStore (recomandat)

Cu un Apple ID gratuit, Apple lasă aplicația să meargă 7 zile, apoi trebuie re-semnată. Sideloadly o reînnoiește doar când laptopul e pornit și pe același Wi-Fi. **SideStore** o reînnoiește direct de pe iPhone, fără laptop după prima instalare. E tot gratuit.

O singură dată, cu laptopul:
1. **Înainte de orice:** în aplicație, *Profil → Fă backup* și salvează fișierul (iCloud Drive sau Fișiere). SideStore instalează aplicația ca una nouă, iar backup-ul îți aduce datele înapoi.
2. Pe laptop: iTunes (varianta de pe site-ul Apple, nu din Microsoft Store) și **iLoader** de pe iloader.app.
3. Conectează iPhone-ul prin cablu, deschide iLoader, intră cu Apple ID-ul și alege **Install SideStore**. iLoader pune singur și fișierul de asociere (pairing file).
4. Pe iPhone: *Configurări → General → VPN și gestionare dispozitive* → Apple ID-ul tău → *Ai încredere*, apoi pornește *Mod dezvoltator* dacă ți se cere.
5. Instalează din App Store aplicația VPN locală cerută de SideStore (**LocalDevVPN** / StosVPN) și pornește-o o dată. Nu trimite trafic nicăieri, e doar pe telefon.
6. În SideStore: **+** → alege `Nutritie.ipa` (descărcat din GitHub Releases în Fișiere). Deschide aplicația, *Profil → Restaurează backup*.

Reînnoirea automată:
- Aplicația **Scurtături** → *Automatizare* → *Ora din zi* (ex. 3:00, zilnic) → acțiunea SideStore **Refresh Apps**, cu *Rulează imediat* și fără notificare.
- Rulează scurtătura o dată de mână, ca să-i dai permisiunea. De atunci reînnoiește singură, cât timp telefonul are Wi-Fi.

Versiunile noi: în SideStore, **+** → noul `Nutritie.ipa`. Se instalează peste cea veche și datele rămân.

### Varianta simplă: Sideloadly

- În Sideloadly bifează *Automatic refresh*. Cât timp laptopul e pornit și pe același Wi-Fi, reînnoiește singur.
- Sau repeți pasul 3 cu același fișier înainte să treacă cele 7 zile.

**Datele nu se pierd** când reinstalezi peste aplicația existentă, cu aceeași unealtă. Chiar dacă trec cele 7 zile, aplicația doar nu se mai deschide până o reînnoiești. Singura regulă: **nu o șterge de pe telefon**. Pentru siguranță în plus, *Profil → Fă backup*.

**Securitate:**
- Sideloadly semnează aplicația pe laptopul tău, iar Apple ID-ul e trimis doar către Apple. Poți folosi și un Apple ID separat.
- Aplicația nu are server și nu trimite datele nicăieri.
- Singurele conexiuni la internet sunt:
  - căutarea codului de bare în Open Food Facts;
  - descărcarea, o singură dată, a modelului de recunoaștere a pozelor de pe Hugging Face.
- Pozele cu farfuria, etichetele și bonurile se procesează pe telefon.

---

## Ce face

| | |
|---|---|
| 🔥 Calorii | Mifflin-St Jeor sau Katch-McArdle (cu % grăsime). Activitatea se calculează separat: job + pași + sport (zile, minute, tip). Țintă de greutate cu dată estimată. Limite de siguranță, sarcină/alăptare, ajustare după evoluția greutății |
| 🥩 Ce mănânci | Stil (de toate / pescetarian / vegetarian / vegan), cât de des carne, „ce nu mănânci” separat de alergii (pește, porc, ciuperci…), bucătării preferate, gusturi din poze |
| 👨‍👩‍👧 Familie | Porții separate pentru fiecare membru, iar membrii prezenți se aleg pentru fiecare săptămână |
| 📅 Plan | Gătești în zilele alese, resturile acoperă zilele următoare, ce nu ține se congelează. Nu repetă felurile din ultimele 4 săptămâni, nu pune aceeași carne la mese consecutive, „cât de variat” e reglabil |
| 🍽️ Mese pe zi | Alegi 2–5 mese; suma calorică a fiecărei zile din plan iese cât ținta ta (±5%). Schimbarea se aplică și planului de acum: mesele în plus dispar, porțiile celorlalte cresc |
| 👍👎 Gusturi | Notezi mesele după ce le mănânci; aplicația învață ce ingrediente, ce carne și ce bucătării îți plac |
| 🍲 1500 de rețete + rețetele tale | Rețete din toată lumea (TheMealDB, UniTools) și ~690 de rețete românești după Laura Laurențiu și e-retete.ro (ingredientele lor, pașii scriși de noi, cu link la rețeta completă și la video-ul de YouTube). Planul pune mai ales feluri familiare; cele exotice doar dacă alegi bucătăria lor. La mesele mari, felul principal vine cu ciorbă, pâine sau salată, ca acasă. Majoritatea cu carne (pui, porc, vită, miel), plus pește, vegetariene și de post. Caloriile, macro-urile, fibrele, zaharurile, sarea, alergenii, dieta și postul se calculează automat |
| 🏪 Magazine | Alegi unde cumperi (Lidl, Kaufland, Mega Image, Carrefour, Penny, Profi, Auchan, Selgros, Freshful). Lista săptămânii e pentru un singur magazin, cu comparația costului la celelalte. Prețurile de pe bonuri se țin minte separat pe magazin |
| 💸 Cheltuieli | Suma de pe bon sau confirmată la final de listă; grafic pe săptămâni și pe magazine, rezumat în fiecare luni |
| ❤️ Alegi prin swipe | Rețete una câte una: dreapta vreau, stânga nu. Din alegeri se fac planul și lista; swipe-urile învață gustul |
| 🧭 Cinci ferestre | Azi, Calorii, Săptămâna, Rețete, Acasă (lista și cămara). Profilul e cercul de sus |
| ☀️ Azi | Fără ore: „Prima masă”, „A doua masă”. Bifezi cercul când ai mâncat. Dacă ieri a rămas nebifat, un singur card întreabă: tot, doar prima masă sau altceva |
| 🔥 Calorii | Semicercul pe bucăți: fiecare masă cu poza ei, ce urmează mai deschis. Ținta explicată la cerere, macro în trei semicercuri mici, săptămâna în șapte |
| 🍝 Planul săptămânii | Alegi doar bucătăriile (românească, italiană, mediteraneană…); planul și lista se fac în buget |
| 🏷️ Prețuri de azi | Din Monitorul Prețurilor (Consiliul Concurenței): prețurile raportate zilnic de Lidl, Kaufland, Mega Image, Carrefour, Auchan, Penny, Profi, Selgros, din magazinele din zona ta. Ordinea: bonul tău > prețul de azi > estimarea |
| 🐞 Problemă | Profil → Raportează o problemă: ultimii pași și motivul ultimei închideri (Android), de trimis |
| 💰 Buget | Limită reală: planul nu trece de buget cu mai mult de 50 lei. Swipe-ul arată cât costă săptămâna și ascunde ce nu încape. Ulei, orez, făină și alte baze nu intră automat pe listă |
| ⚡ Adaugă o masă | Din plan cu porția aleasă (arcul arată înainte să confirmi cât îți rămâne), din poză, sau scris normal: „o shaorma mare și un ayran”. Ce e estimat are „≈” |
| 👨‍🍳 Mod de gătit | Pași mari, ecranul rămâne aprins, cronometre detectate din text, cu notificare la final |
| 🛒 Cumpărături | Listă pe raioane, rotunjită la ambalaje, cu prețuri, o poți trimite pe WhatsApp sau SMS |
| 🥫 Cămară | Ce cumperi intră automat, ce gătești se scade; notificări cu o zi înainte să expire ceva |
| 📸 Farfurie | Camera din aplicație; întâi îți arată ce aveai în plan azi, apoi ce seamănă cu poza (recunoaștere opțională pe telefon, CLIP prin ONNX Runtime). Pe Android rulează într-un proces separat: dacă modelul cade, aplicația rămâne deschisă |
| 🔢 Cod de bare | Valori nutriționale din Open Food Facts; adaugi produsul în jurnal sau în cămară |
| 🏷️ Etichetă | Citește tabelul nutrițional de pe ambalaj (OCR pe telefon) |
| 🧾 Bon | Recunoaște magazinul și totalul, pune produsele în cămară, actualizează prețurile magazinului |
| 🌿 Post | Opțional. Calendar BOR calculat automat, cu dezlegări |
| 🔒 Confidențialitate | Un singur utilizator pe telefon, blocare cu Face ID sau amprentă, backup și restaurare |

---

## Pentru dezvoltare

```bash
npm install
npm test               # 35 de teste: calorii, suma zilei în țintă, mese fără ore, text liber, post, planificator, varietate, magazine, jurnal, OCR, recunoaștere
npx tsc --noEmit       # verificare TypeScript
npx expo start --web   # previzualizare rapidă în browser (fără cameră, OCR, Face ID)
```

În Expo Go merg ecranele, dar nu merg OCR-ul, recunoașterea pozelor și Face ID. Acestea cer aplicația compilată (vezi mai sus).

Structură:
- `src/app/`: ecranele
- `src/logic/`: logica, testată în `scripts/test-logic.ts`
- `src/data/`: ingrediente (USDA), rețete (`retete/importate.ts` e generat de `scripts/recipes/build_import.py` din `scripts/recipes/ro/*.txt`; `retete/romanesti.ts` de `scripts/recipes/build_ro.py` din `scripts/recipes/ro_src/*.txt`), vectori CLIP
- `modules/nutri-ocr/`: modulul nativ: OCR (Apple Vision / Google ML Kit) și recunoașterea pozelor (ONNX Runtime 1.30)
- `.github/workflows/build.yml`: build-urile gratuite

Pentru o rețetă nouă inclusă în aplicație:
1. Adaug-o într-unul din fișierele din `src/data/retete/` (cu numele în engleză și, dacă are, indexul pozei din `mealdb_ids.ts`).
2. `npx tsx scripts/dump_data.ts > data.json`, apoi `python3 scripts/build_photos.py data.json <folder poze>` și `python3 scripts/build_vision.py data.json <folder model CLIP>`.

Doar fotografii reale de mâncare (nicio imagine generată); rețetele fără poză au o plăcuță cu numele. Pozele: [TheMealDB](https://www.themealdb.com) (gratuit pentru uz personal; pentru publicare în magazine e nevoie de licența lor). La rețetele românești: miniatura video-ului de YouTube al rețetei sau fotografii cu licență Creative Commons de pe [Openverse](https://openverse.org), verificate una câte una (autorul și licența apar pe pagina rețetei). Pozele site-urilor de rețete nu sunt folosite.

## Prețurile de azi

- În aplicație: Cumpărături → „Prețuri de azi” (alegi orașul sau sectorul). Telefonul ia direct de la monitorulpreturilor.info prețurile din magazinele de pe o rază de 1,5 km, pentru produsele potrivite fiecărui ingredient (`src/data/price_products.json`, căutările în `scripts/prices/mapping.py`).
- Pe GitHub: workflow-ul „Prețuri de azi” rulează lunea și pune prețurile în `src/data/prices_live.json`, folosite până le iei tu din aplicație.
- Serverul nu trimite certificatul intermediar Sectigo; Android îl primește prin `plugins/withPriceCert.js`, doar pentru domeniul acela.
