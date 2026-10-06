/**
 * MOV-IQ AI ASSISTANCE MODULE
 *
 * Dedicated, isolated module for real-time exercise form analysis,
 * camera streaming, landmark ingestion, and biomechanical coaching.
 */

export { AIAssistancePage } from '../pages/AIAssistancePage';
export { AIAssistanceExerciseSelector } from '../components/ai/AIAssistanceExerciseSelector';
export { AIAssistanceCameraSetup } from '../components/ai/AIAssistanceCameraSetup';
export { AIAssistanceLiveSession } from '../components/ai/AIAssistanceLiveSession';
export { AIAssistanceAssessment } from '../components/ai/AIAssistanceAssessment';
export { AIAssistanceHistoryModal } from '../components/ai/AIAssistanceHistoryModal';
export { aiService } from '../services/aiService';
export { getKinematicsConfig, calculateJointAngle } from '../utils/aiKinematics';
