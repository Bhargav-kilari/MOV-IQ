import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  Dumbbell,
  ChevronRight,
  Plus,
  X,
  RotateCcw,
  User,
  History,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import ExerciseThumbnail from '../components/common/ExerciseThumbnail';
import { exerciseService } from '../services/exerciseService';

export const ExercisesPage = () => {
  const navigate = useNavigate();

  // State
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('All');
  const [selectedEquipment, setSelectedEquipment] = useState('All');
  const [filterOptions, setFilterOptions] = useState({ body_parts: [], equipment: [] });

  // Custom Exercise Modal
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customBodyPart, setCustomBodyPart] = useState('chest');
  const [customTargetMuscle, setCustomTargetMuscle] = useState('pectorals');
  const [customEquipment, setCustomEquipment] = useState('barbell');
  const [customInstructions, setCustomInstructions] = useState('');
  const [customDifficulty, setCustomDifficulty] = useState('Beginner');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await exerciseService.getExerciseFilters();
        if (res.data) {
          setFilterOptions(res.data);
        }
      } catch (err) {
        console.error('Error fetching filters:', err);
      }
    };
    loadFilters();
  }, []);

  const fetchExerciseList = useCallback(async (page = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      if (activeTab === 'recent') {
        const res = await exerciseService.getRecentExercises();
        setExercises(res.data || []);
        setTotalCount(res.data?.length || 0);
        setCurrentPage(1);
        setTotalPages(1);
        return;
      }

      const params = {
        page,
        limit: 40,
        tab: activeTab,
        search: searchQuery.trim() || undefined,
        body_part: selectedBodyPart !== 'All' ? selectedBodyPart : undefined,
        equipment: selectedEquipment !== 'All' ? selectedEquipment : undefined,
      };

      const res = await exerciseService.getExercises(params);

      if (append) {
        setExercises((prev) => [...prev, ...(res.data || [])]);
      } else {
        setExercises(res.data || []);
      }

      setTotalCount(res.total || 0);
      setCurrentPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error('Error fetching exercises:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeTab, searchQuery, selectedBodyPart, selectedEquipment]);

  useEffect(() => {
    fetchExerciseList(1, false);
  }, [fetchExerciseList]);

  const handleLoadMore = () => {
    if (currentPage < totalPages && !loadingMore) {
      fetchExerciseList(currentPage + 1, true);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedBodyPart('All');
    setSelectedEquipment('All');
    setActiveTab('all');
  };

  const handleCreateCustomExercise = async (e) => {
    e.preventDefault();
    if (!customName.trim()) return;

    try {
      setIsSubmittingCustom(true);
      await exerciseService.createCustomExercise({
        name: customName.trim(),
        body_part: customBodyPart,
        target_muscle: customTargetMuscle,
        equipment: customEquipment,
        difficulty: customDifficulty,
        instructions: customInstructions
          ? customInstructions.split('\n').filter((s) => s.trim().length > 0)
          : ['Execute with controlled form and full extension.'],
      });

      setShowCustomModal(false);
      setCustomName('');
      setCustomInstructions('');
      setActiveTab('custom');
      fetchExerciseList(1, false);
    } catch (err) {
      console.error('Error creating custom exercise:', err);
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  const hasActiveFilters =
    searchQuery.trim() !== '' || selectedBodyPart !== 'All' || selectedEquipment !== 'All';

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-2 pb-16 bg-[#FFFFFF]">
      {/* 1. Header */}
      <PageHeader
        title="Exercise Library"
        subtitle={`Master catalog of ${totalCount > 0 ? totalCount.toLocaleString() : '1,324+'} exercises with anatomical demonstrations.`}
        action={
          <button
            onClick={() => setShowCustomModal(true)}
            className="px-4 py-2.5 bg-[#FFFFFF] hover:bg-[#F9FAFB] text-[#111111] font-bold text-xs uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Custom</span>
          </button>
        }
      />

      {/* 2. Primary Tabs Selector */}
      <div className="flex items-center gap-1 border-b border-[#E5E7EB] pb-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab('popular');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'popular'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
          }`}
        >
          Popular
        </button>

        <button
          onClick={() => {
            setActiveTab('all');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'all'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
          }`}
        >
          All Exercises ({totalCount > 0 && activeTab === 'all' ? totalCount : '1,324+'})
        </button>

        <button
          onClick={() => {
            setActiveTab('recent');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
            activeTab === 'recent'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
          }`}
        >
          <History className="w-3 h-3" />
          <span>Recently Used</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('custom');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
            activeTab === 'custom'
              ? 'bg-[#111111] text-white shadow-xs'
              : 'text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6]'
          }`}
        >
          <User className="w-3 h-3" />
          <span>My Exercises</span>
        </button>
      </div>

      {/* 3. Search Bar & Filter Dropdowns */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#9CA3AF]" />
          <input
            type="text"
            placeholder="Search exercises by name, muscle, equipment, or category..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (activeTab === 'popular' && e.target.value.trim() !== '') {
                setActiveTab('all');
              }
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
          />
        </div>

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Body Part Filter */}
          <select
            value={selectedBodyPart}
            onChange={(e) => {
              setSelectedBodyPart(e.target.value);
              if (activeTab === 'popular') setActiveTab('all');
            }}
            className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs font-bold uppercase tracking-wider text-[#111111] focus:outline-none focus:border-[#111111]"
          >
            <option value="All">All Muscle Groups</option>
            {filterOptions.body_parts?.map((bp) => (
              <option key={bp.body_part} value={bp.body_part}>
                {bp.body_part.toUpperCase()} ({bp.count})
              </option>
            ))}
          </select>

          {/* Equipment Filter */}
          <select
            value={selectedEquipment}
            onChange={(e) => {
              setSelectedEquipment(e.target.value);
              if (activeTab === 'popular') setActiveTab('all');
            }}
            className="px-3 py-1.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs font-bold uppercase tracking-wider text-[#111111] focus:outline-none focus:border-[#111111]"
          >
            <option value="All">All Equipment</option>
            {filterOptions.equipment?.map((eq) => (
              <option key={eq.equipment} value={eq.equipment}>
                {eq.equipment.toUpperCase()} ({eq.count})
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="px-3 py-1.5 text-xs text-[#6B7280] hover:text-[#111111] flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          )}

          <div className="ml-auto text-[11px] text-[#6B7280] font-medium">
            Showing {exercises.length} of {totalCount} exercises
          </div>
        </div>
      </div>

      {/* 4. Exercises List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-[#6B7280]">Loading exercise catalog...</div>
      ) : exercises.length === 0 ? (
        <div className="border border-dashed border-[#E5E7EB] rounded-2xl p-12 text-center space-y-3 bg-[#FFFFFF]">
          <Dumbbell className="w-8 h-8 text-[#9CA3AF] mx-auto" />
          <p className="text-xs text-[#6B7280] font-medium">
            {activeTab === 'custom'
              ? "You haven't created any custom exercises yet."
              : activeTab === 'recent'
              ? 'Complete a workout session to see recently performed exercises.'
              : 'No exercises found matching your search and filter criteria.'}
          </p>
          {activeTab === 'custom' ? (
            <button
              onClick={() => setShowCustomModal(true)}
              className="px-4 py-2 bg-[#111111] hover:bg-[#000000] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm"
            >
              Create Custom Exercise
            </button>
          ) : hasActiveFilters ? (
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 bg-[#FFFFFF] hover:bg-[#F9FAFB] text-[#111111] text-xs font-semibold rounded-xl border border-[#E5E7EB] transition"
            >
              Clear All Filters
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="divide-y divide-[#E5E7EB] border-y border-[#E5E7EB]">
            {exercises.map((ex) => (
              <Link
                key={ex.id}
                to={`/app/exercises/${ex.id}`}
                className="py-3 px-2 flex items-center justify-between hover:bg-[#F9FAFB] transition group rounded-xl"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Thumbnail */}
                  <ExerciseThumbnail
                    src={ex.thumbnail_url}
                    alt={ex.name}
                    className="w-12 h-12"
                  />

                  {/* Title & Metadata */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-[#111111] group-hover:text-[#000000] uppercase tracking-tight truncate transition">
                        {ex.name}
                      </h3>
                      {ex.is_custom && (
                        <span className="px-1.5 py-0.2 bg-[#F3F4F6] text-[#111111] text-[9px] font-extrabold uppercase rounded border border-[#E5E7EB]">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-0.5 uppercase tracking-wider truncate">
                      <span className="text-[#111111] font-bold">{ex.target_muscle || ex.body_part}</span> · {ex.equipment} · {ex.difficulty}
                    </p>
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-[#9CA3AF] group-hover:text-[#111111] transition shrink-0 ml-2" />
              </Link>
            ))}
          </div>

          {/* Pagination Load More Button */}
          {currentPage < totalPages && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-6 py-2.5 bg-[#FFFFFF] hover:bg-[#F9FAFB] disabled:opacity-50 text-[#111111] font-bold text-xs uppercase tracking-wider rounded-xl border border-[#E5E7EB] transition shadow-xs"
              >
                {loadingMore ? 'Loading next exercises...' : `Load More Exercises (${exercises.length} of ${totalCount})`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 5. Dataset & Media Attribution Notice */}
      <footer className="pt-8 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#6B7280]">
        <div>
          Exercise Media &copy; <a href="https://gymvisual.com/" target="_blank" rel="noopener noreferrer" className="text-[#111111] underline hover:text-[#000000]">Gym visual</a>. All media rights reserved.
        </div>
        <div>
          Master Dataset Source: <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noopener noreferrer" className="text-[#111111] underline hover:text-[#000000]">exercises-dataset</a> (MIT)
        </div>
      </footer>

      {/* 6. Custom Exercise Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#111111]">
                Create Custom Exercise
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-[#6B7280] hover:text-[#111111]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomExercise} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bulgarian Split Squat"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                    Body Part
                  </label>
                  <select
                    value={customBodyPart}
                    onChange={(e) => setCustomBodyPart(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                  >
                    <option value="chest">Chest</option>
                    <option value="back">Back</option>
                    <option value="upper legs">Upper Legs</option>
                    <option value="lower legs">Lower Legs</option>
                    <option value="shoulders">Shoulders</option>
                    <option value="upper arms">Upper Arms</option>
                    <option value="lower arms">Lower Arms</option>
                    <option value="waist">Waist / Abs</option>
                    <option value="cardio">Cardio</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                    Equipment
                  </label>
                  <select
                    value={customEquipment}
                    onChange={(e) => setCustomEquipment(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] focus:outline-none focus:border-[#111111]"
                  >
                    <option value="barbell">Barbell</option>
                    <option value="dumbbell">Dumbbell</option>
                    <option value="cable">Cable</option>
                    <option value="body weight">Body Weight</option>
                    <option value="leverage machine">Leverage Machine</option>
                    <option value="smith machine">Smith Machine</option>
                    <option value="kettlebell">Kettlebell</option>
                    <option value="band">Band</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                  Target Muscle
                </label>
                <input
                  type="text"
                  placeholder="e.g. quadriceps, glutes, pectorals"
                  value={customTargetMuscle}
                  onChange={(e) => setCustomTargetMuscle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#4B5563] mb-1">
                  Instructions (One per line)
                </label>
                <textarea
                  rows={3}
                  placeholder="Step 1: Set foot on bench behind you..."
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-xs text-[#111111] placeholder-[#9CA3AF] focus:outline-none focus:border-[#111111]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#111111]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCustom}
                  className="px-5 py-2 bg-[#111111] hover:bg-[#000000] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-sm"
                >
                  {isSubmittingCustom ? 'Saving...' : 'Save Custom Exercise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExercisesPage;
