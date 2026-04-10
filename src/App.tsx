import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Shield, AlertTriangle, MapPin, Bell, User, Info, 
  Plus, Send, Filter, CheckCircle, X, Navigation, 
  Menu, Search, Globe, ChevronRight, MessageSquare, 
  Share2, EyeOff, Radio, Settings, LogOut, Phone,
  ShieldCheck, Activity, Zap, RefreshCw, Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from './lib/supabase';
import { NIGERIA_STATES, THREAT_CATEGORIES, SecurityReport, User as UserType, DistressSignal } from './types';

// Haversine formula for distance calculation
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default function App() {
  // State
  const [reports, setReports] = useState<SecurityReport[]>([]);
  const [distressSignals, setDistressSignals] = useState<DistressSignal[]>([]);
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [language, setLanguage] = useState('en');
  const [activeTab, setActiveTab] = useState<'feed' | 'map' | 'sos' | 'profile'>('feed');
  const [isReporting, setIsReporting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedState, setSelectedState] = useState('Lagos');
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [activeAlert, setActiveAlert] = useState<any>(null);
  const [nearbySOS, setNearbySOS] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState<any[]>([]);

  // Form State
  const [reportForm, setReportForm] = useState({
    category: 'other',
    description: '',
    state: 'Lagos',
    lga: '',
    isAnonymous: false
  });

  const [regForm, setRegForm] = useState({
    realName: '',
    phoneNumber: ''
  });

  // Initialization
  useEffect(() => {
    const savedUser = localStorage.getItem('naijaguard_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    } else {
      const newUserId = `user_${Math.random().toString(36).substr(2, 9)}`;
      const newUser: UserType = {
        id: newUserId,
        phoneNumber: '',
        reputationScore: 1.0,
        trustScore: 0.5,
        reportCount: 0,
        verificationCount: 0,
        languagePreference: 'en',
        isRegisteredIndividual: false
      };
      setCurrentUser(newUser);
      localStorage.setItem('naijaguard_user', JSON.stringify(newUser));
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      if (data) setReports(data as SecurityReport[]);
    } catch (e) {
      console.error('Failed to fetch reports:', e);
    }
  };

  const fetchDistressSignals = async () => {
    try {
      const { data, error } = await supabase
        .from('distress_signals')
        .select('*')
        .eq('status', 'active')
        .order('timestamp', { ascending: false });
      
      if (error) throw error;
      if (data) setDistressSignals(data);
    } catch (e) {
      console.error('Failed to fetch distress signals:', e);
    }
  };

  useEffect(() => {
    if (!supabase) return;

    fetchReports();
    fetchDistressSignals();

    const interval = setInterval(() => {
      fetchReports();
      fetchDistressSignals();
    }, 30000);

    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((position) => {
        setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
      }, (err) => console.error('Geo error:', err), { enableHighAccuracy: true });
    }

    const reportsSub = supabase
      .channel('public:reports')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, payload => {
        const newReport = payload.new as SecurityReport;
        setReports(prev => [newReport, ...prev]);
        
        if (userLocation && newReport.lat && newReport.lng) {
          const dist = getDistance(newReport.lat, newReport.lng, userLocation.lat, userLocation.lng);
          if (dist <= 10) {
            setActiveAlert({ ...newReport, distance: dist.toFixed(1) });
            setTimeout(() => setActiveAlert(null), 10000);
          }
        }
      })
      .subscribe();

    const signalsSub = supabase
      .channel('public:distress_signals')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'distress_signals' }, payload => {
        const newSignal = payload.new as DistressSignal;
        if (newSignal.status === 'active') {
          setDistressSignals(prev => [newSignal, ...prev]);
          if (userLocation && newSignal.lat && newSignal.lng) {
            const dist = getDistance(newSignal.lat, newSignal.lng, userLocation.lat, userLocation.lng);
            if (dist <= 10) setNearbySOS({ ...newSignal, distance: dist.toFixed(1) });
          }
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'distress_signals' }, payload => {
        const updated = payload.new as DistressSignal;
        if (updated.status === 'resolved') {
          setDistressSignals(prev => prev.filter(s => s.id !== updated.id));
        } else {
          setDistressSignals(prev => prev.map(s => s.id === updated.id ? updated : s));
        }
      })
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(reportsSub);
      supabase.removeChannel(signalsSub);
    };
  }, [userLocation]);

  const fetchAiSummary = async (state: string) => {
    setIsLoadingSummary(true);
    try {
      const res = await fetch(`/api/intelligence/summary/${state}`);
      const data = await res.json();
      setAiSummary(data.summary);
    } catch (e) {
      setAiSummary('Failed to load intelligence summary.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const reportData = {
      ...reportForm,
      userId: currentUser.id,
      lat: userLocation?.lat,
      lng: userLocation?.lng,
      timestamp: Date.now()
    };

    if (isOnline) {
      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData)
        });
        if (res.ok) {
          setIsReporting(false);
          setReportForm({ category: 'other', description: '', state: 'Lagos', lga: '', isAnonymous: false });
          fetchReports();
        }
      } catch (e) {
        console.error('Report failed, queuing...');
        setSyncQueue(prev => [...prev, { ...reportData, tempId: Date.now() }]);
      }
    } else {
      setSyncQueue(prev => [...prev, { ...reportData, tempId: Date.now() }]);
      setIsReporting(false);
    }
  };

  const handleSOS = async () => {
    if (!userLocation || !currentUser) return;
    try {
      await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: userLocation, userId: currentUser.id })
      });
      setActiveTab('sos');
    } catch (e) {
      console.error('SOS failed');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const res = await fetch('/api/register-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...regForm, userId: currentUser.id })
      });
      if (res.ok) {
        const updatedUser = { ...currentUser, ...regForm, isRegisteredIndividual: true };
        setCurrentUser(updatedUser);
        localStorage.setItem('naijaguard_user', JSON.stringify(updatedUser));
        setIsRegistering(false);
      }
    } catch (e) {
      console.error('Registration failed');
    }
  };

  const translations: Record<string, any> = {
    en: { title: 'NaijaGuard', report: 'Report Threat', register: 'Register Individual', distress: 'Distress Signals', verified: 'Verified', active: 'Active Threats', map: 'Map', feed: 'Feed', sos: 'SOS', profile: 'Profile' },
    yo: { title: 'NaijaGuard', report: 'Jábọ̀ Ìṣẹ̀lẹ̀', register: 'Forúkọ sílẹ̀', distress: 'Àmì Ìpòjù', verified: 'Ti fìdí múlẹ̀', active: 'Ìpèníjà', map: 'Àwòrán', feed: 'Ìròyìn', sos: 'Ìrànwọ́', profile: 'Ìtàn' },
    ha: { title: 'NaijaGuard', report: 'Ba da Rahoto', register: 'Yi Rajista', distress: 'Alamun Gaggawa', verified: 'An Tabbatar', active: 'Barazana', map: 'Taswira', feed: 'Labarai', sos: 'Taimako', profile: 'Suna' },
    ig: { title: 'NaijaGuard', report: 'Kọọ akụkọ', register: 'Debanye aha', distress: 'Ihe Ngosi Nsogbu', verified: 'Ekwetara', active: 'Ihe egwu', map: 'Mapu', feed: 'Akụkọ', sos: 'Enyemaka', profile: 'Profaịlụ' }
  };

  const t = translations[language] || translations.en;

  return (
    <div className="max-w-md mx-auto bg-slate-50 min-h-screen pb-24 font-sans relative overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-nav px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="bg-brand-primary p-2 rounded-xl shadow-lg shadow-emerald-100">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 leading-tight">{t.title}</h1>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {isOnline ? 'Live Network' : 'Offline Mode'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-slate-100 text-xs font-bold px-2 py-1 rounded-lg border-none focus:ring-0"
          >
            <option value="en">EN</option>
            <option value="yo">YO</option>
            <option value="ha">HA</option>
            <option value="ig">IG</option>
          </select>
          <button className="p-2 bg-slate-100 rounded-xl text-slate-600">
            <Bell className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-4">
        {activeTab === 'feed' && (
          <div className="space-y-6">
            {/* AI Intelligence Section */}
            <section className="glass-card rounded-3xl p-5 border-emerald-100/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Zap className="w-12 h-12 text-emerald-600" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  <h2 className="font-display font-bold text-slate-800">AI Safety Intelligence</h2>
                </div>
                <select 
                  value={selectedState} 
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    fetchAiSummary(e.target.value);
                  }}
                  className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1.5 rounded-xl border-none"
                >
                  {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              
              <div className="bg-white/50 rounded-2xl p-4 min-h-[80px]">
                {isLoadingSummary ? (
                  <div className="flex items-center justify-center py-4 gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
                    <span className="text-xs font-bold text-emerald-600">Analyzing reports...</span>
                  </div>
                ) : aiSummary ? (
                  <div className="text-sm text-slate-600 leading-relaxed">
                    <Markdown>{aiSummary}</Markdown>
                  </div>
                ) : (
                  <button 
                    onClick={() => fetchAiSummary(selectedState)}
                    className="w-full py-2 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
                  >
                    Generate {selectedState} Safety Summary
                  </button>
                )}
              </div>
            </section>

            {/* Reports Feed */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-display font-extrabold text-slate-900">{t.active}</h2>
              <button className="text-xs font-bold text-brand-primary flex items-center gap-1">
                <Filter className="w-3 h-3" /> Filter
              </button>
            </div>

            <div className="space-y-4">
              {reports.map((report) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={report.id} 
                  className="glass-card rounded-3xl p-4 relative"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        report.riskLevel === 'critical' ? 'bg-red-100 text-red-600' :
                        report.riskLevel === 'high' ? 'bg-orange-100 text-orange-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {report.riskLevel}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {formatDistanceToNow(report.timestamp)} ago
                      </span>
                    </div>
                    {report.isVerified && (
                      <div className="flex items-center gap-1 text-emerald-600">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                      </div>
                    )}
                  </div>

                  <h3 className="font-display font-bold text-slate-800 mb-1 capitalize">
                    {report.aiThreatType || report.category.replace('_', ' ')}
                  </h3>
                  <p className="text-sm text-slate-600 mb-4 line-clamp-3 leading-relaxed">
                    {report.description}
                  </p>

                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-1 text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span className="text-xs font-bold">{report.lga}, {report.state}</span>
                    </div>
                    {report.source !== 'user' && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <Globe className="w-3 h-3" />
                        <span className="text-xs font-bold">{report.source}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <div className="flex items-center -space-x-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                          <img src={`https://picsum.photos/seed/${report.id}${i}/40/40`} alt="user" />
                        </div>
                      ))}
                      <span className="pl-4 text-[10px] font-bold text-slate-400">+{report.verificationCount} verified</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button className="p-2 bg-slate-50 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'sos' && (
          <div className="space-y-6">
            <div className="text-center py-8">
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Radio className="w-12 h-12 text-red-600" />
              </div>
              <h2 className="text-2xl font-display font-black text-slate-900 mb-2">Emergency SOS</h2>
              <p className="text-slate-500 text-sm">Active distress signals in your vicinity</p>
            </div>

            <div className="space-y-4">
              {distressSignals.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                  <Smartphone className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 font-bold">No active SOS signals nearby</p>
                </div>
              ) : (
                distressSignals.map(signal => (
                  <div key={signal.id} className="bg-white rounded-3xl p-5 border-2 border-red-100 shadow-xl shadow-red-50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 opacity-50" />
                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-red-600 flex items-center justify-center text-white font-black text-xl">
                          {signal.realName?.[0] || 'A'}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{signal.realName || 'Anonymous User'}</h3>
                          <span className="text-[10px] font-black text-red-600 uppercase tracking-widest">Distress Active</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">
                        {formatDistanceToNow(signal.timestamp)} ago
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 mb-6">
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm font-bold">Location: {signal.lat.toFixed(4)}, {signal.lng.toFixed(4)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button className="btn-danger py-3 rounded-2xl flex items-center justify-center gap-2">
                        <Phone className="w-4 h-4" /> Call Help
                      </button>
                      <button className="btn-secondary py-3 rounded-2xl flex items-center justify-center gap-2">
                        <Navigation className="w-4 h-4" /> Navigate
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && currentUser && (
          <div className="space-y-6">
            <div className="glass-card rounded-3xl p-6 text-center">
              <div className="w-24 h-24 rounded-full bg-emerald-100 mx-auto mb-4 flex items-center justify-center border-4 border-white shadow-xl">
                <User className="w-12 h-12 text-emerald-600" />
              </div>
              <h2 className="text-xl font-display font-black text-slate-900 mb-1">
                {currentUser.realName || 'Citizen Guardian'}
              </h2>
              <p className="text-slate-500 text-xs font-bold mb-6 uppercase tracking-widest">
                ID: {currentUser.id.split('_')[1]}
              </p>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <div className="text-emerald-600 font-black text-lg">{currentUser.trustScore.toFixed(1)}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Trust</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <div className="text-blue-600 font-black text-lg">{currentUser.reputationScore.toFixed(1)}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Rep</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <div className="text-orange-600 font-black text-lg">{currentUser.reportCount}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Reports</div>
                </div>
              </div>
            </div>

            {!currentUser.isRegisteredIndividual && (
              <button 
                onClick={() => setIsRegistering(true)}
                className="w-full bg-emerald-600 text-white p-5 rounded-3xl font-black flex items-center justify-between shadow-xl shadow-emerald-100"
              >
                <div className="text-left">
                  <div className="text-sm">Register Profile</div>
                  <div className="text-[10px] opacity-80">Gain priority verification status</div>
                </div>
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            <div className="space-y-2">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest px-2">Settings</h3>
              <div className="bg-white rounded-3xl overflow-hidden border border-slate-100">
                <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">Language Preferences</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
                <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-50">
                  <div className="flex items-center gap-3">
                    <Bell className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">Notification Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
                <button className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Settings className="w-5 h-5 text-slate-400" />
                    <span className="text-sm font-bold text-slate-700">Account Privacy</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              </div>
            </div>

            <button className="w-full p-4 flex items-center justify-center gap-2 text-red-500 font-bold text-sm">
              <LogOut className="w-4 h-4" /> Sign Out
            </button>
          </div>
        )}
      </main>

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto glass-nav px-6 py-3 flex items-center justify-between z-40 border-t border-slate-200 pb-8">
        <button 
          onClick={() => setActiveTab('feed')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'feed' ? 'text-brand-primary' : 'text-slate-400'}`}
        >
          <Activity className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.feed}</span>
        </button>
        <button 
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'map' ? 'text-brand-primary' : 'text-slate-400'}`}
        >
          <MapPin className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.map}</span>
        </button>
        
        {/* SOS Button */}
        <div className="relative -mt-12">
          <button 
            onClick={handleSOS}
            className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl shadow-red-200 border-4 border-white active:scale-90 transition-transform"
          >
            <Radio className="w-8 h-8" />
          </button>
        </div>

        <button 
          onClick={() => setActiveTab('sos')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'sos' ? 'text-brand-primary' : 'text-slate-400'}`}
        >
          <AlertTriangle className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.sos}</span>
        </button>
        <button 
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'profile' ? 'text-brand-primary' : 'text-slate-400'}`}
        >
          <User className="w-6 h-6" />
          <span className="text-[10px] font-black uppercase tracking-widest">{t.profile}</span>
        </button>
      </nav>

      {/* Floating Action Button */}
      <AnimatePresence>
        {activeTab === 'feed' && !isReporting && (
          <motion.button 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsReporting(true)}
            className="fixed bottom-24 right-6 w-14 h-14 bg-brand-primary text-white rounded-2xl shadow-2xl shadow-emerald-200 flex items-center justify-center z-30 active:scale-95 transition-transform"
          >
            <Plus className="w-8 h-8" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {isReporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-display font-black text-slate-900">Report Threat</h2>
                <button onClick={() => setIsReporting(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Category</label>
                  <div className="grid grid-cols-2 gap-2">
                    {THREAT_CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setReportForm(prev => ({ ...prev, category: cat.id }))}
                        className={`p-3 rounded-2xl text-xs font-bold text-left transition-all border-2 ${
                          reportForm.category === cat.id 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                          : 'bg-slate-50 border-transparent text-slate-600'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">State</label>
                    <select 
                      value={reportForm.state}
                      onChange={(e) => setReportForm(prev => ({ ...prev, state: e.target.value }))}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                    >
                      {NIGERIA_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">LGA / Area</label>
                    <input 
                      type="text"
                      placeholder="e.g. Ikeja"
                      value={reportForm.lga}
                      onChange={(e) => setReportForm(prev => ({ ...prev, lga: e.target.value }))}
                      className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Description</label>
                  <textarea 
                    rows={4}
                    placeholder="Describe the threat, location details, and any landmarks..."
                    value={reportForm.description}
                    onChange={(e) => setReportForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-600">Report Anonymously</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={reportForm.isAnonymous}
                    onChange={(e) => setReportForm(prev => ({ ...prev, isAnonymous: e.target.checked }))}
                    className="w-5 h-5 rounded-lg text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                </div>

                <button type="submit" className="w-full btn-primary py-4 rounded-2xl text-lg font-black mt-4">
                  <Send className="w-5 h-5" /> Submit Report
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isRegistering && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-3xl mx-auto mb-6 flex items-center justify-center">
                <ShieldCheck className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-display font-black text-slate-900 mb-2">Register Profile</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                Registered individuals provide their real identity to help authorities and emergency responders.
              </p>

              <form onSubmit={handleRegister} className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Full Legal Name</label>
                  <input 
                    type="text"
                    required
                    value={regForm.realName}
                    onChange={(e) => setRegForm(prev => ({ ...prev, realName: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Phone Number</label>
                  <input 
                    type="tel"
                    required
                    value={regForm.phoneNumber}
                    onChange={(e) => setRegForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
                    className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setIsRegistering(false)} className="flex-1 btn-secondary">Cancel</button>
                  <button type="submit" className="flex-1 btn-primary">Register</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {activeAlert && (
          <motion.div 
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            className="fixed top-24 right-4 left-4 z-50 bg-red-600 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-4 border-4 border-white"
          >
            <div className="bg-white/20 p-3 rounded-2xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80">Nearby Threat Detected</div>
              <div className="font-bold text-sm leading-tight">{activeAlert.description}</div>
              <div className="text-[10px] font-bold mt-1 uppercase">{activeAlert.distance}km away</div>
            </div>
            <button onClick={() => setActiveAlert(null)} className="p-2">
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {nearbySOS && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-24 right-4 left-4 z-50 bg-slate-900 text-white p-5 rounded-3xl shadow-2xl border-4 border-red-600"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-600 rounded-2xl flex items-center justify-center animate-pulse">
                <Radio className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-red-500">SOS Signal Detected</div>
                <div className="font-bold">{nearbySOS.realName || 'Anonymous'} is in danger</div>
                <div className="text-[10px] font-bold opacity-60 uppercase">{nearbySOS.distance}km away</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 bg-red-600 py-2 rounded-xl text-xs font-black uppercase">Respond</button>
              <button onClick={() => setNearbySOS(null)} className="px-4 bg-white/10 py-2 rounded-xl text-xs font-black uppercase">Dismiss</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
