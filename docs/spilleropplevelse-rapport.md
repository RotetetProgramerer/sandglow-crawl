# Skare Offroad: rapport om spilleropplevelsen

Dato: 26. november 2026. Linjenumre gjelder `main` på commit `a947b60`, altså før rettelsene på denne branchen.

## Slik er analysen gjort

- **Lest:** README.md, index.html, js/game.js, js/tips.js, js/dagbok.js, js/ghost.js, data/cars.js, data/parts.js og data/archipelago.js er lest direkte. Minispillene, flerspiller, verden, GPS og dyrene (resten av js/ og data/) er lest i sin helhet av fem parallelle lesegjennomganger, og funnene derfra er merket «lest i koden».
- **Spilt:** i headless Chromium på 1280×720 og i mobilstørrelse med berøring (851×393, 393×851 og 667×375). Spilt: meny, fri kjøring fra start, hele Jungelstien, garasjen, ski, race, Diamantgrotten, Gruve 7, båtløp og inngangen til Frøhvelvet.
- **Testet:** alle ni testene i tools/ er kjørt før og etter rettelsene.

Tre forbehold:

- Nettleseren her har bare programvaregrafikk (2 bilder i sekundet). Spillets løkke ble derfor drevet av et testoppsett med 60 steg per sekund, og bilen ble styrt med tastetrykk og en enkel autopilot. **Jeg har ikke kjent styringen i hendene.** Alt om spillfølelse i fingrene er derfor antakelser.
- **Lyd er ikke hørt**, bare lest i koden.
- Ytelse på ekte enheter er ikke målt.

Merking i rapporten: **[Spilt]** betyr sett i nettleseren, **[Lest]** betyr lest i koden, **[Antatt]** betyr en vurdering uten direkte bevis.

## Oppsummering

### Tre styrker

1. **Mye innhold med høy kvalitet, og det ser bra ut.** Fjorten øyer, åtte minispill og fjorten biler. Hvert minispill har egen fysikk, HUD og lyd, og bilder fra alle seks jeg spilte, er ryddige og lesbare. Ingen JavaScript-feil dukket opp under spillingen. [Spilt]
2. **Spillet er tilgivende på de riktige stedene.** Veltehjelp uten straff i Lett-modus, rullende sjekkpunkt i fri kjøring, krasj i Gruve 7 gir spinn i stedet for omstart, lasteflyet har landingshjelp, og Frøhvelvet kan ikke tapes. [Lest, delvis spilt]
3. **Første belønning kommer fort.** Første løype (Jungelstien) tok 30 sekunder og ga 560 muttere med dagens dobbel, nok til to–tre deler i garasjen med en gang. Tipsene kommer ett om gangen når de trengs, i stedet for en lang liste før start. [Spilt]

### Tre svakheter

1. **Mobil hadde feil som stoppet spilleren.** Girknappen lå under styreknappene og kunne ikke trykkes, så mobilspillere satt fast i lavt gir. Heisen, fergen og båtintroen kunne bare hoppes over med Enter. Flere hint nevner bare taster. [Spilt og lest] De tre første er rettet på denne branchen.
2. **Økonomien har et hull.** Én tur i Diamantgrotten gir 740 muttere på 63–93 sekunder og kan gjentas fritt, mens en raceseier gir 30–60. Den dyreste bilen (1500) er to grotteturer unna. Da mister løypene, stjernene og dagens utfordring verdi som mål. [Lest, tall fra tools/test-grotte.js]
3. **Lite som gjøres sammen, og lite som veileder mot neste mål.** I flerspiller ser man hverandre på øyene, men bare båtløp og race er felles aktiviteter. Flere minispill finnes ikke på kartet. Veipilen pekte mot nærmeste løype, som for en ny spiller var et nattløp av middels vanskelighet. [Lest og spilt] Veipilen er rettet.

## Rettet på denne branchen

Alt under er verifisert i nettleseren etter rettelsen, og testene i tools/ gir samme resultat som før.

| # | Problem | Bevis | Rettelse |
|---|---|---|---|
| R1 | «Slik spiller du» åpnet seg oppå hver heistur og hver skistart, og skihintene ble aldri vist. To funksjoner het `showHelp`, og den i tips.js vant fordi den lastes sist. [Spilt] | js/ski.js:165 og js/tips.js:45 | Skifunksjonen heter nå `skiHint`. |
| R2 | På mobil lå måleradene under styreknappene. Trykk midt på girknappen traff styreknappen i liggende format, og i stående format var også «−» dekket. [Spilt, målt med treffpunkt] | css/style.css:118, 175 | Måleradene ligger mellom tommelknappene, og over dem i stående format. |
| R3 | Heisen kunne ikke hoppes over på berøring eller håndkontroll. [Lest] | js/ski.js:250 | Hoppknappen hopper over heisen, og hintet sier det på mobil. |
| R4 | Skihintene ved start nevnte bare taster. [Lest] | js/ski.js:162 | Egen tekst for berøring. |
| R5 | Fergeturen (ca. 8 s) kunne ikke hoppes over på mobil. [Lest] | js/game.js:636 | Trykk på skjermen hopper over. |
| R6 | Verkstedet spurte «Vil du starte denne utfordringen?». [Spilt] | js/world.js:46–47 | Spør «Vil du kjøre inn i verkstedet?». |
| R7 | En ny spiller som ga gass rett fram, fikk verksteddialogen etter 1,6 sekunder, med 0 muttere. [Spilt] | js/world.js:108, start i data/levels/10-verden.js | Dialogen kommer først når spilleren har muttere eller har kjørt en løype. Tipset om verkstedet vises fortsatt. |
| R8 | Veipilen og «m til …» pekte mot nærmeste startstrek (Nattløpet, middels). [Spilt] | js/game.js:791, 809 | Peker mot den letteste løypa som ikke er kjørt (Jungelstien for en ny spiller). |
| R9 | Meldinger som «Du trenger 20 muttere» lå bak kartet og dialogene. [Lest] | css/style.css:139 mot :20 | Meldinger ligger over dialogene, og under knappene på smal skjerm. |
| R10 | Ringene fra en flytur ble hengende over båtløpet. [Lest] | js/plane.js:108–111 | Skjules når flyturen avsluttes. |
| R11 | Motor og bensinvarsel i grotten gikk videre bak resultatskjermen. [Lest] | js/grotte.js:327 | Stilles når resultatet vises. |
| R12 | Publikum og kubjeller fortsatte i pausemenyen på ski. [Lest] | js/ski.js:369 | Stille i pause. |
| R13 | Tab og mellomrom var blokkert i pause og resultat i racet. [Lest] | js/race.js:185 | Blokkeres bare under kjøring. |
| R14 | Et tips kunne bli hengende over nedtellingen til en løype. [Spilt] | js/world.js:70 | Skjules når løypa starter. |

`VERSION` i sw.js er økt til v46.

## Gjort i runde 2

Etter rapporten er disse forslagene utført. «Prøvd» betyr sett virke i nettleseren, «lest» betyr bare kodegjennomgang og testene i tools/.

| Forslag | Hva som er gjort | Status |
|---|---|---|
| Q1 | En diamant gir 10 muttere første gang den tas, og 2 senere. Tatte diamanter er blekere og mindre. Lagres i `prof.cave.gems`. | Prøvd: 15 diamanter ga 150, samme 15 på ny tur ga 30. |
| Q2 | Myntlyd ved kasse, fanfare ved mål, og mutterne teller opp på resultatskjermen. | Opptelling og kall prøvd. Lyden er ikke hørt. |
| Q3 | Racehint på berøring de tre første løpene, knappen «Tilbake», og lasteflyet sier hvordan turen hoppes over. | Lest. |
| Q4 | I Gruve 7 hopper et trykk alltid, og utstyret brukes med knappen. Finger holdt nede etter sveip ned holder dukket. | Prøvd med syntetiske pekerhendelser. |
| Q5 | Sju sekunders felles pause etter et dyreangrep, og krokodillen varsler og venter 0,8 s før utfallet. | Lest. |
| Q6 | Fergen med under 5 muttere: grå reisemål og tekst om det gratis lasteflyet. Talltastene 1–9 velger i lister. | Prøvd. |
| Q7 | Frøhvelvet: synlig linje når norsk stemme mangler, svarene på stasjon 4 leses opp, tale stoppes på vei ut, og en stille ytring i JA-trykket for iOS. | Lest. Linjen vises ikke når nettleseren aldri gir en stemmeliste; da er det ukjent om talen virker. |
| Q8 | Piratøya: «Stopp helt på krysset», «!» over krysset og hodeskallen, «Kjør tilbake til Skumkroa!», og tall foran svarene i ordduellen. | Lest. |
| Q9 | Ingen turbotønne på siste etappe i båtløpet, og trykk på skjermen hopper over introen. | Lest, båttesten er grønn. Tidligere varsel om å sakke farten er ikke gjort. |
| M1 | Lett-modus på ski: bom gir +2 s, andre skiløpere dytter i stedet for å felle, ingen snurr på korte luftferder. Kortere nedtelling ved «Prøv igjen». Større ringer i rundflygingen. | Ringene prøvd, ski lest og skitesten er grønn. Båt har ikke fått automatisk brems ved brygga. |

Ikke gjort: nedtelling etter pause i Gruve 7, M2–M8 og L1–L3.

## Forslag: raske gevinster (under en dag hver)

### Q1. Tett hullet i grotteøkonomien
- **Problem:** Grotten gir 12–25 ganger mer per tur enn noe annet, og «Fra inngangen» i pausemenyen legger diamantene tilbake uten at du må ut.
- **Bevis:** js/grotte.js:236 (`prof.nuts+=10`), :212 (alle diamanter tilbake), :243 (50 + 100), :351. data/racer.js:44 (`RACE_PRIZE=[30,20,12,6,3,3]`). [Lest]
- **Løsning:** Lagre tatte diamanter i `prof.cave`. Full verdi første gang, 2 muttere ved gjenplukk, eller full verdi én gang per dag.
- **Effekt:** Biler og deler blir noe å spare til, og de andre aktivitetene beholder verdien.
- **Innsats:** S. **Risiko:** Middels. Spillere som er vant til dagens inntekt, vil merke det. Dette er et designvalg, og derfor har jeg ikke endret det.

### Q2. Lyd og feiring ved kasse og mål
- **Problem:** Port har lyd, men kasse, mål og mutterutbetaling har bare tekst.
- **Bevis:** js/game.js:625 (`ambGate`), :844 (kasse: bare melding og støv), :608 (`toast('Mål!')`). [Lest, ikke hørt]
- **Løsning:** En `ambCoin()` og en kort fanfare i js/ambience.js etter mønsteret i `ambGate`, og la mutterbeløpet telle opp på resultatskjermen.
- **Effekt:** Det merkes når noe lykkes. Billigste måten å heve spillfølelsen på.
- **Innsats:** S. **Risiko:** Lav.

### Q3. Berøringshint i race, båt, fly og Gruve 7
- **Problem:** Tastaturspillere får tastene vist, berøringsspillere får lite.
- **Bevis:** js/race.js:420 (`!touch`), index.html:189 (knappen heter bare «R»), js/boat.js:477, js/cargo.js:214, js/gruve7.js:200 og :249–250. [Lest]
- **Løsning:** Samme hint for berøring de tre første turene. Gi R-knappen teksten «Tilbake». Lasteflyet sier «⏸ for å hoppe over» første gang.
- **Effekt:** Mobilspillere forstår minispillene uten å prøve og feile.
- **Innsats:** S. **Risiko:** Lav.

### Q4. Trykk skal ikke bety to ting i Gruve 7
- **Problem:** Trykk hopper når du er tom, men bruker utstyret når du har noe. Et barn som trykker for å hoppe, bruker opp turboen og faller i sjakta.
- **Bevis:** js/gruve7.js:395. Dukk kan heller ikke holdes på berøring: js/gruve7.js:211, og to bjelker står 8,5 enheter fra hverandre i data/gruve7.js:49. [Lest]
- **Løsning:** Trykk på `#mnItem` bruker utstyr, sveip opp hopper. Hold fingeren nede etter sveip ned for å bli i dukk.
- **Innsats:** S. **Risiko:** Lav, men bør prøves på en ekte telefon.

### Q5. Felles hviletid for dyreangrep, og varsel fra krokodillen
- **Problem:** En løveflokk på tre kan gi 15 straffepoeng på et par sekunder. Krokodillen varsler ikke før den angriper, selv om README lover det.
- **Bevis:** js/savannedyr.js:130 (`p.cool` per dyr), data/levels/11-savanne.js:56 (`n:3`), js/savannedyr.js:127 (`&&!croc`). [Lest]
- **Løsning:** En felles `SAV.hitT` på 6–8 sekunder, og bobler eller blinkende øyne på varselavstand.
- **Innsats:** S. **Risiko:** Lav.

### Q6. Fergen når du har under 5 muttere
- **Problem:** Alle reisemål vises med «5 ⚙» uansett saldo. Lasteflyet er gratis, men nevnes ikke der.
- **Bevis:** js/world.js:45, :170. [Lest]
- **Løsning:** Grå ut knappene og vis «Lasteflyet er gratis» med en knapp som setter GPS til flyplassen.
- **Innsats:** S. **Risiko:** Lav.

### Q7. Frøhvelvet uten norsk stemme
- **Problem:** Mangler norsk stemme, er spillet stumt, og beskjeden står bare i en `title` som ikke vises på berøring. Svarene på stasjon 4 leses aldri opp.
- **Bevis:** js/frohvelv.js:70, :77, :122. data/frohvelv.js:60. [Lest]
- **Løsning:** En synlig linje til en voksen: «Ingen norsk stemme her. Les høyt for barnet.» Les alternativene etter spørsmålet.
- **Effekt:** Avgjørende for målgruppen, som ikke leser selv.
- **Innsats:** S. **Risiko:** Lav.

### Q8. Piratprøvene: veiledning på stedet
- **Problem:** Gravingen krever at bilen står nesten stille i 1,5 s, uten beskjed når du kjører for fort. Etter tredje prøve sier ingenting at du skal tilbake til Skumkroa. Ordduellen kan ikke velges med tastatur.
- **Bevis:** js/pirater.js:205–206, :203, :128, :253. js/game.js:646. [Lest]
- **Løsning:** «Stopp helt på krysset», «!» over krysset og gapet, «Kjør til Skumkroa!» når alle tre er klart, og tallene 1–3 som svar.
- **Innsats:** S. **Risiko:** Lav.

### Q9. Små justeringer i båtløpet
- **Problem:** En turbotønne ligger rett foran brygga der du må bremse. Varselet om å sakke farten kommer først inne ved brygga.
- **Bevis:** js/boatsim.js:77–78, js/boat.js:402, `mooring:1.15`. [Lest]
- **Løsning:** Dropp tønna på siste etappe, og varsle 300 m før med et tall («under 18 kn»).
- **Innsats:** S. **Risiko:** Lav.

## Forslag: mellomstore løft

### M1. Lett-modus som virker i alle minispill
- **Problem:** Lett-modus er solid i hovedspillet, men tynn eller fraværende ellers.
- **Bevis:** Ski: bare fartsgrense og mykere landing (js/skier.js:66, :91); andre skiløpere feller deg i barnebakken (js/skiresort.js:167). Fly: ingen assist, `ringR:30` mot vingespenn 28 (js/planesim.js:12). Båt: bare piratene (js/boat.js:348). [Lest]
- **Løsning:** Send `state.assist` inn overalt: mildere bomstraff på ski, dytt i stedet for fall, større ringer, automatisk brems ved brygga, romsligere krav til stjerner.
- **Effekt:** De yngste kan fullføre alt, ikke bare hovedspillet.
- **Innsats:** M. **Risiko:** Lav.

### M2. Gå gjennom stjernekravene
- **Problem:** Flere krav ser strammere ut enn testautopilotene klarer.
- **Bevis:** Familiebakken: autopilot 28,4 s mot krav 27 s for to stjerner. Race Havn: 2:05,6 mot 2:07. Rundt Tromøya med båt krever 88 % av toppfart i snitt, mer enn de vanskeligere løpene. Kravet i race vises først i resultatet (js/race.js:463). [Tall fra testene, opplevd vanskelighet er antatt]
- **Løsning:** Mål med mennesker, løs opp 5–10 %, og vis kravet før start.
- **Innsats:** M (mest prøvespilling). **Risiko:** Lav.

### M3. Minispillene på kartet og i GPS-en
- **Problem:** Gruve 7, Frøhvelvet og piratstedene finnes ikke i `gpsPlaces`. Skiheis, racerbane, skuterutleie og grotte har ikke ikon på kartet.
- **Bevis:** js/map.js:115–118, js/gpsroute.js:26–29. [Lest]
- **Løsning:** Legg stedene til, og tegn ett ikon per type på øykartet og minikartet.
- **Effekt:** Spilleren finner det beste innholdet uten å lete seg fram.
- **Innsats:** M. **Risiko:** Lav.

### M4. Lettere å komme i gang sammen
- **Problem:** Gjesten må skrive romkoden. Det finnes ingen lenke å dele. Race-invitasjonen sendes én gang og kan gå tapt. Går verten, dør rommet.
- **Bevis:** js/net.js:271 (bare `?local`), js/racenet.js:28, :95, :107. js/net.js:114. [Lest]
- **Løsning:** `?rom=KRABBE-42` i adressen og en «Del lenke»-knapp. Send invitasjonen på nytt når noen kommer inn. Faste emotes eller tut, uten fritekst.
- **Innsats:** M. **Risiko:** Middels (nettverkskode, må prøves på to enheter).

### M5. Personvern for barn i flerspiller
- **Problem:** Navn er fritekst, og det finnes bare 1800 romkoder, så en fremmed kan gjette seg inn.
- **Bevis:** js/net.js:22–23. [Lest]
- **Løsning:** Navnevelger (adjektiv + dyr), to ord i koden og «Lås rommet» hos verten.
- **Innsats:** M. **Risiko:** Lav.

### M6. Kameraet bak hindringer
- **Problem:** Følgekameraet har ingen sjekk mot trær og hus. Ved startstreken til Jungelstien dekket en trestamme hele bilen.
- **Bevis:** Skjermbilde ved startstreken [Spilt]. js/game.js:747–750 løfter bare kameraet over terrenget.
- **Løsning:** Test linjen fra bilen til kameraet mot `LV.colliders` og trekk kameraet nærmere når den er brutt.
- **Innsats:** M. **Risiko:** Middels (kamerarykk må dempes).

### M7. GPS-ruter som velter bilen
- **Problem:** `tools/test-gps.js` melder 8 turer med feil. Sju kommer fram, men med velt, fast eller druknet motor. Én (kaia → Snøfjellet på Tromøya i høyt gir) går tom for tid.
- **Bevis:** Testkjøring. Ruta priser stigning og tverrhelling hver for seg (js/gpsroute.js:76–77), og hjørnekuttingen lager skarpe knekker (:122). [Kjørt og lest]
- **Løsning:** Pris samlet helling, koble stigning til underlagets grep, og regn bratte celler som kant.
- **Innsats:** M. **Risiko:** Middels (endrer mange ruter, men testen fanger det).

### M8. Mål i grotten og i Gruve 7 etter første gang
- **Problem:** Grotterekorden er «lengst inn» og kan ikke slås når du har nådd skatten. I Gruve 7 vises bare bestetid, så den som ikke vinner, ser ingen framgang.
- **Bevis:** js/grotte.js:248–249, js/gruve7.js:258, :261. [Lest]
- **Løsning:** Stjerner for alle diamantene og bestetid i grotten. «Ny kullrekord» og «Beste plass» i Gruve 7.
- **Innsats:** M. **Risiko:** Lav.

## Forslag: større satsinger

### L1. Noe å gjøre sammen på øyene
- **Problem:** På øyene ser spillerne hverandre, men løyper, muttere og gullmuttere er personlige.
- **Løsning:** Felles løypestart med samme invitasjonsmønster som racet, og en felles gullmutterjakt.
- **Innsats:** L. **Risiko:** Høy. Krever synkronisering som ikke finnes i dag.

### L2. Kortere vei til menyen
- **Problem:** 73 blokkerende skript (ca. 1,5 MB ukomprimert) lastes før menyen, og three.js kommer fra en CDN. Service workeren henter nett-først uten tidsavbrudd.
- **Bevis:** index.html:611–688, sw.js:20. Tall fra opptelling. [Lest, lastetid på ekte nett er ikke målt]
- **Løsning:** Last minispillene ved behov, slik PeerJS allerede lastes. Tidsavbrudd på 3 s i sw.js før lageret brukes. Legg three.js lokalt.
- **Innsats:** L. **Risiko:** Middels. Skriptrekkefølgen er bærende i dag.

### L3. Et mål for turen til fots
- **Problem:** Sjåføren kan gå, løpe og hoppe, men det er ingenting å gjøre til fots.
- **Bevis:** js/world.js:209 og js/map.js:63 bruker bare `car.pos`. [Lest]
- **Løsning:** Én gullmutter per øy der bare mannen kommer til.
- **Innsats:** L (innhold på 14 øyer). **Risiko:** Lav.

## Bør stå urørt

- **Tipsene (js/tips.js).** Ett hint om gangen, og de krysses av når spilleren gjør tingen selv.
- **Veltehjelp, rullende sjekkpunkt og «Hent bilen».** Ingen steder i hovedspillet kan man sette seg ugjenkallelig fast.
- **Banebonusen per port.** Belønner delvis fullføring uten å kunne utnyttes.
- **Gruve 7 kan ikke tapes,** og gummistrikken er mild.
- **Frøhvelvets oppbygning:** store knapper, ingen klokke, feil svar forsvinner.
- **Hjelpen i racet:** «Feil vei», «Står du fast?» og veggen som retter bilen opp.
- **Interpolasjonen i flerspiller** og lokal test med samme romlogikk.
- **Krasj i fly er billig,** og landingshjelpen i lasteflyet.

## Anbefalt rekkefølge for de fem neste tiltakene

Rettelsene R1–R14 er allerede gjort. Deretter:

1. **Q1, grotteøkonomien.** Den undergraver alt annet i progresjonen, og bør avgjøres før priser og belønninger justeres ellers.
2. **Q2, lyd og feiring ved kasse og mål.** Liten jobb med størst effekt på spillfølelsen.
3. **Q3 og Q4, berøringshint og trykk i Gruve 7.** Fullfører mobilløftet som R2–R5 startet.
4. **Q7, Frøhvelvet uten norsk stemme.** Spillet for de minste må virke for de minste.
5. **M1, Lett-modus i alle minispill.** Bør følges av M2 (stjernekravene) i samme omgang.
