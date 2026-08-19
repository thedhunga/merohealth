/**
 * Medicines people in Nepal commonly buy and name — the recognition list
 * behind the "see a doctor before taking this" advisory.
 *
 * What this is: a list about LANGUAGE. Generic names, the brand names people
 * actually say at a pharmacy counter (Cetamol, Flexon, Omez, Mox…), in Latin
 * and Devanagari, and a plain category for what each is generally used for.
 * Owner direction 2026-08-19: list OTC medicines commonly taken in Nepal,
 * match them, and always attach a disclaimer to contact a physician.
 *
 * What this is NOT: a formulary. No doses, no indications beyond a
 * category word, no claim about legal OTC status — Nepal's Department of
 * Drug Administration decides that, and the owner verifies against it.
 * `tier` here is about how strong our advisory is:
 *
 *   'otc'          — commonly self-bought; advisory: see a doctor before taking.
 *   'prescription' — antibiotics, steroids, sedatives, hormonal, chronic-
 *                    disease medicines; advisory: NOT without a doctor's
 *                    prescription — even though many are sold over the
 *                    counter in practice, which is exactly why the line
 *                    must be firmer.
 *
 * `use` is a category label for a future "what is this medicine" card and
 * for the reference document; it is deliberately vague (a class, not a
 * recommendation) and identical across languages in meaning.
 */

export type MedicineTier = 'otc' | 'prescription';

export interface MedicineEntry {
  en: string;
  ne: string;
  tier: MedicineTier;
  /** Category only, e.g. 'pain / fever'. Never a dose or an instruction. */
  use: { en: string; ne: string };
  patterns: RegExp[];
}

const otc = (en: string, ne: string, useEn: string, useNe: string, patterns: RegExp[]): MedicineEntry => ({
  en, ne, tier: 'otc', use: { en: useEn, ne: useNe }, patterns,
});
const rx = (en: string, ne: string, useEn: string, useNe: string, patterns: RegExp[]): MedicineEntry => ({
  en, ne, tier: 'prescription', use: { en: useEn, ne: useNe }, patterns,
});

export const commonMedicinesInNepal: readonly MedicineEntry[] = [
  // ── Pain and fever ───────────────────────────────────────────────────
  otc('paracetamol', 'प्यारासिटामोल', 'pain / fever', 'दुखाइ / ज्वरो', [/paracetamol/i, /acetaminophen/i, /\bcetamol\b/i, /\bniko\b/i, /\bcalpol\b/i, /\bfevago\b/i, /प्यारासिटामोल/u, /सिटामोल/u, /निको(?![\p{L}\p{M}])/u, /क्यालपोल/u]),
  otc('ibuprofen', 'आइबुप्रोफेन', 'pain / inflammation', 'दुखाइ / सुन्निने', [/ibuprofen/i, /\bbrufen\b/i, /\bflexon\b/i, /\bcombiflam\b/i, /आइबुप्रोफेन/u, /ब्रुफेन/u, /फ्लेक्सन/u, /कम्बिफ्लाम/u]),
  otc('diclofenac', 'डाइक्लोफेनाक', 'pain / inflammation', 'दुखाइ / सुन्निने', [/diclofenac/i, /\bvoveran\b/i, /\bdiclogem\b/i, /डाइक्लोफेनाक/u, /भोभेरान/u]),
  otc('aspirin', 'एस्पिरिन', 'pain / fever', 'दुखाइ / ज्वरो', [/aspirin/i, /\bdisprin\b/i, /एस्पिरिन/u, /डिस्प्रिन/u]),
  otc('mefenamic acid', 'मेफेनामिक एसिड', 'pain / period pain', 'दुखाइ / महिनावारीको दुखाइ', [/mefenamic/i, /\bmeftal\b/i, /मेफेनामिक/u, /मेफ्टाल/u]),
  rx('nimesulide', 'निमेसुलाइड', 'pain / fever', 'दुखाइ / ज्वरो', [/nimesulide/i, /\bnimulid\b/i, /\bnise\b/i, /निमेसुलाइड/u, /निमुलिड/u]),
  rx('tramadol', 'ट्रामाडोल', 'strong pain', 'कडा दुखाइ', [/tramadol/i, /ट्रामाडोल/u]),
  otc('pain-relief balm', 'दुखाइको मलम', 'muscle / joint pain (topical)', 'मांसपेशी / जोर्नीको दुखाइ (बाहिरी)', [/\bmoov\b/i, /\bvolini\b/i, /\bzandu balm\b/i, /\biodex\b/i, /vaporub/i, /\bvicks\b/i, /मुभ(?![\p{L}\p{M}])/u, /भोलिनी/u, /जान्डु/u, /आयोडेक्स/u, /भिक्स/u]),

  // ── Cold, cough, allergy ─────────────────────────────────────────────
  otc('cetirizine', 'सेटिरिजिन', 'allergy / runny nose', 'एलर्जी / रुघा', [/\bcetirizine/i, /\bcetzine\b/i, /\balerid\b/i, /सेटिरिजिन/u, /सेट्जिन/u]),
  otc('levocetirizine', 'लेभोसेटिरिजिन', 'allergy', 'एलर्जी', [/levocetirizine/i, /लेभोसेटिरिजिन/u]),
  otc('chlorpheniramine', 'क्लोरफेनिरामिन', 'allergy / cold', 'एलर्जी / रुघा', [/chlorphen/i, /\bcpm\b/i, /क्लोरफेनिरामिन/u]),
  otc('loratadine', 'लोराटाडिन', 'allergy', 'एलर्जी', [/loratadine/i, /लोराटाडिन/u]),
  otc('cold and flu tablet', 'रुघाखोकीको चक्की', 'cold / flu symptoms', 'रुघाखोकीका लक्षण', [/\bsinex\b/i, /\bcoldarin\b/i, /\bd-?cold\b/i, /\bwikoryl\b/i, /\bcheston\b/i, /साइनेक्स/u, /कोल्डारिन/u, /डी-?कोल्ड/u, /चेस्टन/u]),
  otc('cough syrup', 'खोकीको सिरप', 'cough', 'खोकी', [/cough syrup/i, /\bbenadryl\b/i, /\bascoril\b/i, /\bgrilinctus\b/i, /\bkofol\b/i, /खोकीको (सिरप|औषधि)/u, /बेनाड्रिल/u, /एस्कोरिल/u, /ग्रिलिन्क्टस/u]),
  rx('codeine cough syrup', 'कोडिन भएको खोकीको सिरप', 'cough (contains codeine)', 'खोकी (कोडिन भएको)', [/codeine/i, /\bcorex\b/i, /कोडिन/u, /कोरेक्स/u]),
  otc('throat lozenge', 'घाँटीको लोजेन्ज', 'sore throat', 'घाँटी दुख्ने', [/lozenge/i, /\bstrepsils\b/i, /\bhalls\b/i, /स्ट्रेप्सिल्स/u, /लोजेन्ज/u]),
  rx('salbutamol', 'साल्बुटामोल', 'asthma / breathing (inhaler)', 'दम / सास (इन्हेलर)', [/salbutamol/i, /albuterol/i, /\basthalin\b/i, /साल्बुटामोल/u, /अस्थालिन/u, /इन्हेलर/u]),
  rx('montelukast', 'मोन्टेलुकास्ट', 'asthma / allergy', 'दम / एलर्जी', [/montelukast/i, /मोन्टेलुकास्ट/u]),

  // ── Stomach and bowels ───────────────────────────────────────────────
  otc('ORS', 'जीवनजल (ORS)', 'dehydration / diarrhoea', 'पानीको कमी / झाडापखाला', [/\bORS\b/i, /oral rehydration/i, /जीवनजल/u, /ओआरएस/u]),
  otc('zinc', 'जिंक', 'diarrhoea in children (with ORS)', 'बच्चाको झाडापखाला (जीवनजलसँग)', [/\bzinc\b/i, /जिंक/u, /जिङ्क/u]),
  otc('omeprazole', 'ओमेप्राजोल', 'acidity / gastritis', 'अमिलो / ग्यास्ट्रिक', [/omeprazole/i, /\bomez\b/i, /\bocid\b/i, /ओमेप्राजोल/u, /ओमेज/u]),
  otc('pantoprazole', 'प्यान्टोप्राजोल', 'acidity / gastritis', 'अमिलो / ग्यास्ट्रिक', [/pantoprazole/i, /\bpantop\b/i, /\bpan[- ]?40\b/i, /\bpan-?d\b/i, /प्यान्टोप्राजोल/u, /प्यान्टप/u, /प्यान ?४०/u]),
  otc('ranitidine', 'रेनिटिडिन', 'acidity', 'अमिलो', [/ranitidine/i, /\bzinetac\b/i, /\brantac\b/i, /रेनिटिडिन/u, /जिनेट्याक/u]),
  otc('antacid', 'एन्टासिड', 'acidity / heartburn', 'अमिलो / छाती पोल्ने', [/antacid/i, /\bgelusil\b/i, /\bdigene\b/i, /\beno\b/i, /एन्टासिड/u, /जेलुसिल/u, /डाइजिन/u, /इनो(?![\p{L}\p{M}])/u]),
  otc('domperidone', 'डोम्पेरिडोन', 'nausea', 'वाकवाकी', [/domperidone/i, /\bdomstal\b/i, /डोम्पेरिडोन/u, /डोमस्टल/u]),
  rx('ondansetron', 'ओन्डान्सेट्रोन', 'vomiting', 'बान्ता', [/ondansetron/i, /\bemeset\b/i, /\bondem\b/i, /ओन्डान्सेट्रोन/u, /इमिसेट/u]),
  otc('loperamide', 'लोपेरामाइड', 'diarrhoea (adults)', 'झाडापखाला (वयस्क)', [/loperamide/i, /\bimodium\b/i, /लोपेरामाइड/u, /इमोडियम/u]),
  otc('isabgol (psyllium)', 'इसबगोल', 'constipation', 'कब्जियत', [/isabgol/i, /psyllium/i, /इसबगोल/u]),
  otc('lactulose', 'ल्याक्टुलोज', 'constipation', 'कब्जियत', [/lactulose/i, /\bduphalac\b/i, /ल्याक्टुलोज/u, /डुफालाक/u]),
  otc('bisacodyl', 'बिसाकोडिल', 'constipation', 'कब्जियत', [/bisacodyl/i, /\bdulcolax\b/i, /बिसाकोडिल/u, /डल्कोल्याक्स/u]),
  rx('metronidazole', 'मेट्रोनिडाजोल', 'antibiotic (gut / dental infections)', 'एन्टिबायोटिक (पेट / दाँतको संक्रमण)', [/metronidazole/i, /\bflagyl\b/i, /\bmetrogyl\b/i, /मेट्रोनिडाजोल/u, /फ्ल्याजिल/u]),

  // ── Worms, vitamins, minerals ────────────────────────────────────────
  otc('albendazole', 'एल्बेन्डाजोल', 'deworming', 'जुका', [/albendazole/i, /\bzentel\b/i, /एल्बेन्डाजोल/u, /जेन्टेल/u, /जुकाको औषधि/u]),
  otc('mebendazole', 'मेबेन्डाजोल', 'deworming', 'जुका', [/mebendazole/i, /मेबेन्डाजोल/u]),
  otc('iron / folic acid', 'आइरन / फोलिक एसिड', 'anaemia / pregnancy supplement', 'रक्तअल्पता / गर्भावस्थाको पूरक', [/iron.{0,12}folic/i, /folic acid/i, /ferrous/i, /आइरन.{0,12}फोलिक/u, /फोलिक एसिड/u, /आइरन चक्की/u]),
  otc('calcium', 'क्याल्सियम', 'bones / supplement', 'हड्डी / पूरक', [/\bcalcium\b/i, /\bshelcal\b/i, /क्याल्सियम/u, /शेलक्याल/u]),
  otc('vitamin C', 'भिटामिन सी', 'supplement', 'पूरक', [/vitamin c\b/i, /\blimcee\b/i, /ascorbic/i, /भिटामिन सी/u, /लिम्सी/u]),
  otc('vitamin B complex', 'भिटामिन बी कम्प्लेक्स', 'supplement', 'पूरक', [/b[- ]?complex/i, /\bbecosules\b/i, /भिटामिन बी/u, /बेकोसुल्स/u]),
  otc('vitamin D', 'भिटामिन डी', 'supplement', 'पूरक', [/vitamin d\b/i, /cholecalciferol/i, /भिटामिन डी/u]),
  otc('multivitamin', 'मल्टिभिटामिन', 'supplement', 'पूरक', [/multivitamin/i, /मल्टिभिटामिन/u]),

  // ── Skin and antiseptic ──────────────────────────────────────────────
  otc('clotrimazole', 'क्लोट्रिमाजोल', 'fungal skin infection (cream)', 'छालाको ढुसी (क्रिम)', [/clotrimazole/i, /\bcandid\b/i, /क्लोट्रिमाजोल/u, /क्यान्डिड/u]),
  otc('povidone-iodine', 'पोभिडोन आयोडिन', 'antiseptic for wounds', 'घाउको एन्टिसेप्टिक', [/povidone/i, /\bbetadine\b/i, /पोभिडोन/u, /बेटाडिन/u]),
  otc('antiseptic liquid', 'एन्टिसेप्टिक झोल', 'cleaning wounds', 'घाउ सफा गर्ने', [/\bdettol\b/i, /\bsavlon\b/i, /antiseptic/i, /डेटोल/u, /स्याभलोन/u, /एन्टिसेप्टिक/u]),
  otc('calamine', 'क्यालामाइन', 'itching / rash (lotion)', 'चिलाउने / डाबर (लोसन)', [/calamine/i, /क्यालामाइन/u]),
  otc('permethrin', 'पर्मेथ्रिन', 'scabies / lice', 'लुतो / जुम्रा', [/permethrin/i, /\bscabper\b/i, /पर्मेथ्रिन/u]),
  rx('betamethasone (steroid cream)', 'बेटामेथासोन (स्टेरोइड क्रिम)', 'skin inflammation (steroid)', 'छालाको सुजन (स्टेरोइड)', [/betamethasone/i, /\bbetnovate\b/i, /clobetasol/i, /\bdermovate\b/i, /बेटामेथासोन/u, /बेटनोभेट/u, /स्टेरोइड क्रिम/u]),
  rx('prednisolone', 'प्रेड्निसोलोन', 'steroid (many uses)', 'स्टेरोइड (धेरै प्रयोग)', [/prednisolone/i, /prednisone/i, /\bwysolone\b/i, /प्रेड्निसोलोन/u]),

  // ── Antibiotics — commonly self-bought; must not be ───────────────────
  rx('amoxicillin', 'एमोक्सिसिलिन', 'antibiotic', 'एन्टिबायोटिक', [/amoxicillin/i, /amoxycillin/i, /\bamoxil\b/i, /\bmox\b/i, /\bnovamox\b/i, /एमोक्सिसिलिन/u, /अमोक्सिल/u, /मोक्स(?![\p{L}\p{M}])/u]),
  rx('azithromycin', 'एजिथ्रोमाइसिन', 'antibiotic', 'एन्टिबायोटिक', [/azithromycin/i, /\bazithral\b/i, /\bzithro/i, /एजिथ्रोमाइसिन/u, /एजिथ्रल/u]),
  rx('ciprofloxacin', 'सिप्रोफ्लोक्सासिन', 'antibiotic', 'एन्टिबायोटिक', [/ciprofloxacin/i, /\bciplox\b/i, /\bcifran\b/i, /सिप्रोफ्लोक्सासिन/u, /सिप्लोक्स/u]),
  rx('ofloxacin', 'ओफ्लोक्सासिन', 'antibiotic', 'एन्टिबायोटिक', [/\bofloxacin/i, /\bzanocin\b/i, /ओफ्लोक्सासिन/u]),
  rx('cefixime', 'सेफिक्सिम', 'antibiotic', 'एन्टिबायोटिक', [/cefixime/i, /\btaxim-?o\b/i, /सेफिक्सिम/u]),
  rx('doxycycline', 'डक्सिसाइक्लिन', 'antibiotic', 'एन्टिबायोटिक', [/doxycycline/i, /डक्सिसाइक्लिन/u]),
  rx('cotrimoxazole', 'कोट्रिमोक्साजोल', 'antibiotic', 'एन्टिबायोटिक', [/cotrimoxazole/i, /co-?trimoxazole/i, /\bseptran\b/i, /\bbactrim\b/i, /कोट्रिमोक्साजोल/u, /सेप्ट्रान/u]),

  // ── Sedatives ────────────────────────────────────────────────────────
  rx('diazepam', 'डायजेपाम', 'sedative / anxiety', 'निद्रा / चिन्ता', [/diazepam/i, /\bvalium\b/i, /\bcalmpose\b/i, /डायजेपाम/u]),
  rx('alprazolam', 'अल्प्राजोलाम', 'sedative / anxiety', 'निद्रा / चिन्ता', [/alprazolam/i, /\balprax\b/i, /\brestyl\b/i, /अल्प्राजोलाम/u]),

  // ── Reproductive health ──────────────────────────────────────────────
  rx('emergency contraceptive pill', 'आपतकालीन गर्भनिरोधक चक्की', 'emergency contraception', 'आपतकालीन गर्भनिरोध', [/emergency contracept/i, /morning[- ]after/i, /\bi-?pill\b/i, /unwanted[- ]?72/i, /आपतकालीन गर्भनिरोधक/u, /आई-?पिल/u]),
  rx('oral contraceptive pill', 'गर्भनिरोधक चक्की', 'contraception', 'गर्भनिरोध', [/contraceptive pill/i, /birth control pill/i, /\bnilocon\b/i, /गर्भनिरोधक चक्की/u, /निलोकन/u]),
  rx('misoprostol', 'मिसोप्रोस्टोल', 'medical abortion / obstetric use', 'औषधीय गर्भपतन / प्रसूति प्रयोग', [/misoprostol/i, /mifepristone/i, /मिसोप्रोस्टोल/u, /मिफेप्रिस्टोन/u]),

  // ── Chronic-disease medicines people continue on their own ───────────
  rx('metformin', 'मेटफर्मिन', 'diabetes', 'मधुमेह', [/metformin/i, /\bglycomet\b/i, /मेटफर्मिन/u]),
  rx('glimepiride', 'ग्लिमेपिराइड', 'diabetes', 'मधुमेह', [/glimepiride/i, /\bamaryl\b/i, /ग्लिमेपिराइड/u]),
  rx('insulin', 'इन्सुलिन', 'diabetes', 'मधुमेह', [/insulin/i, /इन्सुलिन/u]),
  rx('amlodipine', 'एम्लोडिपिन', 'blood pressure', 'रक्तचाप', [/amlodipine/i, /\bamlong\b/i, /\bamlip\b/i, /एम्लोडिपिन/u]),
  rx('losartan', 'लोसार्टान', 'blood pressure', 'रक्तचाप', [/losartan/i, /\blosar\b/i, /लोसार्टान/u]),
  rx('telmisartan', 'टेल्मिसार्टान', 'blood pressure', 'रक्तचाप', [/telmisartan/i, /\btelma\b/i, /टेल्मिसार्टान/u]),
  rx('atenolol', 'एटेनोलोल', 'blood pressure / heart', 'रक्तचाप / मुटु', [/atenolol/i, /एटेनोलोल/u]),
  rx('atorvastatin', 'एटोरभास्टाटिन', 'cholesterol', 'कोलेस्ट्रोल', [/atorvastatin/i, /rosuvastatin/i, /एटोरभास्टाटिन/u, /रोसुभास्टाटिन/u]),
  rx('levothyroxine', 'लेभोथाइरोक्सिन', 'thyroid', 'थाइरोइड', [/levothyroxine/i, /thyroxine/i, /\bthyronorm\b/i, /\beltroxin\b/i, /लेभोथाइरोक्सिन/u, /थाइरोनर्म/u, /थाइरोक्सिन/u]),
];
