# Medicines commonly bought and named in Nepal — recognition list

> **Generated from `packages/clinical-safety/src/medicines.ts`. Do not edit by
> hand; edit the code list, build the package, and re-run
> `node packages/clinical-safety/scripts/write-medicines-doc.mjs`.**

## What this is, and is not

This is the list the assistant uses to recognise a medicine in an answer and
attach the advisory: for **OTC-tier** medicines, "see a doctor or authorised
health worker before taking"; for **prescription-tier** medicines (antibiotics,
steroids, sedatives, hormonal, chronic-disease), "do not take without a
doctor's prescription — even if a pharmacy will sell it".

- It is a list about **language**: generic names and the brand names people say
  at the counter, in Latin and Devanagari.
- **It contains no doses and no instructions.** "Generally used for" is a
  category word only, for a future "what is this medicine" card.
- **It makes no claim about legal OTC status in Nepal.** That is set by the
  Department of Drug Administration; the tier here is about how firm our
  advisory is, and it errs firmer. Owner: verify against the DDA list before
  any copy says "over the counter".
- Brand names are those commonly heard; presence is not endorsement.

Owner direction 2026-08-19: "list OTC medicines commonly taken in Nepal and
match that, but with disclaimer to contact physician."

## The list (67 entries)

| Generic (en) | नाम (ne) | Generally used for | प्रयोग | Tier | Brand names recognised |
|---|---|---|---|---|---|
| paracetamol | प्यारासिटामोल | pain / fever | दुखाइ / ज्वरो | otc | acetaminophen, niko, calpol, fevago |
| ibuprofen | आइबुप्रोफेन | pain / inflammation | दुखाइ / सुन्निने | otc | brufen, flexon, combiflam |
| diclofenac | डाइक्लोफेनाक | pain / inflammation | दुखाइ / सुन्निने | otc | voveran, diclogem |
| aspirin | एस्पिरिन | pain / fever | दुखाइ / ज्वरो | otc | disprin |
| mefenamic acid | मेफेनामिक एसिड | pain / period pain | दुखाइ / महिनावारीको दुखाइ | otc | meftal |
| nimesulide | निमेसुलाइड | pain / fever | दुखाइ / ज्वरो | **prescription** | nimulid, nise |
| tramadol | ट्रामाडोल | strong pain | कडा दुखाइ | **prescription** |  |
| pain-relief balm | दुखाइको मलम | muscle / joint pain (topical) | मांसपेशी / जोर्नीको दुखाइ (बाहिरी) | otc | moov, volini, zandu balm, iodex, vaporub |
| cetirizine | सेटिरिजिन | allergy / runny nose | एलर्जी / रुघा | otc | cetzine, alerid |
| levocetirizine | लेभोसेटिरिजिन | allergy | एलर्जी | otc |  |
| chlorpheniramine | क्लोरफेनिरामिन | allergy / cold | एलर्जी / रुघा | otc | cpm |
| loratadine | लोराटाडिन | allergy | एलर्जी | otc |  |
| cold and flu tablet | रुघाखोकीको चक्की | cold / flu symptoms | रुघाखोकीका लक्षण | otc | sinex, coldarin, d-?cold, wikoryl, cheston |
| cough syrup | खोकीको सिरप | cough | खोकी | otc | benadryl, ascoril, grilinctus, kofol |
| codeine cough syrup | कोडिन भएको खोकीको सिरप | cough (contains codeine) | खोकी (कोडिन भएको) | **prescription** | corex |
| throat lozenge | घाँटीको लोजेन्ज | sore throat | घाँटी दुख्ने | otc | strepsils, halls |
| salbutamol | साल्बुटामोल | asthma / breathing (inhaler) | दम / सास (इन्हेलर) | **prescription** | albuterol, asthalin |
| montelukast | मोन्टेलुकास्ट | asthma / allergy | दम / एलर्जी | **prescription** |  |
| ORS | जीवनजल (ORS) | dehydration / diarrhoea | पानीको कमी / झाडापखाला | otc | oral rehydration |
| zinc | जिंक | diarrhoea in children (with ORS) | बच्चाको झाडापखाला (जीवनजलसँग) | otc |  |
| omeprazole | ओमेप्राजोल | acidity / gastritis | अमिलो / ग्यास्ट्रिक | otc | omez, ocid |
| pantoprazole | प्यान्टोप्राजोल | acidity / gastritis | अमिलो / ग्यास्ट्रिक | otc | pan-?d |
| ranitidine | रेनिटिडिन | acidity | अमिलो | otc | zinetac, rantac |
| antacid | एन्टासिड | acidity / heartburn | अमिलो / छाती पोल्ने | otc | gelusil, digene, eno |
| domperidone | डोम्पेरिडोन | nausea | वाकवाकी | otc | domstal |
| ondansetron | ओन्डान्सेट्रोन | vomiting | बान्ता | **prescription** | emeset, ondem |
| loperamide | लोपेरामाइड | diarrhoea (adults) | झाडापखाला (वयस्क) | otc | imodium |
| isabgol (psyllium) | इसबगोल | constipation | कब्जियत | otc |  |
| lactulose | ल्याक्टुलोज | constipation | कब्जियत | otc | duphalac |
| bisacodyl | बिसाकोडिल | constipation | कब्जियत | otc | dulcolax |
| metronidazole | मेट्रोनिडाजोल | antibiotic (gut / dental infections) | एन्टिबायोटिक (पेट / दाँतको संक्रमण) | **prescription** | flagyl, metrogyl |
| albendazole | एल्बेन्डाजोल | deworming | जुका | otc | zentel |
| mebendazole | मेबेन्डाजोल | deworming | जुका | otc |  |
| iron / folic acid | आइरन / फोलिक एसिड | anaemia / pregnancy supplement | रक्तअल्पता / गर्भावस्थाको पूरक | otc | ferrous |
| calcium | क्याल्सियम | bones / supplement | हड्डी / पूरक | otc | shelcal |
| vitamin C | भिटामिन सी | supplement | पूरक | otc | limcee, ascorbic |
| vitamin B complex | भिटामिन बी कम्प्लेक्स | supplement | पूरक | otc | becosules |
| vitamin D | भिटामिन डी | supplement | पूरक | otc | cholecalciferol |
| multivitamin | मल्टिभिटामिन | supplement | पूरक | otc |  |
| clotrimazole | क्लोट्रिमाजोल | fungal skin infection (cream) | छालाको ढुसी (क्रिम) | otc | candid |
| povidone-iodine | पोभिडोन आयोडिन | antiseptic for wounds | घाउको एन्टिसेप्टिक | otc | betadine |
| antiseptic liquid | एन्टिसेप्टिक झोल | cleaning wounds | घाउ सफा गर्ने | otc | dettol, savlon |
| calamine | क्यालामाइन | itching / rash (lotion) | चिलाउने / डाबर (लोसन) | otc |  |
| permethrin | पर्मेथ्रिन | scabies / lice | लुतो / जुम्रा | otc | scabper |
| betamethasone (steroid cream) | बेटामेथासोन (स्टेरोइड क्रिम) | skin inflammation (steroid) | छालाको सुजन (स्टेरोइड) | **prescription** | betnovate, clobetasol, dermovate |
| prednisolone | प्रेड्निसोलोन | steroid (many uses) | स्टेरोइड (धेरै प्रयोग) | **prescription** | prednisone, wysolone |
| amoxicillin | एमोक्सिसिलिन | antibiotic | एन्टिबायोटिक | **prescription** | amoxycillin, amoxil, novamox |
| azithromycin | एजिथ्रोमाइसिन | antibiotic | एन्टिबायोटिक | **prescription** | azithral |
| ciprofloxacin | सिप्रोफ्लोक्सासिन | antibiotic | एन्टिबायोटिक | **prescription** | ciplox, cifran |
| ofloxacin | ओफ्लोक्सासिन | antibiotic | एन्टिबायोटिक | **prescription** | zanocin |
| cefixime | सेफिक्सिम | antibiotic | एन्टिबायोटिक | **prescription** | taxim-?o |
| doxycycline | डक्सिसाइक्लिन | antibiotic | एन्टिबायोटिक | **prescription** |  |
| cotrimoxazole | कोट्रिमोक्साजोल | antibiotic | एन्टिबायोटिक | **prescription** | co-?trimoxazole, septran, bactrim |
| diazepam | डायजेपाम | sedative / anxiety | निद्रा / चिन्ता | **prescription** | valium, calmpose |
| alprazolam | अल्प्राजोलाम | sedative / anxiety | निद्रा / चिन्ता | **prescription** | alprax, restyl |
| emergency contraceptive pill | आपतकालीन गर्भनिरोधक चक्की | emergency contraception | आपतकालीन गर्भनिरोध | **prescription** | i-?pill |
| oral contraceptive pill | गर्भनिरोधक चक्की | contraception | गर्भनिरोध | **prescription** | birth control pill, nilocon |
| misoprostol | मिसोप्रोस्टोल | medical abortion / obstetric use | औषधीय गर्भपतन / प्रसूति प्रयोग | **prescription** | mifepristone |
| metformin | मेटफर्मिन | diabetes | मधुमेह | **prescription** | glycomet |
| glimepiride | ग्लिमेपिराइड | diabetes | मधुमेह | **prescription** | amaryl |
| insulin | इन्सुलिन | diabetes | मधुमेह | **prescription** |  |
| amlodipine | एम्लोडिपिन | blood pressure | रक्तचाप | **prescription** | amlong, amlip |
| losartan | लोसार्टान | blood pressure | रक्तचाप | **prescription** |  |
| telmisartan | टेल्मिसार्टान | blood pressure | रक्तचाप | **prescription** | telma |
| atenolol | एटेनोलोल | blood pressure / heart | रक्तचाप / मुटु | **prescription** |  |
| atorvastatin | एटोरभास्टाटिन | cholesterol | कोलेस्ट्रोल | **prescription** | rosuvastatin |
| levothyroxine | लेभोथाइरोक्सिन | thyroid | थाइरोइड | **prescription** | thyronorm, eltroxin |

## How the advisory reads

- **prescription** — यो जानकारी अनुसन्धान र बुझाइका लागि मात्र हो। {औषधि}
  चिकित्सकको प्रेस्क्रिप्सन (सिफारिस पुर्जा) बिना नलिनुहोस् — पसलमा पाइए पनि। मात्रा,
  अवधि र तपाईंका लागि उपयुक्तता चिकित्सक वा अधिकृत स्वास्थ्यकर्मीले मात्र तोक्न सक्छन्।
- **medicine (OTC-tier)** — यो जानकारी अनुसन्धान र बुझाइका लागि मात्र हो। {औषधि}
  लिनुअघि चिकित्सक वा अधिकृत स्वास्थ्यकर्मीलाई भेट्नुहोस्।
- **advice (no medicine named)** — … कुनै पनि औषधि लिनु वा यो सल्लाह पालना
  गर्नुअघि चिकित्सक वा अधिकृत स्वास्थ्यकर्मीलाई भेट्नुहोस्।

The advisory is deterministic (word-list), attached by the route, rendered
under the answer, spoken aloud in voice mode, and saved in the transcript.
The model never writes it.
