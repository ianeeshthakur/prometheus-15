// Real i18n dictionary -- docs/frontend.md flagged this as missing: the language
// selector (AccessibilityBar.jsx) was real (sets document.documentElement.lang) but
// nothing actually retranslated page copy, only Investigation.jsx's voice briefing
// spoke translated text.
//
// Honest scope: this covers the app shell (nav, topbar) and every page's header/
// static chrome -- the highest-visibility text a Hindi/Gujarati-reading operator
// would see on every screen. It does NOT translate dynamic data (camera names,
// district/department values, alert descriptions, table column headers on every
// data table, or every button/label in every modal) -- that's real content coming
// from the database or deeply nested in components, and mistranslating or leaving
// half of it in English would be worse than being clear about what's covered.
export const LANGUAGES = ['en', 'hi', 'gu'];

export const translations = {
  en: {
    nav_dashboard: 'Dashboard',
    nav_model1: 'Camera Registry',
    nav_model2: 'Unified Video',
    nav_ai_analytics: 'AI Analytics',
    nav_protocol_health: 'Protocol Health',
    nav_investigation: 'Alerts & Investigations',
    nav_watchlists: 'Watchlists',
    nav_system: 'System Health',
    nav_settings: 'Settings',

    topbar_brand: 'G-VISTA',
    topbar_state_tag: 'GUJARAT POLICE',
    topbar_subtitle: 'Statewide Video Intelligence & Investigation Platform',
    topbar_logout: 'Log out',

    dashboard_title: 'Command Center',
    dashboard_subtitle: 'Statewide surveillance overview — live GIS coverage, AI detections, and active incident triage.',

    registry_title: 'Camera Registry',
    registry_subtitle: 'Centralised inventory of CCTV assets across Gujarat — P1 Registry & GIS',
    registry_add_camera: 'Add Camera',

    live_cameras_title: 'Unified Video',

    ai_analytics_title: 'AI Video Analytics',
    ai_analytics_subtitle: 'Pipeline 3 — Real-time license plate detection and frame intelligence.',

    protocol_health_title: 'Protocol Health',
    protocol_health_subtitle: 'Pipeline 2 — Protocol adapter status and integration diagnostics.',

    investigation_title: 'Alerts & Investigations',
    investigation_subtitle: 'Triage alerts, open investigation cases, and trace entities across cameras.',

    watchlists_title: 'Watchlists',
    watchlists_subtitle: 'Manage identifiers the AI alert engine matches against every incoming plate/entity detection.',

    analytics_title: 'Analytics & Reports',

    system_network_title: 'System Health',
    system_network_subtitle: 'Backend health, pipeline status, per-camera adapter diagnostics.',

    admin_title: 'Administration',
    admin_subtitle: 'User & role management, audit trail, and the facial-recognition privacy gate.',

    common_close: 'Close',
    common_cancel: 'Cancel',
    common_search: 'Search',
    common_loading: 'Loading…',

    footer_live: 'LIVE — connected to the real backend',
    footer_mock: 'DEMO — mock data, backend unreachable',
  },

  hi: {
    nav_dashboard: 'डैशबोर्ड',
    nav_model1: 'कैमरा रजिस्ट्री',
    nav_model2: 'एकीकृत वीडियो',
    nav_ai_analytics: 'AI एनालिटिक्स',
    nav_protocol_health: 'प्रोटोकॉल हेल्थ',
    nav_investigation: 'अलर्ट और जांच',
    nav_watchlists: 'वॉचलिस्ट',
    nav_system: 'सिस्टम स्वास्थ्य',
    nav_settings: 'सेटिंग्स',

    topbar_brand: 'जी-विस्टा',
    topbar_state_tag: 'गुजरात पुलिस और कमांड',
    topbar_subtitle: 'राज्यव्यापी वीडियो इंटेलिजेंस और जांच प्लेटफ़ॉर्म',
    topbar_logout: 'लॉग आउट',

    dashboard_title: 'कमांड अवलोकन',
    dashboard_subtitle: 'एकीकृत टेलीमेट्री स्ट्रीम, लाइव GIS निगरानी कवरेज, और वास्तविक समय AI घटना पहचान।',

    registry_title: 'सीसीटीवी रजिस्ट्री',
    registry_subtitle: 'गुजरात सार्वजनिक सुरक्षा क्षेत्राधिकारों में सभी सीसीटीवी परिसंपत्तियों की केंद्रीकृत सूची',
    registry_add_camera: 'नया कैमरा जोड़ें',

    live_cameras_title: 'लाइव कैमरे',

    investigation_title: 'घटनाएं और अलर्ट',
    investigation_subtitle: 'अलर्ट की समीक्षा करें, जांच खोलें, और कैमरों में किसी इकाई का पता लगाएं।',

    watchlists_title: 'वॉचलिस्ट',
    watchlists_subtitle: 'उन पहचानकर्ताओं को प्रबंधित करें जिनसे अलर्ट इंजन हर आने वाली प्लेट/व्यक्ति रीडिंग का मिलान करता है।',

    analytics_title: 'विश्लेषण और रिपोर्ट',

    system_network_title: 'सिस्टम और नेटवर्क',
    system_network_subtitle: 'पाइपलाइन स्वास्थ्य, प्रति-कैमरा एडाप्टर निदान, और एकीकरण स्थिति।',

    admin_title: 'प्रशासन',
    admin_subtitle: 'उपयोगकर्ता और भूमिका प्रबंधन, ऑडिट ट्रेल, और चेहरा-पहचान गोपनीयता गेट।',

    common_close: 'बंद करें',
    common_cancel: 'रद्द करें',
    common_search: 'खोजें',
    common_loading: 'लोड हो रहा है…',

    footer_live: 'लाइव — वास्तविक बैकएंड से जुड़ा हुआ',
    footer_mock: 'डेमो — मॉक डेटा, बैकएंड अनुपलब्ध',
  },

  gu: {
    nav_dashboard: 'ડેશબોર્ડ',
    nav_model1: 'કેમેરા રજિસ્ટ્રી',
    nav_model2: 'એકીકૃત વિડિઓ',
    nav_ai_analytics: 'AI એનાલિટિક્સ',
    nav_protocol_health: 'પ્રોટોકોલ હેલ્થ',
    nav_investigation: 'એલર્ટ અને તપાસ',
    nav_watchlists: 'વૉચલિસ્ટ',
    nav_system: 'સિસ્ટમ આરોગ્ય',
    nav_settings: 'સેટિંગ્સ',

    topbar_brand: 'જી-વિસ્ટા',
    topbar_state_tag: 'ગુજરાત પોલીસ અને કમાન્ડ',
    topbar_subtitle: 'રાજ્યવ્યાપી વિડિયો ઇન્ટેલિજન્સ અને તપાસ પ્લેટફોર્મ',
    topbar_logout: 'લૉગ આઉટ',

    dashboard_title: 'કમાન્ડ ઓવરવ્યુ',
    dashboard_subtitle: 'એકીકૃત ટેલિમેટ્રી સ્ટ્રીમ, લાઇવ GIS સર્વેલન્સ કવરેજ, અને રીઅલ-ટાઇમ AI ઘટના શોધ.',

    registry_title: 'CCTV રજિસ્ટ્રી',
    registry_subtitle: 'ગુજરાત જાહેર સલામતી અધિકારક્ષેત્રોમાં તમામ CCTV સંપત્તિઓની કેન્દ્રિય યાદી',
    registry_add_camera: 'નવો કેમેરા ઉમેરો',

    live_cameras_title: 'લાઇવ કેમેરા',

    investigation_title: 'ઘટનાઓ અને એલર્ટ',
    investigation_subtitle: 'એલર્ટની સમીક્ષા કરો, તપાસ ખોલો, અને કેમેરામાં એન્ટિટીને ટ્રેસ કરો.',

    watchlists_title: 'વૉચલિસ્ટ',
    watchlists_subtitle: 'એલર્ટ એન્જિન દરેક આવનારી પ્લેટ/વ્યક્તિ રીડિંગ સામે જે ઓળખકર્તાઓ સરખાવે છે તેનું સંચાલન કરો.',

    analytics_title: 'એનાલિટિક્સ અને રિપોર્ટ્સ',

    system_network_title: 'સિસ્ટમ અને નેટવર્ક',
    system_network_subtitle: 'પાઇપલાઇન આરોગ્ય, પ્રતિ-કેમેરા એડેપ્ટર નિદાન, અને એકીકરણ સ્થિતિ.',

    admin_title: 'વહીવટ',
    admin_subtitle: 'વપરાશકર્તા અને ભૂમિકા સંચાલન, ઑડિટ ટ્રેલ, અને ચહેરો-ઓળખ ગોપનીયતા ગેટ.',

    common_close: 'બંધ કરો',
    common_cancel: 'રદ કરો',
    common_search: 'શોધો',
    common_loading: 'લોડ થઈ રહ્યું છે…',

    footer_live: 'લાઇવ — વાસ્તવિક બેકએન્ડ સાથે જોડાયેલ',
    footer_mock: 'ડેમો — મોક ડેટા, બેકએન્ડ અનુપલબ્ધ',
  },
};
