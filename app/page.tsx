'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Globe, Wifi, WifiOff, ChevronLeft, Thermometer, CloudRain, ShieldAlert, Info, Leaf, MapPin, Download, CheckCircle2, Database, Loader2 } from 'lucide-react';
import { useLanguage } from '@/components/LanguageContext';
import { crops, Crop, fetchOnlineCrops, getSavedCrops, saveCrop, removeCrop, fetchCropById } from '@/lib/data';
import Image from 'next/image';

type ClimateZone = 'Tropical' | 'Temperate' | 'Arid' | null;

export default function AgriSmart() {
  const { t, language, setLanguage } = useLanguage();
  const [selectedCrop, setSelectedCrop] = useState<Crop | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineCrops, setOnlineCrops] = useState<Crop[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'diseases' | 'climate'>('details');
  const [climateZone, setClimateZone] = useState<ClimateZone>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSavingOffline, setIsSavingOffline] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [userCrops, setUserCrops] = useState<Crop[]>([]);
  const [isUpdatingDb, setIsUpdatingDb] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      setIsOnline(navigator.onLine);
      
      // Load saved data
      const savedZone = localStorage.getItem('agri-zone') as ClimateZone;
      if (savedZone) setClimateZone(savedZone);
      const savedOffline = localStorage.getItem('agri-offline-saved') === 'true';
      if (savedOffline) setIsSaved(true);
      
      // Load user crops
      setUserCrops(getSavedCrops());
    }, 0);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Online Search Debounce
  useEffect(() => {
    if (!isOnline || searchQuery.length < 3) {
      if (onlineCrops.length > 0) {
        const timer = setTimeout(() => setOnlineCrops([]), 0);
        return () => clearTimeout(timer);
      }
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingOnline(true);
      const results = await fetchOnlineCrops(searchQuery);
      setOnlineCrops(results);
      setIsSearchingOnline(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [searchQuery, isOnline, onlineCrops.length]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        // Simple mock logic for climate zones
        let zone: ClimateZone = 'Temperate';
        if (Math.abs(lat) < 23.5) zone = 'Tropical';
        else if (Math.abs(lat) > 40) zone = 'Arid'; // Just for demo variety

        setClimateZone(zone);
        localStorage.setItem('agri-zone', zone);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      }
    );
  };

  const saveForOffline = () => {
    setIsSavingOffline(true);
    // Simulate caching process
    setTimeout(() => {
      setIsSavingOffline(false);
      setIsSaved(true);
      localStorage.setItem('agri-offline-saved', 'true');
    }, 2000);
  };

  const combinedCrops = useMemo(() => {
    let localList = [...crops, ...userCrops].filter(crop =>
      crop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      crop.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Combine with online results, avoiding duplicates by name
    const localNames = new Set(localList.map(c => c.name.toLowerCase()));
    const uniqueOnline = onlineCrops.filter(c => !localNames.has(c.name.toLowerCase()));
    
    let list = [...localList, ...uniqueOnline];

    // Sort by favorability for the climate zone if detected
    if (climateZone) {
      list = [...list].sort((a, b) => {
        const aMatch = a.suitableZones.includes(climateZone);
        const bMatch = b.suitableZones.includes(climateZone);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
        return 0;
      });
    }
    return list;
  }, [searchQuery, climateZone, onlineCrops, userCrops]);

  const handleCropSelect = (crop: Crop) => {
    setSelectedCrop(crop);
    setActiveTab('details');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveCrop = (crop: Crop) => {
    saveCrop(crop);
    setUserCrops(getSavedCrops());
    // If the selected crop is the one we just saved, update its state to not be an "online result"
    if (selectedCrop?.id === crop.id) {
      setSelectedCrop({ ...crop, isOnlineResult: false });
    }
  };

  const handleRemoveCrop = (cropId: string) => {
    removeCrop(cropId);
    setUserCrops(getSavedCrops());
    if (selectedCrop?.id === cropId) {
      setSelectedCrop(null);
    }
  };

  const handleUpdateDatabase = async () => {
    if (!isOnline) return;
    setIsUpdatingDb(true);
    
    const currentSaved = getSavedCrops();
    const updatedCrops: Crop[] = [];
    
    for (const crop of currentSaved) {
      // Only update if it looks like an OpenFarm ID (numeric-ish or specific format)
      // For this demo, we'll try to update all user crops
      const updated = await fetchCropById(crop.id);
      if (updated) {
        updatedCrops.push(updated);
      } else {
        updatedCrops.push(crop);
      }
    }
    
    localStorage.setItem('agri-user-crops', JSON.stringify(updatedCrops));
    setUserCrops(updatedCrops);
    setIsUpdatingDb(false);
    
    // Show a temporary "Updated" state
    const banner = document.getElementById('db-update-banner');
    if (banner) {
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 3000);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 glass px-4 py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#2d6a4f] p-2 rounded-lg">
              <Leaf className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-display font-bold text-[#2d6a4f]">{t.title}</h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Offline Sync Button */}
            {mounted && isOnline && (
              <button
                onClick={saveForOffline}
                disabled={isSavingOffline || isSaved}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-full transition-all ${isSaved ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
              >
                {isSavingOffline ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                    <Download size={14} />
                  </motion.div>
                ) : isSaved ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <Download size={14} />
                )}
                <span className="hidden sm:inline">{isSavingOffline ? t.syncing : isSaved ? t.dataSaved : t.saveOffline}</span>
              </button>
            )}

            {/* Online/Offline Status */}
            {mounted && (
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span className="hidden sm:inline">{isOnline ? t.onlineMode : t.offlineMode}</span>
              </div>
            )}

            {/* Language Selector */}
            <div className="relative group">
              <button className="p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-1">
                <Globe size={20} className="text-gray-600" />
                <span className="text-sm font-medium uppercase">{language}</span>
              </button>
              <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
                {(['en', 'hi', 'sw'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${language === lang ? 'bg-green-50 text-[#2d6a4f] font-bold' : ''}`}
                  >
                    {lang === 'en' ? 'English' : lang === 'hi' ? 'हिन्दी' : 'Kiswahili'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8">
        <AnimatePresence mode="wait">
          {!selectedCrop ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <div className="text-center space-y-4">
                <h2 className="text-4xl font-display font-extrabold text-gray-900 tracking-tight">{t.subtitle}</h2>
                <p className="text-gray-500 max-w-lg mx-auto">{t.selectCrop}</p>
                
                {/* Database Status */}
                {mounted && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4 max-w-xs w-full">
                      <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                        <Database size={20} />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t.databaseStatus}</p>
                        <p className="text-sm font-bold text-gray-700">{userCrops.length} {t.cropsInDatabase}</p>
                      </div>
                      {isOnline && (
                        <button
                          onClick={handleUpdateDatabase}
                          disabled={isUpdatingDb}
                          className="p-2 rounded-lg hover:bg-gray-50 text-blue-600 transition-colors disabled:opacity-50"
                          title={t.updateDatabase}
                        >
                          <motion.div animate={isUpdatingDb ? { rotate: 360 } : {}} transition={{ repeat: Infinity, duration: 1 }}>
                            <Loader2 size={18} className={isUpdatingDb ? '' : 'hidden'} />
                            <Download size={18} className={isUpdatingDb ? 'hidden' : ''} />
                          </motion.div>
                        </button>
                      )}
                    </div>
                    <div id="db-update-banner" className="hidden text-[10px] font-bold text-green-600 animate-bounce">
                      {t.databaseUpdated}
                    </div>
                  </div>
                )}
                
                {/* Location Detection */}
                <div className="flex flex-col items-center gap-3 pt-2">
                  {mounted && !climateZone ? (
                    <button
                      onClick={detectLocation}
                      disabled={isLocating}
                      className="flex items-center gap-2 bg-[#2d6a4f] text-white px-6 py-3 rounded-2xl font-bold shadow-lg hover:bg-[#1b4332] transition-all disabled:opacity-50"
                    >
                      <MapPin size={18} className={isLocating ? 'animate-pulse' : ''} />
                      {isLocating ? 'Locating...' : t.detectLocation}
                    </button>
                  ) : mounted && climateZone ? (
                    <div className="flex items-center gap-2 bg-green-50 text-[#2d6a4f] px-4 py-2 rounded-xl border border-green-100">
                      <MapPin size={16} />
                      <span className="text-sm font-bold">{t.climateZone}: <span className="text-green-700">{climateZone}</span></span>
                      <button onClick={detectLocation} className="ml-2 text-xs underline opacity-60 hover:opacity-100">Change</button>
                    </div>
                  ) : null}
                  {mounted && !climateZone && <p className="text-[10px] text-gray-400 max-w-xs">{t.locationDesc}</p>}
                </div>
              </div>

              {/* Search */}
              <div className="space-y-4 max-w-md mx-auto">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder={t.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl shadow-sm border-none focus:ring-2 focus:ring-[#2d6a4f] transition-all outline-none"
                  />
                  {isSearchingOnline && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Loader2 className="animate-spin text-[#2d6a4f]" size={20} />
                    </div>
                  )}
                </div>
                {isOnline && searchQuery.length >= 3 && (
                  <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                    <Database size={12} />
                    {isSearchingOnline ? t.searchingOnline : t.onlineSearch}
                  </div>
                )}
              </div>

              {/* Crop Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {combinedCrops.map((crop) => (
                  <motion.div
                    key={crop.id}
                    layoutId={crop.id}
                    onClick={() => handleCropSelect(crop)}
                    className="bg-white rounded-3xl overflow-hidden shadow-sm card-hover cursor-pointer group"
                  >
                    <div className="relative h-48 w-full overflow-hidden">
                      <Image
                        src={crop.image}
                        alt={crop.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      
                      {/* Recommendation Badge */}
                      {climateZone && crop.suitableZones.includes(climateZone) && (
                        <div className="absolute top-4 right-4 bg-[#2d6a4f] text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-lg flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          {t.recommended}
                        </div>
                      )}

                      <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-xl font-bold font-display">{crop.name}</h3>
                        {crop.isOnlineResult && (
                          <span className="text-[8px] opacity-60 uppercase tracking-tighter">OpenFarm</span>
                        )}
                      </div>
                    </div>
                    <div className="p-5 space-y-2">
                      <p className="text-gray-600 text-sm line-clamp-2">{crop.description}</p>
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#2d6a4f] bg-green-50 w-fit px-2 py-1 rounded-md">
                        <Thermometer size={14} />
                        {crop.climateOutlook.idealTemp}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Back Button */}
              <button
                onClick={() => setSelectedCrop(null)}
                className="flex items-center gap-2 text-[#2d6a4f] font-semibold hover:gap-3 transition-all"
              >
                <ChevronLeft size={20} />
                {t.back}
              </button>

              {/* Hero Detail */}
              <div className="relative h-64 sm:h-80 w-full rounded-3xl overflow-hidden shadow-lg">
                <Image
                  src={selectedCrop.image}
                  alt={selectedCrop.name}
                  fill
                  className="object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between">
                  <div className="max-w-2xl">
                    <h2 className="text-4xl font-display font-black text-white mb-2">{selectedCrop.name}</h2>
                    <p className="text-white/80">{selectedCrop.description}</p>
                  </div>
                  
                  {/* Save/Remove Button */}
                  {mounted && (
                    <div className="flex flex-col gap-2">
                      {selectedCrop.isOnlineResult ? (
                        <button
                          onClick={() => handleSaveCrop(selectedCrop)}
                          className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-white/30"
                        >
                          <Download size={14} />
                          {t.saveToDatabase}
                        </button>
                      ) : userCrops.some(c => c.id === selectedCrop.id) ? (
                        <button
                          onClick={() => handleRemoveCrop(selectedCrop.id)}
                          className="bg-red-500/20 hover:bg-red-500/30 backdrop-blur-md text-red-200 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border border-red-500/30"
                        >
                          <ShieldAlert size={14} />
                          {t.removeFromDatabase}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex p-1 bg-gray-100 rounded-2xl">
                {(['details', 'diseases', 'climate'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === tab ? 'bg-white text-[#2d6a4f] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {tab === 'details' ? t.cropDetails : tab === 'diseases' ? t.diseases : t.climateOutlook}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="bg-white rounded-3xl p-8 shadow-sm min-h-[400px]">
                {activeTab === 'details' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <h4 className="text-xs uppercase tracking-widest font-bold text-gray-400">{t.cropDetails}</h4>
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="bg-green-100 p-2 rounded-lg text-[#2d6a4f]">
                              <Leaf size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">Planting Season</p>
                              <p className="text-gray-600">{selectedCrop.plantingSeason}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="bg-orange-100 p-2 rounded-lg text-orange-700">
                              <Search size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">Harvest Time</p>
                              <p className="text-gray-600">{selectedCrop.harvestTime}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-xs uppercase tracking-widest font-bold text-gray-400">Ideal Conditions</h4>
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="bg-blue-100 p-2 rounded-lg text-blue-700">
                              <CloudRain size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">Rainfall</p>
                              <p className="text-gray-600">{selectedCrop.climateOutlook.rainfall}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="bg-red-100 p-2 rounded-lg text-red-700">
                              <Thermometer size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">Temperature</p>
                              <p className="text-gray-600">{selectedCrop.climateOutlook.idealTemp}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'diseases' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {selectedCrop.diseases.map((disease, idx) => (
                      <div key={idx} className="border-b border-gray-100 last:border-0 pb-8 last:pb-0 space-y-4">
                        <div className="flex items-center gap-2 text-red-600">
                          <ShieldAlert size={24} />
                          <h3 className="text-xl font-bold font-display">{disease.name}</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="bg-gray-50 p-4 rounded-2xl space-y-2">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t.symptoms}</p>
                            <p className="text-gray-700 text-sm leading-relaxed">{disease.symptoms}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-2xl space-y-2">
                            <p className="text-xs font-bold text-green-400 uppercase tracking-wider">{t.prevention}</p>
                            <p className="text-gray-700 text-sm leading-relaxed">{disease.prevention}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeTab === 'climate' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    {selectedCrop.isOnlineResult && (
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-3">
                        <Database className="text-blue-600" size={20} />
                        <p className="text-xs text-blue-800 font-medium">{t.sourceOpenFarm}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between bg-gray-50 p-6 rounded-3xl">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.favorability}</p>
                        <p className={`text-2xl font-black font-display ${selectedCrop.climateOutlook.favorability === 'High' ? 'text-green-600' : selectedCrop.climateOutlook.favorability === 'Medium' ? 'text-orange-500' : 'text-red-500'}`}>
                          {selectedCrop.climateOutlook.favorability}
                        </p>
                      </div>
                      <div className="p-4 bg-white rounded-2xl shadow-sm">
                        {selectedCrop.climateOutlook.favorability === 'High' ? (
                          <div className="text-green-600 flex flex-col items-center">
                            <CloudRain size={32} />
                            <span className="text-[10px] font-bold mt-1">IDEAL</span>
                          </div>
                        ) : (
                          <div className="text-orange-500 flex flex-col items-center">
                            <Thermometer size={32} />
                            <span className="text-[10px] font-bold mt-1">CAUTION</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-[#2d6a4f]">
                        <Info size={20} />
                        <h3 className="text-lg font-bold">{t.climateImpact}</h3>
                      </div>
                      <p className="text-gray-600 leading-relaxed bg-green-50/50 p-6 rounded-3xl border border-green-100">
                        {selectedCrop.climateOutlook.impact}
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Offline Banner */}
      {!isOnline && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-4 left-4 right-4 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between z-[100]"
        >
          <div className="flex items-center gap-3">
            <WifiOff size={24} />
            <div>
              <p className="font-bold">{t.offlineMode}</p>
              <p className="text-xs opacity-80">Accessing cached local data</p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
