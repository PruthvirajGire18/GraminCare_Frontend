import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const LANGUAGE_STORAGE_KEY = 'fieldsync-language'
const SUPPORTED_LANGUAGES = ['en', 'hi', 'mr']
const LOCALES = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' }

const translations = {
  hi: {
    'Doctor care updates': 'डॉक्टर द्वारा दी गई देखभाल', 'Refresh updates': 'जानकारी फिर से लोड करें', 'Loading doctor updates...': 'डॉक्टर की जानकारी लोड हो रही है...',
    'No doctor care updates yet.': 'अभी डॉक्टर की ओर से कोई जानकारी नहीं है।', 'Doctor care updates are available when you are online.': 'डॉक्टर की जानकारी देखने के लिए इंटरनेट से जुड़ें।', 'Doctor care updates could not be loaded.': 'डॉक्टर की जानकारी लोड नहीं हो सकी।',
    'Prescriptions': 'दवाइयाँ', 'Consultation care plans': 'डॉक्टर की उपचार योजना', 'Doctor referrals': 'डॉक्टर के रेफ़रल', 'Assessment:': 'जाँच:', 'Treatment plan:': 'उपचार योजना:',
    'Dosage:': 'खुराक:', 'Frequency:': 'कितनी बार:', 'Duration:': 'अवधि:', 'Instructions:': 'निर्देश:', 'Prescription notes:': 'दवा संबंधी टिप्पणी:', 'Referral reason:': 'रेफ़रल का कारण:', 'Status:': 'स्थिति:', 'No prescription items recorded.': 'दवा का विवरण दर्ज नहीं है।',
    'Workspace navigation': 'कार्य क्षेत्र नेविगेशन', 'Overview': 'अवलोकन', 'Patients': 'मरीज़', 'Sync status': 'सिंक स्थिति',
    'Cases': 'मामले', 'Review conflicts': 'टकराव की समीक्षा', 'User management': 'उपयोगकर्ता प्रबंधन', 'Audit log': 'ऑडिट लॉग',
    'Choose language': 'भाषा चुनें',
    'Language': 'भाषा',
    'Sign out': 'साइन आउट', 'Sign in': 'साइन इन', 'Request access': 'प्रवेश का अनुरोध करें',
    'ASHA Worker': 'आशा कार्यकर्ता', 'Doctor': 'डॉक्टर', 'Admin': 'प्रशासक',
    'Offline-first rural telemedicine': 'ग्रामीण टेलीमेडिसिन, ऑफ़लाइन सुविधा के साथ',
    'Network and synchronization status': 'नेटवर्क और सिंक स्थिति', 'Synchronization queue totals': 'सिंक कतार की संख्या',
    'Online': 'ऑनलाइन', 'Offline': 'ऑफ़लाइन', 'Syncing': 'सिंक हो रहा है', 'Pending:': 'बाकी:', 'Synced:': 'सिंक हुए:', 'Failed:': 'विफल:', 'Conflict:': 'टकराव:',
    'FieldSync project foundation': 'FieldSync परियोजना आधार', 'Care teams, connected with care': 'देखभाल दल, बेहतर देखभाल के लिए जुड़े हुए',
    'ASHA worker workspace': 'आशा कार्यकर्ता कार्यक्षेत्र', 'Field overview': 'फील्ड का अवलोकन', 'Patient actions': 'मरीज़ से जुड़े कार्य',
    'Register patient': 'मरीज़ का पंजीकरण करें', 'Search patients': 'मरीज़ खोजें', 'Sync details': 'सिंक का विवरण',
    'My patients': 'मेरे मरीज़', "Today's visits": 'आज की मुलाक़ातें', 'Follow-ups due': 'आगामी फ़ॉलो-अप', 'Active referrals': 'सक्रिय रेफ़रल',
    'Pending sync': 'सिंक बाकी', 'Waiting to sync': 'सिंक होने की प्रतीक्षा में', 'Saved on this device': 'इस डिवाइस पर सहेजा गया',
    'Care coordination': 'देखभाल समन्वय', 'Referral Generated': 'रेफ़रल बनाया गया', 'Patient:': 'मरीज़:', 'Priority:': 'प्राथमिकता:',
    'Destination:': 'गंतव्य:', 'Created': 'बनाया गया', 'Expires': 'समाप्ति', 'Loading QR…': 'QR लोड हो रहा है…', 'View QR': 'QR देखें',
    'Secure referral QR for': 'के लिए सुरक्षित रेफ़रल QR', 'Show this QR to the receiving doctor. They can scan it from their signed-in FieldSync dashboard to view the patient record. The code expires in 7 days and works once.': 'यह QR मरीज को दें ताकि वह इसे इलाज करने वाले डॉक्टर को दिखा सके। डॉक्टर अपने FieldSync डैशबोर्ड में साइन इन करके इसे स्कैन कर मरीज का रिकॉर्ड देख सकते हैं। कोड 7 दिनों में समाप्त हो जाता है और एक बार उपयोग होता है।',
    'Close QR': 'QR बंद करें', 'Follow-up due': 'फ़ॉलो-अप बाकी', 'Follow-up visit required': 'फ़ॉलो-अप मुलाक़ात ज़रूरी है', 'Follow-up overdue': 'फ़ॉलो-अप की तारीख निकल गई', 'Follow-up missed': 'फ़ॉलो-अप छूट गया', 'Due': 'नियत तारीख', 'priority': 'प्राथमिकता', 'Doctor follow-up': 'डॉक्टर का फ़ॉलो-अप', 'Existing visit follow-up': 'पिछली मुलाक़ात का फ़ॉलो-अप',
    'date not set': 'तारीख तय नहीं', 'Record follow-up': 'फ़ॉलो-अप दर्ज करें', 'Open patient': 'मरीज़ का रिकॉर्ड खोलें',
    'Notifications': 'सूचनाएँ', 'Recent reminders': 'हाल के रिमाइंडर', 'First step': 'पहला कदम', 'Start with a patient record': 'मरीज़ का रिकॉर्ड बनाकर शुरू करें',
    'Register a patient to begin recording visits and follow-ups.': 'मुलाक़ात और फ़ॉलो-अप दर्ज करने के लिए मरीज़ का पंजीकरण करें।', 'Register your first patient': 'अपने पहले मरीज़ का पंजीकरण करें',
    'Back to patients': 'मरीज़ों की सूची पर जाएँ', 'New patient': 'नया मरीज़', 'Patient details': 'मरीज़ का विवरण',
    'Demographic information is stored separately from visit records.': 'जनसांख्यिकीय जानकारी मुलाक़ात के रिकॉर्ड से अलग रखी जाती है।',
    'Full name': 'पूरा नाम', 'Required': 'ज़रूरी', 'Date of birth': 'जन्म तिथि', 'Gender': 'लिंग', 'Not specified': 'निर्दिष्ट नहीं',
    'Female': 'महिला', 'Male': 'पुरुष', 'Other': 'अन्य', 'Phone number': 'फ़ोन नंबर', 'Village': 'गाँव', 'District': 'ज़िला', 'State': 'राज्य', 'Address details': 'पते का विवरण',
    'Saving patient...': 'मरीज़ का रिकॉर्ड सहेजा जा रहा है…', 'Save patient': 'मरीज़ का रिकॉर्ड सहेजें',
    'Patient saved. Sync status will update shortly.': 'मरीज़ का रिकॉर्ड सहेज लिया गया। सिंक स्थिति जल्द अपडेट होगी।',
    'Patient saved on this device; it will sync when online.': 'मरीज़ का रिकॉर्ड इस डिवाइस पर सहेजा गया है; ऑनलाइन होने पर सिंक होगा।',
    'Patient could not be registered. Check your connection and try again.': 'मरीज़ का पंजीकरण नहीं हो सका। कनेक्शन जाँचकर फिर कोशिश करें।',
    'Patient records': 'मरीज़ के रिकॉर्ड', 'Search by name or phone': 'नाम या फ़ोन से खोजें', 'Search': 'खोजें',
    'Loading patients...': 'मरीज़ों के रिकॉर्ड लोड हो रहे हैं…', 'No phone recorded': 'फ़ोन नंबर दर्ज नहीं है',
    'NO MATCHING RECORDS': 'कोई मिलता-जुलता रिकॉर्ड नहीं', 'No patients found': 'कोई मरीज़ नहीं मिला', 'Your patient list is empty': 'आपकी मरीज़ सूची खाली है',
    'Try another name or phone number.': 'दूसरा नाम या फ़ोन नंबर आज़माएँ।', 'Registered patients will appear here.': 'पंजीकृत मरीज़ यहाँ दिखाई देंगे।',
    'Register a patient': 'मरीज़ का पंजीकरण करें', 'Patients could not be loaded.': 'मरीज़ों के रिकॉर्ड लोड नहीं हो सके।',
    'Patient profile': 'मरीज़ की प्रोफ़ाइल', 'Added': 'जोड़ा गया', 'Record visit': 'मुलाक़ात दर्ज करें', 'DEMOGRAPHICS': 'जनसांख्यिकीय जानकारी',
    'Saving...': 'सहेजा जा रहा है…', 'Save changes': 'बदलाव सहेजें', 'Archive patient': 'मरीज़ का रिकॉर्ड संग्रहित करें',
    'Share with ASHA worker': 'आशा कार्यकर्ता के साथ साझा करें', 'Only an approved ASHA worker can be added to this patient’s care team.': 'केवल स्वीकृत आशा कार्यकर्ता को इस मरीज़ की देखभाल टीम में जोड़ा जा सकता है।',
    'ASHA worker email': 'आशा कार्यकर्ता का ईमेल', 'Sharing...': 'साझा किया जा रहा है…', 'Share patient': 'मरीज़ का रिकॉर्ड साझा करें',
    'ASHA FIELD RECORDS': 'आशा फील्ड रिकॉर्ड', 'Visit history': 'मुलाक़ात का इतिहास', 'Follow-up': 'फ़ॉलो-अप', 'Visit': 'मुलाक़ात',
    'Follow-up completed': 'फ़ॉलो-अप पूरा हुआ', 'Edit field observations': 'फील्ड की टिप्पणियाँ संपादित करें', 'Visit details': 'मुलाक़ात का विवरण',
    'Vitals': 'महत्वपूर्ण संकेत', 'Medical history:': 'चिकित्सा इतिहास:', 'Allergies:': 'एलर्जी:', 'Current medicines:': 'वर्तमान दवाएँ:', 'Observations:': 'टिप्पणियाँ:',
    'No visits recorded yet.': 'अभी तक कोई मुलाक़ात दर्ज नहीं है।', 'Loading patient...': 'मरीज़ का रिकॉर्ड लोड हो रहा है…', 'Patient not found.': 'मरीज़ का रिकॉर्ड नहीं मिला।',
    'Patient profile could not be loaded.': 'मरीज़ की प्रोफ़ाइल लोड नहीं हो सकी।', 'Patient details saved.': 'मरीज़ का विवरण सहेजा गया।',
    'Patient details could not be saved.': 'मरीज़ का विवरण सहेजा नहीं जा सका।', 'Archive this patient? Visit records will be retained.': 'क्या इस मरीज़ का रिकॉर्ड संग्रहित करें? मुलाक़ात के रिकॉर्ड सुरक्षित रहेंगे।',
    'Patient could not be archived.': 'मरीज़ का रिकॉर्ड संग्रहित नहीं हो सका।', 'Patient record shared with the approved ASHA worker.': 'मरीज़ का रिकॉर्ड स्वीकृत आशा कार्यकर्ता के साथ साझा किया गया।', 'Patient could not be shared.': 'मरीज़ का रिकॉर्ड साझा नहीं हो सका।',
    'Back to patient': 'मरीज़ के रिकॉर्ड पर जाएँ', 'ASHA visit record': 'आशा मुलाक़ात रिकॉर्ड', 'Record a visit': 'मुलाक़ात दर्ज करें',
    'Visit observations are recorded separately from doctor consultations.': 'मुलाक़ात की टिप्पणियाँ डॉक्टर के परामर्श से अलग दर्ज की जाती हैं।',
    'Visit type': 'मुलाक़ात का प्रकार', 'Visit date': 'मुलाक़ात की तारीख', 'Scheduled follow-up to complete': 'पूरा करने के लिए निर्धारित फ़ॉलो-अप',
    'Select a scheduled follow-up': 'निर्धारित फ़ॉलो-अप चुनें', 'Existing visit': 'पिछली मुलाक़ात', 'Symptoms / chief complaint': 'लक्षण / मुख्य शिकायत',
    'Symptom details': 'लक्षणों का विवरण', 'Symptom duration': 'लक्षणों की अवधि', 'Days, optional': 'दिन, वैकल्पिक', 'Medical history': 'चिकित्सा इतिहास',
    'One item per line': 'हर पंक्ति में एक जानकारी', 'Allergies': 'एलर्जी', 'One per line': 'हर पंक्ति में एक', 'Current medicines': 'वर्तमान दवाएँ',
    'Temperature (°C)': 'तापमान (°C)', 'Heart rate (bpm)': 'हृदय गति (bpm)', 'Respiratory rate (/min)': 'श्वसन दर (/मिनट)', 'Systolic (mmHg)': 'सिस्टोलिक (mmHg)',
    'Diastolic (mmHg)': 'डायस्टोलिक (mmHg)', 'Oxygen saturation (%)': 'ऑक्सीजन संतृप्ति (%)', 'Weight (kg)': 'वज़न (kg)', 'Height (cm)': 'ऊँचाई (cm)',
    'Observations': 'टिप्पणियाँ', 'Schedule a follow-up': 'फ़ॉलो-अप तय करें', 'Optional': 'वैकल्पिक', 'Saving visit...': 'मुलाक़ात सहेजी जा रही है…',
    'Complete follow-up': 'फ़ॉलो-अप पूरा करें', 'Save visit': 'मुलाक़ात सहेजें', 'Patient could not be loaded.': 'मरीज़ का रिकॉर्ड लोड नहीं हो सका।',
    'Visit saved. Sync status will update shortly.': 'मुलाक़ात सहेजी गई। सिंक स्थिति जल्द अपडेट होगी।', 'Follow-up saved. Sync status will update shortly.': 'फ़ॉलो-अप सहेजा गया। सिंक स्थिति जल्द अपडेट होगी।',
    'Visit saved on this device; it will sync when online.': 'मुलाक़ात इस डिवाइस पर सहेजी गई है; ऑनलाइन होने पर सिंक होगी।', 'Visit could not be saved. Check your connection and try again.': 'मुलाक़ात सहेजी नहीं जा सकी। कनेक्शन जाँचकर फिर कोशिश करें।',
    'Loading visit...': 'मुलाक़ात लोड हो रही है…', 'Visit not found.': 'मुलाक़ात नहीं मिली।', 'Edit field observations': 'फील्ड की टिप्पणियाँ संपादित करें',
    'Your original version is attached to this update. If another worker changed the same field, both values will be preserved for review.': 'इस अपडेट के साथ मूल संस्करण जुड़ा है। यदि किसी अन्य कार्यकर्ता ने वही फ़ील्ड बदली है, तो समीक्षा के लिए दोनों मान सुरक्षित रहेंगे।',
    'Saving update...': 'अपडेट सहेजा जा रहा है…', 'Save field updates': 'फील्ड अपडेट सहेजें', 'Visit update queued; sync status will update shortly.': 'मुलाक़ात का अपडेट कतार में है; सिंक स्थिति जल्द अपडेट होगी।',
    'Visit update saved on this device; it will sync when online.': 'मुलाक़ात का अपडेट इस डिवाइस पर सहेजा गया है; ऑनलाइन होने पर सिंक होगा।', 'Visit could not be updated.': 'मुलाक़ात अपडेट नहीं हो सकी।', 'Visit not found in this patient record': 'इस मरीज़ के रिकॉर्ड में मुलाक़ात नहीं मिली',
    'Back to dashboard': 'डैशबोर्ड पर जाएँ', 'Developer tools': 'डेवलपर टूल', 'Sync queue': 'सिंक कतार', 'Synced': 'सिंक हुआ', 'Sync Failed': 'सिंक विफल',
    'Queued operations': 'कतार में मौजूद ऑपरेशन', 'Operation ID': 'ऑपरेशन ID', 'Record': 'रिकॉर्ड', 'Action': 'कार्य', 'Status': 'स्थिति', 'Retries': 'पुनः प्रयास', 'Updated': 'अपडेट किया गया',
    'Attempts': 'प्रयास', 'Conflicts': 'टकराव', 'Time': 'समय', 'pending operation': 'बाकी ऑपरेशन', 'pending operations': 'बाकी ऑपरेशन', 'changes remain on this device': 'बदलाव इस डिवाइस पर सुरक्षित हैं',
    'Sync now': 'अभी सिंक करें', 'No pending operations.': 'कोई ऑपरेशन कतार में नहीं है।', 'LOCAL INDEXEDDB': 'स्थानीय IndexedDB', 'Sync history': 'सिंक इतिहास',
    'RECENT ACTIVITY': 'हाल की गतिविधि', 'No sync activity yet.': 'अभी तक कोई सिंक गतिविधि नहीं।', 'Checking...': 'जाँच हो रही है…', 'Check status': 'स्थिति जाँचें', 'Retry': 'फिर कोशिश करें',
    'The incoming values are still saved on this device. An administrator or doctor must review these conflicts before later updates can sync.': 'आए हुए मान अभी भी इस डिवाइस पर सुरक्षित हैं। आगे के अपडेट सिंक होने से पहले प्रशासक या डॉक्टर को इन टकरावों की समीक्षा करनी होगी।',
    'Not recorded': 'दर्ज नहीं',
    'Patient details are required': 'मरीज़ का विवरण देना ज़रूरी है', 'Full name must be between 2 and 120 characters': 'पूरा नाम 2 से 120 अक्षरों के बीच होना चाहिए',
    'Select a valid gender': 'मान्य लिंग चुनें', 'Enter a valid phone number': 'मान्य फ़ोन नंबर दर्ज करें', 'Address must be an object': 'पते का विवरण मान्य नहीं है',
    'Visit details are required': 'मुलाक़ात का विवरण देना ज़रूरी है', 'Select a valid visit type': 'मान्य मुलाक़ात प्रकार चुनें', 'Chief complaint must be between 2 and 1000 characters': 'मुख्य शिकायत 2 से 1000 अक्षरों के बीच होनी चाहिए',
    'Symptom details are too long': 'लक्षणों का विवरण बहुत लंबा है', 'Symptom duration must be a whole number from 0 to 365 days': 'लक्षणों की अवधि 0 से 365 दिनों की पूर्ण संख्या होनी चाहिए',
    'A follow-up must complete one scheduled item': 'फ़ॉलो-अप में एक निर्धारित कार्य पूरा होना चाहिए', 'Select the scheduled item this follow-up completes': 'यह फ़ॉलो-अप किस निर्धारित कार्य को पूरा करता है, चुनें',
    'Select a valid doctor follow-up': 'डॉक्टर का मान्य फ़ॉलो-अप चुनें', 'An initial visit cannot complete another visit': 'पहली मुलाक़ात से दूसरी मुलाक़ात पूरी नहीं की जा सकती',
    'Vitals must be an object': 'महत्वपूर्ण संकेतों का विवरण मान्य नहीं है', 'Diastolic blood pressure must be lower than systolic blood pressure': 'डायस्टोलिक रक्तचाप सिस्टोलिक रक्तचाप से कम होना चाहिए', 'Observations are too long': 'टिप्पणियाँ बहुत लंबी हैं',
    'Full name': 'पूरा नाम', 'Chief complaint': 'मुख्य शिकायत', 'Date of birth': 'जन्म तिथि', 'Visit date': 'मुलाक़ात की तारीख', 'Follow-up date': 'फ़ॉलो-अप की तारीख',
    'village': 'गाँव', 'district': 'ज़िला', 'state': 'राज्य', 'details': 'पते का विवरण', 'Medical history': 'चिकित्सा इतिहास', 'Current medicines': 'वर्तमान दवाएँ',
    'Temperature': 'तापमान', 'Heart rate': 'हृदय गति', 'Respiratory rate': 'श्वसन दर', 'Systolic': 'सिस्टोलिक', 'Diastolic': 'डायस्टोलिक', 'Oxygen saturation': 'ऑक्सीजन संतृप्ति', 'Weight': 'वज़न', 'Height': 'ऊँचाई',
    'FieldSync home': 'FieldSync मुख्य पृष्ठ', 'Account navigation': 'खाता नेविगेशन', 'Field activity': 'मैदानी गतिविधि', 'Back to': 'वापस जाएँ', 'Version': 'संस्करण', 'ASHA visit': 'आशा मुलाक़ात',
    'Patient': 'मरीज़', 'Create': 'बनाएँ', 'Update': 'अपडेट करें', 'Archive': 'संग्रहित करें', 'Syncing...': 'सिंक हो रहा है…', 'current': 'वर्तमान', 'incoming': 'आने वाला',
    'Vitals:': 'महत्वपूर्ण संकेत:', 'PENDING': 'बाकी', 'MISSED': 'छूटा हुआ', 'HIGH': 'उच्च', 'MEDIUM': 'मध्यम', 'LOW': 'कम', 'CRITICAL': 'गंभीर',
    'ROUTINE': 'सामान्य', 'NORMAL': 'सामान्य', 'URGENT': 'तत्काल', 'EMERGENCY': 'आपातकाल', 'Invalid request data': 'अनुरोध का विवरण मान्य नहीं है',
    'Phone number contains invalid characters': 'फ़ोन नंबर में अमान्य अक्षर हैं', 'Unable to store this visit on this device': 'इस डिवाइस पर मुलाक़ात सहेजी नहीं जा सकी', 'Network Error': 'नेटवर्क कनेक्शन उपलब्ध नहीं है', 'Failed to fetch': 'नेटवर्क कनेक्शन उपलब्ध नहीं है', 'Internal server error': 'सर्वर में त्रुटि हुई है',
    'Dashboard data could not be loaded.': 'डैशबोर्ड का विवरण लोड नहीं हो सका।', 'Referral QR could not be loaded.': 'रेफ़रल QR लोड नहीं हो सका।', 'Referral invalid or expired.': 'रेफ़रल अमान्य है या उसकी अवधि समाप्त हो गई है।', 'Visit could not be loaded.': 'मुलाक़ात लोड नहीं हो सकी।',
    'Choose the scheduled item this follow-up completes': 'यह फ़ॉलो-अप किस निर्धारित मुलाक़ात को पूरा करता है, चुनें', 'No pending operations.': 'कोई ऑपरेशन कतार में नहीं है।',
    'Patient version changed; reload before updating': 'मरीज़ की जानकारी बदल गई है; अपडेट करने से पहले फिर से लोड करें', 'Patient is already archived': 'मरीज़ का रिकॉर्ड पहले से संग्रहित है',
    'Gender is invalid': 'लिंग का मान मान्य नहीं है', 'Visit type must be INITIAL or FOLLOW_UP': 'मुलाक़ात का प्रकार INITIAL या FOLLOW_UP होना चाहिए',
    'A follow-up visit must reference the scheduled item it completes': 'फ़ॉलो-अप मुलाक़ात में पूरा किए जाने वाले निर्धारित काम का संदर्भ होना चाहिए',
    'Only the patient record owner can share it': 'केवल मरीज़ के रिकॉर्ड का मालिक इसे साझा कर सकता है', 'Patient changed before sharing; reload the profile': 'साझा करने से पहले मरीज़ की जानकारी बदल गई है; प्रोफ़ाइल फिर से लोड करें',
    'Approved ASHA worker not found': 'स्वीकृत आशा कार्यकर्ता नहीं मिला', 'The scheduled follow-up was not found or was already completed': 'निर्धारित फ़ॉलो-अप नहीं मिला या पहले ही पूरा हो चुका है',
    'The doctor follow-up was not found or was already completed': 'डॉक्टर का फ़ॉलो-अप नहीं मिला या पहले ही पूरा हो चुका है', 'This doctor follow-up has already been completed': 'डॉक्टर का यह फ़ॉलो-अप पहले ही पूरा हो चुका है',
    'Unlock offline records with your account password': 'ऑफ़लाइन रिकॉर्ड खोलने के लिए अपने खाते का पासवर्ड दर्ज करें', 'Patient is not available in this device cache': 'इस डिवाइस में मरीज़ का रिकॉर्ड उपलब्ध नहीं है',
    'Patient must sync before its visit': 'मुलाक़ात दर्ज करने से पहले मरीज़ का रिकॉर्ड सिंक होना चाहिए', 'Scheduled visit must sync before its follow-up': 'फ़ॉलो-अप से पहले निर्धारित मुलाक़ात सिंक होनी चाहिए',
    'This doctor follow-up is already recorded on this device': 'डॉक्टर का यह फ़ॉलो-अप इस डिवाइस पर पहले से दर्ज है', 'An approved ASHA worker session is required': 'स्वीकृत आशा कार्यकर्ता खाते से साइन इन करें',
    'An authenticated ASHA worker session is required for offline records': 'ऑफ़लाइन रिकॉर्ड के लिए आशा कार्यकर्ता खाते से साइन इन करें', 'Secure browser cryptography is unavailable. Open FieldSync in a supported browser over HTTPS or localhost.': 'सुरक्षित ब्राउज़र सुविधा उपलब्ध नहीं है। FieldSync को HTTPS या localhost पर समर्थित ब्राउज़र में खोलें।',
    ' is too long': ' बहुत लंबा है', ' must be between ': ' का मान होना चाहिए: ',
  },
  mr: {
    'Doctor care updates': 'डॉक्टरांनी दिलेली उपचार माहिती', 'Refresh updates': 'माहिती पुन्हा लोड करा', 'Loading doctor updates...': 'डॉक्टरांची माहिती लोड होत आहे...',
    'No doctor care updates yet.': 'अद्याप डॉक्टरांकडून कोणतीही माहिती नाही.', 'Doctor care updates are available when you are online.': 'डॉक्टरांची माहिती पाहण्यासाठी इंटरनेटशी कनेक्ट करा.', 'Doctor care updates could not be loaded.': 'डॉक्टरांची माहिती लोड करता आली नाही.',
    'Prescriptions': 'औषधांची चिठ्ठी', 'Consultation care plans': 'डॉक्टरांची उपचार योजना', 'Doctor referrals': 'डॉक्टरांचे संदर्भ', 'Assessment:': 'तपासणी:', 'Treatment plan:': 'उपचार योजना:',
    'Dosage:': 'मात्रा:', 'Frequency:': 'किती वेळा:', 'Duration:': 'कालावधी:', 'Instructions:': 'सूचना:', 'Prescription notes:': 'औषधांबद्दल नोंद:', 'Referral reason:': 'संदर्भाचे कारण:', 'Status:': 'स्थिती:', 'No prescription items recorded.': 'औषधांचा तपशील नोंदवलेला नाही.',
    'Workspace navigation': 'कार्य क्षेत्र नेव्हिगेशन', 'Overview': 'आढावा', 'Patients': 'रुग्ण', 'Sync status': 'सिंक स्थिती',
    'Cases': 'प्रकरणे', 'Review conflicts': 'विसंगतींचे पुनरावलोकन', 'User management': 'वापरकर्ता व्यवस्थापन', 'Audit log': 'ऑडिट नोंद',
    'Choose language': 'भाषा निवडा', 'Language': 'भाषा',
    'Sign out': 'साइन आउट', 'Sign in': 'साइन इन', 'Request access': 'प्रवेशासाठी विनंती करा',
    'ASHA Worker': 'आशा कार्यकर्ता', 'Doctor': 'डॉक्टर', 'Admin': 'प्रशासक',
    'Offline-first rural telemedicine': 'ऑफलाइन सुविधेसह ग्रामीण टेलिमेडिसिन',
    'Network and synchronization status': 'नेटवर्क आणि सिंक स्थिती', 'Synchronization queue totals': 'सिंक रांगेची संख्या',
    'Online': 'ऑनलाइन', 'Offline': 'ऑफलाइन', 'Syncing': 'सिंक होत आहे', 'Pending:': 'प्रलंबित:', 'Synced:': 'सिंक झाले:', 'Failed:': 'अयशस्वी:', 'Conflict:': 'विसंगती:',
    'FieldSync project foundation': 'FieldSync प्रकल्पाचा पाया', 'Care teams, connected with care': 'काळजी घेणारे पथक, सेवेसाठी जोडलेले',
    'ASHA worker workspace': 'आशा कार्यकर्ता कार्यक्षेत्र', 'Field overview': 'फील्डचा आढावा', 'Patient actions': 'रुग्णाशी संबंधित कृती',
    'Register patient': 'रुग्णाची नोंदणी करा', 'Search patients': 'रुग्ण शोधा', 'Sync details': 'सिंक तपशील',
    'My patients': 'माझे रुग्ण', "Today's visits": 'आजच्या भेटी', 'Follow-ups due': 'पुढील पाठपुरावा', 'Active referrals': 'सक्रिय संदर्भ',
    'Pending sync': 'सिंक प्रलंबित', 'Waiting to sync': 'सिंकची प्रतीक्षा', 'Saved on this device': 'या उपकरणावर जतन केले',
    'Care coordination': 'सेवा समन्वय', 'Referral Generated': 'संदर्भ तयार केला', 'Patient:': 'रुग्ण:', 'Priority:': 'प्राधान्य:',
    'Destination:': 'गंतव्य:', 'Created': 'तयार केले', 'Expires': 'कालबाह्य', 'Loading QR…': 'QR लोड होत आहे…', 'View QR': 'QR पहा',
    'Secure referral QR for': 'यासाठी सुरक्षित संदर्भ QR', 'Show this QR to the receiving doctor. They can scan it from their signed-in FieldSync dashboard to view the patient record. The code expires in 7 days and works once.': 'हा QR रुग्णाला द्या, जेणेकरून तो तो उपचार करणाऱ्या डॉक्टरांना दाखवू शकेल. डॉक्टर त्यांच्या FieldSync डॅशबोर्डमध्ये साइन इन करून QR स्कॅन केल्यावर रुग्णाची नोंद पाहू शकतात. कोड 7 दिवसांनी कालबाह्य होतो आणि एकदाच वापरता येतो.',
    'Close QR': 'QR बंद करा', 'Follow-up due': 'पाठपुरावा बाकी', 'Follow-up visit required': 'पाठपुराव्याची भेट आवश्यक आहे', 'Follow-up overdue': 'पाठपुराव्याची तारीख उलटली', 'Follow-up missed': 'पाठपुरावा चुकला', 'Due': 'नियोजित तारीख', 'priority': 'प्राधान्य', 'Doctor follow-up': 'डॉक्टरचा पाठपुरावा', 'Existing visit follow-up': 'मागील भेटीचा पाठपुरावा',
    'date not set': 'तारीख ठरलेली नाही', 'Record follow-up': 'पाठपुरावा नोंदवा', 'Open patient': 'रुग्णाची नोंद उघडा',
    'Notifications': 'सूचना', 'Recent reminders': 'अलीकडील स्मरणपत्रे', 'First step': 'पहिले पाऊल', 'Start with a patient record': 'रुग्णाची नोंद करून सुरुवात करा',
    'Register a patient to begin recording visits and follow-ups.': 'भेटी आणि पाठपुरावा नोंदवण्यासाठी रुग्णाची नोंदणी करा.', 'Register your first patient': 'तुमच्या पहिल्या रुग्णाची नोंदणी करा',
    'Back to patients': 'रुग्णांच्या यादीकडे जा', 'New patient': 'नवीन रुग्ण', 'Patient details': 'रुग्णाची माहिती',
    'Demographic information is stored separately from visit records.': 'वैयक्तिक माहिती भेटींच्या नोंदींपासून वेगळी साठवली जाते.',
    'Full name': 'पूर्ण नाव', 'Required': 'आवश्यक', 'Date of birth': 'जन्मतारीख', 'Gender': 'लिंग', 'Not specified': 'नमूद केलेले नाही',
    'Female': 'स्त्री', 'Male': 'पुरुष', 'Other': 'इतर', 'Phone number': 'फोन नंबर', 'Village': 'गाव', 'District': 'जिल्हा', 'State': 'राज्य', 'Address details': 'पत्त्याचा तपशील',
    'Saving patient...': 'रुग्णाची नोंद जतन होत आहे…', 'Save patient': 'रुग्णाची नोंद जतन करा',
    'Patient saved. Sync status will update shortly.': 'रुग्णाची नोंद जतन झाली. सिंक स्थिती लवकरच अद्ययावत होईल.',
    'Patient saved on this device; it will sync when online.': 'रुग्णाची नोंद या उपकरणावर जतन केली आहे; ऑनलाइन झाल्यावर सिंक होईल.',
    'Patient could not be registered. Check your connection and try again.': 'रुग्णाची नोंदणी झाली नाही. कनेक्शन तपासून पुन्हा प्रयत्न करा.',
    'Patient records': 'रुग्णांच्या नोंदी', 'Search by name or phone': 'नाव किंवा फोनने शोधा', 'Search': 'शोधा',
    'Loading patients...': 'रुग्णांच्या नोंदी लोड होत आहेत…', 'No phone recorded': 'फोन नंबर नोंदलेला नाही',
    'NO MATCHING RECORDS': 'जुळणारी नोंद नाही', 'No patients found': 'रुग्ण सापडले नाहीत', 'Your patient list is empty': 'तुमची रुग्ण यादी रिकामी आहे',
    'Try another name or phone number.': 'दुसरे नाव किंवा फोन नंबर वापरून पहा.', 'Registered patients will appear here.': 'नोंदणीकृत रुग्ण येथे दिसतील.',
    'Register a patient': 'रुग्णाची नोंदणी करा', 'Patients could not be loaded.': 'रुग्णांच्या नोंदी लोड झाल्या नाहीत.',
    'Patient profile': 'रुग्णाची प्रोफाइल', 'Added': 'जोडले', 'Record visit': 'भेट नोंदवा', 'DEMOGRAPHICS': 'वैयक्तिक माहिती',
    'Saving...': 'जतन होत आहे…', 'Save changes': 'बदल जतन करा', 'Archive patient': 'रुग्णाची नोंद संग्रहित करा',
    'Share with ASHA worker': 'आशा कार्यकर्त्यासोबत सामायिक करा', 'Only an approved ASHA worker can be added to this patient’s care team.': 'फक्त मान्यताप्राप्त आशा कार्यकर्त्यालाच या रुग्णाच्या सेवा पथकात जोडता येईल.',
    'ASHA worker email': 'आशा कार्यकर्त्याचा ईमेल', 'Sharing...': 'सामायिक होत आहे…', 'Share patient': 'रुग्णाची नोंद सामायिक करा',
    'ASHA FIELD RECORDS': 'आशा फील्ड नोंदी', 'Visit history': 'भेटींचा इतिहास', 'Follow-up': 'पाठपुरावा', 'Visit': 'भेट',
    'Follow-up completed': 'पाठपुरावा पूर्ण', 'Edit field observations': 'फील्ड निरीक्षणे संपादित करा', 'Visit details': 'भेटीचा तपशील',
    'Vitals': 'महत्त्वाची मोजमापे', 'Medical history:': 'वैद्यकीय इतिहास:', 'Allergies:': 'अॅलर्जी:', 'Current medicines:': 'सध्याची औषधे:', 'Observations:': 'निरीक्षणे:',
    'No visits recorded yet.': 'अद्याप कोणतीही भेट नोंदवलेली नाही.', 'Loading patient...': 'रुग्णाची नोंद लोड होत आहे…', 'Patient not found.': 'रुग्णाची नोंद सापडली नाही.',
    'Patient profile could not be loaded.': 'रुग्णाची प्रोफाइल लोड झाली नाही.', 'Patient details saved.': 'रुग्णाची माहिती जतन केली.',
    'Patient details could not be saved.': 'रुग्णाची माहिती जतन झाली नाही.', 'Archive this patient? Visit records will be retained.': 'या रुग्णाची नोंद संग्रहित करायची? भेटींच्या नोंदी जतन राहतील.',
    'Patient could not be archived.': 'रुग्णाची नोंद संग्रहित झाली नाही.', 'Patient record shared with the approved ASHA worker.': 'रुग्णाची नोंद मान्यताप्राप्त आशा कार्यकर्त्यासोबत सामायिक केली.', 'Patient could not be shared.': 'रुग्णाची नोंद सामायिक झाली नाही.',
    'Back to patient': 'रुग्णाच्या नोंदीकडे जा', 'ASHA visit record': 'आशा भेट नोंद', 'Record a visit': 'भेट नोंदवा',
    'Visit observations are recorded separately from doctor consultations.': 'भेटीची निरीक्षणे डॉक्टरांच्या सल्ल्यापासून वेगळी नोंदवली जातात.',
    'Visit type': 'भेटीचा प्रकार', 'Visit date': 'भेटीची तारीख', 'Scheduled follow-up to complete': 'पूर्ण करायचा नियोजित पाठपुरावा',
    'Select a scheduled follow-up': 'नियोजित पाठपुरावा निवडा', 'Existing visit': 'मागील भेट', 'Symptoms / chief complaint': 'लक्षणे / मुख्य तक्रार',
    'Symptom details': 'लक्षणांचा तपशील', 'Symptom duration': 'लक्षणांचा कालावधी', 'Days, optional': 'दिवस, ऐच्छिक', 'Medical history': 'वैद्यकीय इतिहास',
    'One item per line': 'प्रत्येक ओळीत एक नोंद', 'Allergies': 'अॅलर्जी', 'One per line': 'प्रत्येक ओळीत एक', 'Current medicines': 'सध्याची औषधे',
    'Temperature (°C)': 'तापमान (°C)', 'Heart rate (bpm)': 'हृदय गती (bpm)', 'Respiratory rate (/min)': 'श्वसन दर (/मिनिट)', 'Systolic (mmHg)': 'सिस्टोलिक (mmHg)',
    'Diastolic (mmHg)': 'डायस्टोलिक (mmHg)', 'Oxygen saturation (%)': 'ऑक्सिजन संपृक्तता (%)', 'Weight (kg)': 'वजन (kg)', 'Height (cm)': 'उंची (cm)',
    'Observations': 'निरीक्षणे', 'Schedule a follow-up': 'पाठपुरावा नियोजित करा', 'Optional': 'ऐच्छिक', 'Saving visit...': 'भेट जतन होत आहे…',
    'Complete follow-up': 'पाठपुरावा पूर्ण करा', 'Save visit': 'भेट जतन करा', 'Patient could not be loaded.': 'रुग्णाची नोंद लोड झाली नाही.',
    'Visit saved. Sync status will update shortly.': 'भेट जतन झाली. सिंक स्थिती लवकरच अद्ययावत होईल.', 'Follow-up saved. Sync status will update shortly.': 'पाठपुरावा जतन झाला. सिंक स्थिती लवकरच अद्ययावत होईल.',
    'Visit saved on this device; it will sync when online.': 'भेट या उपकरणावर जतन केली आहे; ऑनलाइन झाल्यावर सिंक होईल.', 'Visit could not be saved. Check your connection and try again.': 'भेट जतन झाली नाही. कनेक्शन तपासून पुन्हा प्रयत्न करा.',
    'Loading visit...': 'भेट लोड होत आहे…', 'Visit not found.': 'भेट सापडली नाही.',
    'Your original version is attached to this update. If another worker changed the same field, both values will be preserved for review.': 'या अद्ययावत माहितीसोबत मूळ आवृत्ती जोडली आहे. दुसऱ्या कार्यकर्त्याने तेच क्षेत्र बदलल्यास, पुनरावलोकनासाठी दोन्ही मूल्ये जतन होतील.',
    'Saving update...': 'बदल जतन होत आहेत…', 'Save field updates': 'फील्डमधील बदल जतन करा', 'Visit update queued; sync status will update shortly.': 'भेटीचा बदल रांगेत आहे; सिंक स्थिती लवकरच अद्ययावत होईल.',
    'Visit update saved on this device; it will sync when online.': 'भेटीचा बदल या उपकरणावर जतन केला आहे; ऑनलाइन झाल्यावर सिंक होईल.', 'Visit could not be updated.': 'भेट अद्ययावत करता आली नाही.', 'Visit not found in this patient record': 'या रुग्णाच्या नोंदीत भेट सापडली नाही',
    'Back to dashboard': 'डॅशबोर्डवर जा', 'Developer tools': 'डेव्हलपर साधने', 'Sync queue': 'सिंक रांग', 'Synced': 'सिंक झाले', 'Sync Failed': 'सिंक अयशस्वी',
    'Queued operations': 'रांगेतील क्रिया', 'Operation ID': 'क्रिया ID', 'Record': 'नोंद', 'Action': 'कृती', 'Status': 'स्थिती', 'Retries': 'पुन्हा प्रयत्न', 'Updated': 'अद्ययावत',
    'Attempts': 'प्रयत्न', 'Conflicts': 'विसंगती', 'Time': 'वेळ', 'pending operation': 'प्रलंबित क्रिया', 'pending operations': 'प्रलंबित क्रिया', 'changes remain on this device': 'बदल या उपकरणावर जतन आहेत',
    'Sync now': 'आता सिंक करा', 'No pending operations.': 'रांगेत कोणतीही क्रिया नाही.', 'LOCAL INDEXEDDB': 'स्थानिक IndexedDB', 'Sync history': 'सिंक इतिहास',
    'RECENT ACTIVITY': 'अलीकडील हालचाल', 'No sync activity yet.': 'अद्याप सिंकची कोणतीही हालचाल नाही.', 'Checking...': 'तपासत आहे…', 'Check status': 'स्थिती तपासा', 'Retry': 'पुन्हा प्रयत्न करा',
    'The incoming values are still saved on this device. An administrator or doctor must review these conflicts before later updates can sync.': 'आलेली मूल्ये अजूनही या उपकरणावर जतन आहेत. पुढील बदल सिंक होण्यापूर्वी प्रशासक किंवा डॉक्टरांनी या विसंगतींचे पुनरावलोकन करणे आवश्यक आहे.',
    'Not recorded': 'नोंदवलेले नाही',
    'Patient details are required': 'रुग्णाची माहिती आवश्यक आहे', 'Full name must be between 2 and 120 characters': 'पूर्ण नाव 2 ते 120 अक्षरांचे असावे',
    'Select a valid gender': 'वैध लिंग निवडा', 'Enter a valid phone number': 'वैध फोन नंबर टाका', 'Address must be an object': 'पत्त्याची माहिती वैध नाही',
    'Visit details are required': 'भेटीची माहिती आवश्यक आहे', 'Select a valid visit type': 'वैध भेट प्रकार निवडा', 'Chief complaint must be between 2 and 1000 characters': 'मुख्य तक्रार 2 ते 1000 अक्षरांची असावी',
    'Symptom details are too long': 'लक्षणांचा तपशील खूप मोठा आहे', 'Symptom duration must be a whole number from 0 to 365 days': 'लक्षणांचा कालावधी 0 ते 365 दिवसांचा पूर्णांक असावा',
    'A follow-up must complete one scheduled item': 'पाठपुराव्यात एक नियोजित बाब पूर्ण होणे आवश्यक आहे', 'Select the scheduled item this follow-up completes': 'हा पाठपुरावा कोणती नियोजित बाब पूर्ण करतो ते निवडा',
    'Select a valid doctor follow-up': 'डॉक्टरचा वैध पाठपुरावा निवडा', 'An initial visit cannot complete another visit': 'प्रारंभिक भेटीने दुसरी भेट पूर्ण करता येत नाही',
    'Vitals must be an object': 'महत्त्वाच्या मोजमापांची माहिती वैध नाही', 'Diastolic blood pressure must be lower than systolic blood pressure': 'डायस्टोलिक रक्तदाब सिस्टोलिक रक्तदाबापेक्षा कमी असावा', 'Observations are too long': 'निरीक्षणे खूप मोठी आहेत',
    'Full name': 'पूर्ण नाव', 'Chief complaint': 'मुख्य तक्रार', 'Date of birth': 'जन्मतारीख', 'Visit date': 'भेटीची तारीख', 'Follow-up date': 'पाठपुराव्याची तारीख',
    'village': 'गाव', 'district': 'जिल्हा', 'state': 'राज्य', 'details': 'पत्त्याचा तपशील', 'Medical history': 'वैद्यकीय इतिहास', 'Current medicines': 'सध्याची औषधे',
    'Temperature': 'तापमान', 'Heart rate': 'हृदय गती', 'Respiratory rate': 'श्वसन दर', 'Systolic': 'सिस्टोलिक', 'Diastolic': 'डायस्टोलिक', 'Oxygen saturation': 'ऑक्सिजन संपृक्तता', 'Weight': 'वजन', 'Height': 'उंची',
    'FieldSync home': 'FieldSync मुख्यपृष्ठ', 'Account navigation': 'खाते नेव्हिगेशन', 'Field activity': 'फील्डवरील कामकाज', 'Back to': 'मागे जा', 'Version': 'आवृत्ती', 'ASHA visit': 'आशा भेट',
    'Patient': 'रुग्ण', 'Create': 'तयार करा', 'Update': 'अद्ययावत करा', 'Archive': 'संग्रहित करा', 'Syncing...': 'सिंक होत आहे…', 'current': 'सध्याचे', 'incoming': 'आलेले',
    'Vitals:': 'महत्त्वाची मोजमापे:', 'PENDING': 'प्रलंबित', 'MISSED': 'चुकलेला', 'HIGH': 'उच्च', 'MEDIUM': 'मध्यम', 'LOW': 'कमी', 'CRITICAL': 'गंभीर',
    'ROUTINE': 'नियमित', 'NORMAL': 'सामान्य', 'URGENT': 'तातडीचे', 'EMERGENCY': 'आपत्कालीन', 'Invalid request data': 'विनंतीतील माहिती वैध नाही',
    'Phone number contains invalid characters': 'फोन नंबरमध्ये अमान्य अक्षरे आहेत', 'Network Error': 'नेटवर्क कनेक्शन उपलब्ध नाही', 'Failed to fetch': 'नेटवर्क कनेक्शन उपलब्ध नाही', 'Internal server error': 'सर्व्हरमध्ये त्रुटी झाली आहे',
    'Dashboard data could not be loaded.': 'डॅशबोर्डची माहिती लोड झाली नाही.', 'Referral QR could not be loaded.': 'संदर्भ QR लोड झाला नाही.', 'Referral invalid or expired.': 'संदर्भ अवैध आहे किंवा त्याची मुदत संपली आहे.', 'Visit could not be loaded.': 'भेट लोड झाली नाही.',
    'No pending operations.': 'रांगेत कोणतीही क्रिया नाही.',
    'Patient version changed; reload before updating': 'रुग्णाची माहिती बदलली आहे; अद्ययावत करण्यापूर्वी पुन्हा लोड करा', 'Patient is already archived': 'रुग्णाची नोंद आधीच संग्रहित आहे',
    'Gender is invalid': 'लिंग वैध नाही', 'Visit type must be INITIAL or FOLLOW_UP': 'भेटीचा प्रकार INITIAL किंवा FOLLOW_UP असावा',
    'A follow-up visit must reference the scheduled item it completes': 'पाठपुराव्याच्या भेटीत पूर्ण करायच्या नियोजित कामाचा संदर्भ आवश्यक आहे',
    'Only the patient record owner can share it': 'फक्त रुग्णाच्या नोंदीचा मालक ती सामायिक करू शकतो', 'Patient changed before sharing; reload the profile': 'सामायिक करण्यापूर्वी रुग्णाची माहिती बदलली आहे; प्रोफाइल पुन्हा लोड करा',
    'Approved ASHA worker not found': 'मान्यताप्राप्त आशा कार्यकर्ता सापडला नाही', 'The scheduled follow-up was not found or was already completed': 'नियोजित पाठपुरावा सापडला नाही किंवा आधीच पूर्ण झाला आहे',
    'The doctor follow-up was not found or was already completed': 'डॉक्टरचा पाठपुरावा सापडला नाही किंवा आधीच पूर्ण झाला आहे', 'This doctor follow-up has already been completed': 'डॉक्टरचा हा पाठपुरावा आधीच पूर्ण झाला आहे',
    'Unlock offline records with your account password': 'ऑफलाइन नोंदी उघडण्यासाठी तुमच्या खात्याचा पासवर्ड टाका', 'Patient is not available in this device cache': 'या उपकरणात रुग्णाची नोंद उपलब्ध नाही',
    'Patient must sync before its visit': 'भेट नोंदवण्यापूर्वी रुग्णाची नोंद सिंक झाली पाहिजे', 'Scheduled visit must sync before its follow-up': 'पाठपुराव्यापूर्वी नियोजित भेट सिंक झाली पाहिजे',
    'This doctor follow-up is already recorded on this device': 'डॉक्टरचा हा पाठपुरावा या उपकरणावर आधीच नोंदवला आहे', 'An approved ASHA worker session is required': 'मान्यताप्राप्त आशा कार्यकर्त्याच्या खात्यातून साइन इन करा',
    'An authenticated ASHA worker session is required for offline records': 'ऑफलाइन नोंदींसाठी आशा कार्यकर्त्याच्या खात्यातून साइन इन करा', 'Secure browser cryptography is unavailable. Open FieldSync in a supported browser over HTTPS or localhost.': 'सुरक्षित ब्राउझर सुविधा उपलब्ध नाही. FieldSync HTTPS किंवा localhost वर समर्थित ब्राउझरमध्ये उघडा.',
  },
}

function readSavedLanguage() {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en'
  } catch {
    return 'en'
  }
}

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readSavedLanguage)

  const setLanguage = useCallback((nextLanguage) => {
    if (!SUPPORTED_LANGUAGES.includes(nextLanguage)) return
    setLanguageState(nextLanguage)
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage) } catch { /* Preference remains active for this session. */ }
  }, [])

  const t = useCallback((phrase) => translations[language]?.[phrase] || phrase, [language])
  const locale = LOCALES[language]
  const formatDate = useCallback((value, options) => new Date(value).toLocaleDateString(locale, options), [locale])
  const formatDateTime = useCallback((value, options) => new Date(value).toLocaleString(locale, options), [locale])
  const formatNumber = useCallback((value, options) => new Intl.NumberFormat(locale, options).format(value), [locale])
  const translateError = useCallback((message) => {
    if (!message) return ''
    const exact = t(message)
    if (exact !== message || language === 'en') return exact
    const between = message.match(/^(.+?) must be between (.+?) and (.+?) characters$/i)
    if (between) return language === 'hi'
      ? `${t(between[1])} ${between[2]} से ${between[3]} अक्षरों के बीच होना चाहिए`
      : `${t(between[1])} ${between[2]} ते ${between[3]} अक्षरांचे असावे`
    const fieldRange = message.match(/^([A-Za-z]+) must be between (.+?) and (.+?)$/)
    if (fieldRange) {
      const fieldNames = { temperatureC: 'Temperature', heartRateBpm: 'Heart rate', respiratoryRatePerMinute: 'Respiratory rate', systolicMmHg: 'Systolic', diastolicMmHg: 'Diastolic', oxygenSaturationPercent: 'Oxygen saturation', weightKg: 'Weight', heightCm: 'Height' }
      const fieldName = t(fieldNames[fieldRange[1]] || fieldRange[1])
      return language === 'hi'
        ? `${fieldName} ${fieldRange[2]} से ${fieldRange[3]} के बीच होना चाहिए`
        : `${fieldName} ${fieldRange[2]} ते ${fieldRange[3]} दरम्यान असावे`
    }
    const tooLong = message.match(/^(village|district|state|details) is too long$/i)
    if (tooLong) return language === 'hi' ? `${t(tooLong[1])} बहुत लंबा है` : `${t(tooLong[1])} खूप मोठे आहे`
    const maxLength = message.match(/^(.+?) must be at most (\d+) characters$/i)
    if (maxLength) return language === 'hi'
      ? `${t(maxLength[1])} अधिकतम ${maxLength[2]} अक्षरों का होना चाहिए`
      : `${t(maxLength[1])} जास्तीत जास्त ${maxLength[2]} अक्षरांचे असावे`
    const listLimit = message.match(/^(.+?) must be a list of at most (\d+) items$/i)
    if (listLimit) return language === 'hi'
      ? `${t(listLimit[1])} की सूची में अधिकतम ${listLimit[2]} जानकारी हो सकती है`
      : `${t(listLimit[1])} यादीत जास्तीत जास्त ${listLimit[2]} नोंदी असू शकतात`
    const listItem = message.match(/^(.+?) item (\d+) is invalid$/i)
    if (listItem) return language === 'hi'
      ? `${t(listItem[1])} की ${listItem[2]}वीं जानकारी मान्य नहीं है`
      : `${t(listItem[1])} मधील ${listItem[2]}वी नोंद वैध नाही`
    const dateError = message.match(/^(Date of birth|Visit date|Follow-up date) (must be a valid date|cannot be in the future)$/)
    if (dateError) {
      const field = t(dateError[1])
      if (language === 'hi') return dateError[2] === 'must be a valid date' ? `${field} मान्य तारीख होनी चाहिए` : `${field} भविष्य की तारीख नहीं हो सकती`
      return dateError[2] === 'must be a valid date' ? `${field} वैध तारीख असावी` : `${field} भविष्यातील तारीख असू शकत नाही`
    }
    return message
  }, [language, t])

  useEffect(() => {
    document.documentElement.lang = language === 'hi' ? 'hi' : language === 'mr' ? 'mr' : 'en'
  }, [language])

  const value = useMemo(() => ({ language, setLanguage, t, translateError, formatDate, formatDateTime, formatNumber }), [language, setLanguage, t, translateError, formatDate, formatDateTime, formatNumber])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider')
  return context
}
