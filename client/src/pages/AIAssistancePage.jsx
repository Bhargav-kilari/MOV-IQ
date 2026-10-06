import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, History } from 'lucide-react';
import AIAssistanceExerciseSelector from '../components/ai/AIAssistanceExerciseSelector';
import AIAssistanceCameraSetup from '../components/ai/AIAssistanceCameraSetup';
import AIAssistanceLiveSession from '../components/ai/AIAssistanceLiveSession';
import AIAssistanceAssessment from '../components/ai/AIAssistanceAssessment';
import AIAssistanceHistoryModal from '../components/ai/AIAssistanceHistoryModal';

export const AIAssistancePage = () => {
  const navigate = useNavigate();

  // Current Step: 'SELECT' | 'SETUP' | 'LIVE' | 'ASSESSMENT'
  const [currentStep, setCurrentStep] = useState('SELECT');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [sessionResults, setSessionResults] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const handleSelectExercise = (exercise) => {
    setSelectedExercise(exercise);
    setCurrentStep('SETUP');
  };

  const handleBackToSelect = () => {
    setSelectedExercise(null);
    setCurrentStep('SELECT');
  };

  const handleStartAnalysis = () => {
    setCurrentStep('LIVE');
  };

  const handleEndSession = (sessionData) => {
    setSessionResults(sessionData);
    setCurrentStep('ASSESSMENT');
  };

  const handleStartAnother = () => {
    setSelectedExercise(null);
    setSessionResults(null);
    setCurrentStep('SELECT');
  };

  const handleGoToDashboard = () => {
    navigate('/app');
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with History Button */}
      {currentStep !== 'LIVE' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-[#111111] text-white rounded-lg">
              <Sparkles className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#111111]">
              MOV-IQ AI Assistance
            </span>
          </div>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#F9FAFB] border border-[#E5E7EB] text-[#111111] text-xs font-bold uppercase tracking-wider rounded-xl transition shadow-sm"
          >
            <History className="w-3.5 h-3.5 text-[#6B7280]" />
            <span>AI History</span>
          </button>
        </div>
      )}

      {/* Step Render */}
      {currentStep === 'SELECT' && (
        <AIAssistanceExerciseSelector onSelectExercise={handleSelectExercise} />
      )}

      {currentStep === 'SETUP' && selectedExercise && (
        <AIAssistanceCameraSetup
          exercise={selectedExercise}
          onBack={handleBackToSelect}
          onStartAnalysis={handleStartAnalysis}
        />
      )}

      {currentStep === 'LIVE' && selectedExercise && (
        <AIAssistanceLiveSession
          exercise={selectedExercise}
          onEndSession={handleEndSession}
          onCancel={handleBackToSelect}
        />
      )}

      {currentStep === 'ASSESSMENT' && sessionResults && (
        <AIAssistanceAssessment
          sessionData={sessionResults}
          onStartAnother={handleStartAnother}
          onGoToDashboard={handleGoToDashboard}
        />
      )}

      {/* History Modal */}
      <AIAssistanceHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </div>
  );
};

export default AIAssistancePage;
