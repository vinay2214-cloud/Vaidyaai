# WhatsApp Message Templates across Telugu (te), Hindi (hi), English (en), Tamil (ta)

CONFIRMATION_TEMPLATES = {
    "te": "మీ అపాయింట్‌మెంట్ నిర్ధారించబడింది!\nడాక్టర్: {doctor_name}\nతేదీ: {date}\nసమయం: {time}\nక్రమ సంఖ్య: #{queue_number}\n{clinic_name}",
    "hi": "आपका अपॉइंटमेंट बुक हो गया!\nडॉक्टर: {doctor_name}\nतारीख: {date}\nसमय: {time}\nनंबर: #{queue_number}\n{clinic_name}",
    "en": "Appointment Confirmed!\nDoctor: {doctor_name}\nDate: {date}\nTime: {time}\nQueue: #{queue_number}\n{clinic_name}",
    "ta": "உங்கள் சந்திப்பு உறுதிசெய்யப்பட்டது!\nமருத்துவர்: {doctor_name}\nதேதி: {date}\nநேரம்: {time}\nவரிசை: #{queue_number}\n{clinic_name}"
}

REMINDER_TEMPLATES = {
    "te": "గుర్తుచేయడం: మీ అపాయింట్‌మెంట్ 2 గంటల్లో ఉంది.\nసమయం: {time}\nవరుస స్థానం: #{queue_position}\n{doctor_display} క్లినిక్",
    "hi": "याद दिलाना: 2 घंटे में आपका अपॉइंटमेंट है।\nसमय: {time}\nनंबर: #{queue_position}\n{doctor_display}",
    "en": "Reminder: Your appointment with {doctor_display} is in 2 hours.\nTime: {time} | Queue: #{queue_position}",
    "ta": "நினைவூட்டல்: 2 மணி நேரத்தில் சந்திப்பு.\nநேரம்: {time} | வரிசை: #{queue_position}"
}

WELLNESS_TEMPLATES = {
    "te": "నమస్కారం! {doctor_display} టీమ్ మీ ఆరోగ్యం గురించి ఆందోళన చెందుతోంది. మీరు ఇప్పుడు ఎలా అనుభవిస్తున్నారు?",
    "hi": "नमस्ते! {doctor_display} की टीम आपकी सेहत की परवाह करती है। आप अभी कैसा महसूस कर रहे हैं?",
    "en": "Hello! {doctor_display}'s team is checking in. How are you feeling today?",
    "ta": "வணக்கம்! {doctor_display} குழு உங்கள் உடல்நலம் பற்றி அக்கறை கொள்கிறது. இப்போது எப்படி இருக்கிறீர்கள்?"
}

EMERGENCY_TEMPLATES = {
    "te": "అత్యవసర పరిస్థితికి వెంటనే 108కి కాల్ చేయండి. అర్జెంట్ కంసల్టేషన్ కోసం: {clinic_phone}",
    "hi": "आपातकाल के लिए तुरंत 108 पर कॉल करें। तत्काल परामर्श: {clinic_phone}",
    "en": "For emergency, please call 108 immediately. For urgent consultation: {clinic_phone}",
    "ta": "அவசரநிலைக்கு உடனே 108ஐ அழைக்கவும். அவசர ஆலோசனை: {clinic_phone}"
}

CANCEL_TEMPLATES = {
    "te": "మీ అపాయింట్‌మెంట్ రద్దు చేయబడింది. మళ్లీ బుక్ చేయడానికి ఎప్పుడైనా మెసేజ్ చేయండి.\n{clinic_name}",
    "hi": "आपका अपॉइंटमेंट रद्द कर दिया गया है। फिर से बुक करने के लिए संदेश भेजें।\n{clinic_name}",
    "en": "Your appointment has been cancelled. Reply anytime to rebook.\n{clinic_name}",
    "ta": "உங்கள் சந்திப்பு ரத்து செய்யப்பட்டது. மீண்டும் முன்பதிவு செய்ய செய்தி அனுப்பவும்.\n{clinic_name}"
}

ENQUIRY_TEMPLATES = {
    "te": "🏥 {doctor_display} క్లినిక్\n⏰ సమయాలు: {hours}\n💰 కన్సల్టేషన్: ₹{new_fee} (కొత్త) | ₹{followup_fee} (ఫాలోఅప్)\n📅 తదుపరి స్లాట్: {next_available}\n\nఅపాయింట్‌మెంట్ కోసం 'Book' అని పంపండి.",
    "hi": "🏥 {doctor_display} Clinic\n⏰ समय: {hours}\n💰 परामर्श: ₹{new_fee} (नया) | ₹{followup_fee} (फॉलोअप)\n📅 अगला स्लॉट: {next_available}\n\nAppointment के लिए 'Book' लिखें.",
    "en": "🏥 {doctor_display}'s Clinic\n⏰ Hours: {hours}\n💰 Consultation: ₹{new_fee} (new) | ₹{followup_fee} (follow-up)\n📅 Next available: {next_available}\n\nReply 'Book' to schedule an appointment.",
    "ta": "🏥 {doctor_display} மருத்துவமனை\n⏰ நேரம்: {hours}\n💰 கலந்தாய்வு: ₹{new_fee} (புதிய) | ₹{followup_fee} (தொடர்)\n📅 அடுத்த நேரம்: {next_available}\n\n'Book' என்று பதிலளிக்கவும்."
}

OTHER_TEMPLATES = {
    "te": "ధన్యవాదాలు! అపాయింట్‌మెంట్ కోసం 'Book' అని రాయండి. ఇతర విచారణలకు: {clinic_phone}",
    "hi": "धन्यवाद! Appointment के लिए 'Book' लिखें। अन्य प्रश्नों के लिए: {clinic_phone}",
    "en": "Thanks! Reply 'Book' for an appointment. For other queries: {clinic_phone}",
    "ta": "நன்றி! சந்திப்புக்கு 'Book' என்று பதிலளிக்கவும். மற்ற கேள்விகளுக்கு: {clinic_phone}"
}

CONSENT_TEMPLATES = {
    "te": "{doctor_display} క్లినిక్‌కి స్వాగతం. మీ అపాయింట్‌మెంట్‌లు మరియు జ్ఞాపికల కోసం మేము AI ని ఉపయోగిస్తాము. ముందుకు సాగడానికి అనుమతి ఇస్తున్నారా?",
    "hi": "{doctor_display} क्लिनिक में आपका स्वागत है। हम अपॉइंटमेंट और रिमाइंडर के लिए AI का उपयोग करते हैं। क्या आप सहमत हैं?",
    "en": "Welcome to {doctor_display}'s clinic. We use AI to manage appointments and health reminders. Do you consent to receive messages?",
    "ta": "{doctor_display} மருத்துவமனைக்கு வரவேற்கிறோம். சந்திப்புகள் மற்றும் நினைவூட்டல்களுக்கு நாங்கள் AIஐப் பயன்படுத்துகிறோம். ஒப்புக்கொள்கிறீர்களா?"
}
