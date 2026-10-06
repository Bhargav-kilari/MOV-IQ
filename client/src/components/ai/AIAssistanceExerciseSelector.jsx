import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Filter,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  ArrowRight,
  Info,
  ChevronRight,
} from 'lucide-react';
import aiService from '../../services/aiService';
import api from '../../services/api';

export const AIAssistanceExerciseSelector = ({ onSelectExercise }) => {
  const [supportedList, setSupportedList] = useState([]);
  const [fullCatalog, setFullCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('supported'); // 'supported' | 'all'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [unsupportedWarning, setUnsupportedWarning] = useState(null);

  useEffect(() => {
    fetchExercises();
  }, []);

  const fetchExercises = async () => {
    setLoading(true);
    try {
      // 1. Fetch AI supported core 12 exercises
      const aiRes = await aiService.getSupportedExercises();
      if (aiRes.success) {
        setSupportedList(aiRes.data);
      }

      // 2. Fetch general catalog
      const catRes = await api.get('/exercises?limit=100');
      if (catRes.data && catRes.data.data) {
        setFullCatalog(catRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load exercises:', err);
    } finally {
      setLoading(false);
    }
  };

  const muscleFilters = ['all', 'Chest', 'Legs', 'Arms', 'Shoulders', 'Back'];

  // Filter supported exercises
  const filteredSupported = supportedList.filter((item) => {
    const nameMatch = item.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.db_exercise?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const muscleMatch =
      selectedMuscle === 'all' ||
      (item.db_exercise?.body_part || '').toLowerCase().includes(selectedMuscle.toLowerCase()) ||
      (item.db_exercise?.target_muscle || '').toLowerCase().includes(selectedMuscle.toLowerCase());
    return nameMatch && muscleMatch;
  });

  // Filter full catalog exercises
  const filteredCatalog = fullCatalog.filter((ex) => {
    const nameMatch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const muscleMatch =
      selectedMuscle === 'all' ||
      (ex.body_part || '').toLowerCase().includes(selectedMuscle.toLowerCase()) ||
      (ex.target_muscle || '').toLowerCase().includes(selectedMuscle.toLowerCase());
    return nameMatch && muscleMatch;
  });

  const handleSelect = (item, isSupported) => {
    if (!isSupported) {
      setUnsupportedWarning({
        name: item.name,
        message: 'AI analysis is not currently available for this exercise.',
      });
      return;
    }
    setUnsupportedWarning(null);
    onSelectExercise({
      modelKey: item.model_key,
      displayName: item.display_name,
      dbExercise: item.db_exercise,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] pb-5">
        <div className="flex items-center gap-2 mb-1">
          <div className="p-1.5 bg-[#111111] text-white rounded-lg">
            <Sparkles className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#6B7280]">Step 1 of 4</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight">
          Choose an Exercise
        </h1>
        <p className="text-sm text-[#4B5563] mt-1">
          Select an exercise to analyze posture, count repetitions, and evaluate biomechanical form in real time.
        </p>
      </div>

      {/* Unsupported Warning Modal / Toast */}
      {unsupportedWarning && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between gap-3 transition">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">
                Unsupported Exercise: {unsupportedWarning.name}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {unsupportedWarning.message} Please select one of the 12 AI-supported exercises below (such as Squat, Bench Press, Bicep Curl, or Shoulder Press).
              </p>
            </div>
          </div>
          <button
            onClick={() => setUnsupportedWarning(null)}
            className="text-xs font-bold text-amber-800 hover:text-amber-950 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Tab switch */}
        <div className="flex p-1 bg-[#F3F4F6] rounded-xl self-start">
          <button
            onClick={() => { setActiveTab('supported'); setUnsupportedWarning(null); }}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
              activeTab === 'supported'
                ? 'bg-white text-[#111111] shadow-sm'
                : 'text-[#6B7280] hover:text-[#111111]'
            }`}
          >
            AI Supported (12)
          </button>
          <button
            onClick={() => { setActiveTab('all'); setUnsupportedWarning(null); }}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg transition ${
              activeTab === 'all'
                ? 'bg-white text-[#111111] shadow-sm'
                : 'text-[#6B7280] hover:text-[#111111]'
            }`}
          >
            Full Catalog (1,324+)
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search exercises..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-[#E5E7EB] rounded-xl bg-white focus:outline-none focus:border-[#111111] transition"
          />
        </div>
      </div>

      {/* Muscle Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-[#9CA3AF] mr-1 shrink-0" />
        {muscleFilters.map((m) => (
          <button
            key={m}
            onClick={() => setSelectedMuscle(m)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              selectedMuscle === m
                ? 'bg-[#111111] text-white'
                : 'bg-[#F9FAFB] text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111111] border border-[#E5E7EB]'
            }`}
          >
            {m === 'all' ? 'All Muscles' : m}
          </button>
        ))}
      </div>

      {/* Exercises Grid */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="inline-block w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs text-[#6B7280] font-medium">Loading exercises...</p>
        </div>
      ) : activeTab === 'supported' ? (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSupported.map((item) => (
              <div
                key={item.model_key}
                onClick={() => handleSelect(item, true)}
                className="group p-4 bg-white border border-[#E5E7EB] hover:border-[#111111] rounded-2xl cursor-pointer transition shadow-sm hover:shadow-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" />
                      AI Verified
                    </span>
                    <span className="text-[11px] text-[#6B7280] capitalize">
                      {item.db_exercise?.equipment || 'Free Weight'}
                    </span>
                  </div>

                  {item.db_exercise?.thumbnail_url ? (
                    <div className="w-full h-32 mb-3 bg-[#F9FAFB] rounded-xl overflow-hidden flex items-center justify-center border border-[#F3F4F6]">
                      <img
                        src={item.db_exercise.thumbnail_url}
                        alt={item.display_name}
                        className="h-full w-auto object-contain group-hover:scale-105 transition"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 mb-3 bg-[#F9FAFB] rounded-xl flex items-center justify-center text-[#9CA3AF] border border-[#F3F4F6]">
                      <Dumbbell className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  <h3 className="text-base font-bold text-[#111111] group-hover:text-black">
                    {item.display_name}
                  </h3>
                  <p className="text-xs text-[#6B7280] capitalize mt-0.5">
                    {item.db_exercise?.body_part || 'Full Body'} • {item.db_exercise?.target_muscle || 'Core'}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-[#F3F4F6] flex items-center justify-between text-xs font-bold text-[#111111]">
                  <span>Analyze Technique</span>
                  <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#111111] group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            ))}
          </div>

          {filteredSupported.length === 0 && (
            <div className="py-12 text-center border border-dashed border-[#E5E7EB] rounded-2xl">
              <p className="text-xs text-[#6B7280]">No AI-supported exercises found matching your filter.</p>
            </div>
          )}
        </div>
      ) : (
        /* Full Catalog Tab */
        <div>
          <div className="p-3 mb-4 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-xs text-[#6B7280] flex items-center gap-2">
            <Info className="w-4 h-4 text-[#111111] shrink-0" />
            <span>
              The full catalog contains 1,324+ exercises. Exercises marked with <span className="font-bold text-emerald-700">AI Verified</span> support full real-time model analysis.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCatalog.map((ex) => {
              // Check if matching supported
              const supportedMatch = supportedList.find(
                (s) => s.db_exercise?.id === ex.id || s.display_name.toLowerCase() === ex.name.toLowerCase()
              );
              const isSupported = Boolean(supportedMatch);

              return (
                <div
                  key={ex.id}
                  onClick={() =>
                    handleSelect(
                      supportedMatch || { name: ex.name, db_exercise: ex },
                      isSupported
                    )
                  }
                  className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSupported
                      ? 'bg-white border-[#E5E7EB] hover:border-[#111111]'
                      : 'bg-[#FAFAFA] border-[#E5E7EB] hover:border-[#D1D5DB] opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-[#111111] truncate">{ex.name}</span>
                    {isSupported ? (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-bold uppercase rounded border border-emerald-200">
                        AI
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-medium uppercase rounded">
                        No AI
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6B7280] capitalize">
                    {ex.body_part || 'Full Body'} • {ex.equipment || 'Bodyweight'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistanceExerciseSelector;
