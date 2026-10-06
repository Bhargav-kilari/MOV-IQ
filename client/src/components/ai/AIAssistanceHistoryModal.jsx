import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Clock,
  Dumbbell,
} from 'lucide-react';
import aiService from '../../services/aiService';

export const AIAssistanceHistoryModal = ({ isOpen, onClose }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const res = await aiService.getHistory();
      if (res.success) {
        setHistory(res.data);
      }
    } catch (err) {
      console.error('Failed to load AI history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-[#E5E7EB] rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="p-5 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#111111] text-white rounded-lg">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111111]">AI Workout History</h2>
              <p className="text-xs text-[#6B7280]">Saved sessions analyzed by MOV-IQ Stage 4 Engine</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#111111] hover:bg-[#F3F4F6] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-block w-6 h-6 border-2 border-[#111111] border-t-transparent rounded-full animate-spin mb-2"></div>
              <p className="text-xs text-[#6B7280]">Loading past sessions...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-[#E5E7EB] rounded-2xl">
              <Dumbbell className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2 opacity-50" />
              <p className="text-xs text-[#6B7280] font-semibold">No saved AI sessions yet.</p>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                Complete an AI Assistance session to see your technical form assessments here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  className="p-4 bg-white border border-[#E5E7EB] hover:border-[#111111] rounded-2xl transition cursor-pointer shadow-sm space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-[#111111]">
                        {item.exercise_name || item.detected_exercise || 'Workout Session'}
                      </h4>
                      <p className="text-[11px] text-[#6B7280] flex items-center gap-1.5 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#111111]">
                          Score: {item.form_score != null ? Math.round(item.form_score) : '--'}
                        </span>
                        <p className="text-[10px] text-emerald-700 font-semibold">
                          {item.correct_reps || 0}/{item.reps || 0} Correct
                        </p>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 text-[#9CA3AF] transition ${
                          selectedItem?.id === item.id ? 'rotate-90' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Expanded Item View */}
                  {selectedItem?.id === item.id && (
                    <div className="pt-3 mt-2 border-t border-[#F3F4F6] text-xs space-y-2 text-[#4B5563]">
                      {item.feedback && (
                        <p className="italic bg-[#F9FAFB] p-2.5 rounded-xl border border-[#E5E7EB] text-[#111111]">
                          "{item.feedback}"
                        </p>
                      )}

                      {item.mistakes && item.mistakes.length > 0 && (
                        <div>
                          <span className="font-bold text-[#111111] text-[11px] uppercase tracking-wider block mb-1">
                            Flagged Posture Notes:
                          </span>
                          <ul className="space-y-1">
                            {item.mistakes.map((m, idx) => (
                              <li key={idx} className="flex items-center gap-1.5 text-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                <span>{m}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#111111] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-black transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssistanceHistoryModal;
