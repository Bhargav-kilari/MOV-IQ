/**
 * Biomechanical Kinematics & Deterministic Rep Analysis Layer for MOV-IQ.
 *
 * MediaPipe Pose Landmark Indices:
 * 11: left_shoulder,  12: right_shoulder
 * 13: left_elbow,     14: right_elbow
 * 15: left_wrist,     16: right_wrist
 * 23: left_hip,       24: right_hip
 * 25: left_knee,      26: right_knee
 * 27: left_ankle,     28: right_ankle
 */

// Calculate 2D/3D angle between three points: A -> B (vertex) -> C
export function calculateJointAngle(pA, pB, pC) {
  if (!pA || !pB || !pC) return 180;
  const ab = { x: pA.x - pB.x, y: pA.y - pB.y, z: (pA.z || 0) - (pB.z || 0) };
  const cb = { x: pC.x - pB.x, y: pC.y - pB.y, z: (pC.z || 0) - (pC.z || 0) };

  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.hypot(ab.x, ab.y, ab.z);
  const magCB = Math.hypot(cb.x, cb.y, cb.z);

  if (magAB === 0 || magCB === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return Math.round((Math.acos(cosine) * 180) / Math.PI);
}

// Exercise Kinematic Configurations for Rep Counting & Form Verification
export const EXERCISE_KINEMATICS = {
  squat: {
    primaryAngleName: 'Knee Angle',
    getAngle: (lm) => {
      // Pick side with highest visibility
      const leftVis = (lm[23]?.visibility || 1) + (lm[25]?.visibility || 1) + (lm[27]?.visibility || 1);
      const rightVis = (lm[24]?.visibility || 1) + (lm[26]?.visibility || 1) + (lm[28]?.visibility || 1);
      return rightVis > leftVis
        ? calculateJointAngle(lm[24], lm[26], lm[28])
        : calculateJointAngle(lm[23], lm[25], lm[27]);
    },
    startThreshold: 160, // Standing straight
    inflectionThreshold: 100, // Reaching parallel squat depth
    completionThreshold: 155, // Return to stand
    checkForm: (minAngle, maxAngle, lm) => {
      const issues = [];
      let isCorrect = true;

      if (minAngle > 105) {
        issues.push('Insufficient depth (break 90° parallel)');
        isCorrect = false;
      }

      // Check knee valgus if both knees and ankles are visible
      if (lm[25] && lm[26] && lm[27] && lm[28]) {
        const kneeDist = Math.abs(lm[25].x - lm[26].x);
        const ankleDist = Math.abs(lm[27].x - lm[28].x);
        if (kneeDist < ankleDist * 0.75) {
          issues.push('Knees caving inward (knee valgus)');
          isCorrect = false;
        }
      }

      return { isCorrect, issues };
    },
  },

  bicep_curl: {
    primaryAngleName: 'Elbow Angle',
    getAngle: (lm) => {
      const leftVis = (lm[11]?.visibility || 1) + (lm[13]?.visibility || 1) + (lm[15]?.visibility || 1);
      const rightVis = (lm[12]?.visibility || 1) + (lm[14]?.visibility || 1) + (lm[16]?.visibility || 1);
      return rightVis > leftVis
        ? calculateJointAngle(lm[12], lm[14], lm[16])
        : calculateJointAngle(lm[11], lm[13], lm[15]);
    },
    startThreshold: 145, // Arm extended
    inflectionThreshold: 65, // Peak contraction
    completionThreshold: 140, // Arm returned
    checkForm: (minAngle, maxAngle) => {
      const issues = [];
      let isCorrect = true;
      if (minAngle > 75) {
        issues.push('Incomplete contraction (curl higher)');
        isCorrect = false;
      }
      if (maxAngle < 135) {
        issues.push('Incomplete extension (lower fully)');
        isCorrect = false;
      }
      return { isCorrect, issues };
    },
  },

  shoulder_press: {
    primaryAngleName: 'Elbow Angle',
    getAngle: (lm) => {
      const leftVis = (lm[11]?.visibility || 1) + (lm[13]?.visibility || 1) + (lm[15]?.visibility || 1);
      const rightVis = (lm[12]?.visibility || 1) + (lm[14]?.visibility || 1) + (lm[16]?.visibility || 1);
      return rightVis > leftVis
        ? calculateJointAngle(lm[12], lm[14], lm[16])
        : calculateJointAngle(lm[11], lm[13], lm[15]);
    },
    startThreshold: 85, // Lowered at shoulder height
    inflectionThreshold: 155, // Overhead lockout
    completionThreshold: 95, // Returned to shoulder height
    checkForm: (minAngle, maxAngle) => {
      const issues = [];
      let isCorrect = true;
      if (maxAngle < 155) {
        issues.push('Incomplete overhead lockout');
        isCorrect = false;
      }
      if (minAngle > 100) {
        issues.push('Did not lower to shoulder level');
        isCorrect = false;
      }
      return { isCorrect, issues };
    },
  },

  bench_press: {
    primaryAngleName: 'Elbow Angle',
    getAngle: (lm) => {
      return calculateJointAngle(lm[12], lm[14], lm[16]);
    },
    startThreshold: 155, // Arms extended
    inflectionThreshold: 85, // Chest touch
    completionThreshold: 150, // Arms pressed
    checkForm: (minAngle, maxAngle) => {
      const issues = [];
      let isCorrect = true;
      if (minAngle > 95) {
        issues.push('Insufficient depth (lower closer to chest)');
        isCorrect = false;
      }
      if (maxAngle < 150) {
        issues.push('Incomplete lockout');
        isCorrect = false;
      }
      return { isCorrect, issues };
    },
  },

  lateral_raise: {
    primaryAngleName: 'Shoulder Angle',
    getAngle: (lm) => {
      return calculateJointAngle(lm[24], lm[12], lm[14]);
    },
    startThreshold: 25, // Arms at sides
    inflectionThreshold: 80, // Arms parallel with ground
    completionThreshold: 30, // Arms lowered
    checkForm: (minAngle, maxAngle) => {
      const issues = [];
      let isCorrect = true;
      if (maxAngle < 75) {
        issues.push('Raise arms to shoulder height');
        isCorrect = false;
      }
      return { isCorrect, issues };
    },
  },

  lat_pulldown: {
    primaryAngleName: 'Elbow Angle',
    getAngle: (lm) => {
      return calculateJointAngle(lm[12], lm[14], lm[16]);
    },
    startThreshold: 155, // Arms overhead
    inflectionThreshold: 80, // Bar pulled to upper chest
    completionThreshold: 145, // Returned overhead
    checkForm: (minAngle) => {
      const issues = [];
      let isCorrect = true;
      if (minAngle > 90) {
        issues.push('Pull bar fully to upper chest');
        isCorrect = false;
      }
      return { isCorrect, issues };
    },
  },

  cable_row: {
    primaryAngleName: 'Elbow Angle',
    getAngle: (lm) => {
      return calculateJointAngle(lm[12], lm[14], lm[16]);
    },
    startThreshold: 150, // Arms extended
    inflectionThreshold: 80, // Pulled to torso
    completionThreshold: 140, // Returned
    checkForm: (minAngle) => {
      const issues = [];
      let isCorrect = true;
      if (minAngle > 90) {
        issues.push('Squeeze shoulder blades back completely');
        isCorrect = false;
      }
      return { isCorrect, issues };
    },
  },

  // Fallback generic kinematics for other upper/lower body movements
  default: {
    primaryAngleName: 'Joint Angle',
    getAngle: (lm) => calculateJointAngle(lm[12], lm[14], lm[16]),
    startThreshold: 150,
    inflectionThreshold: 85,
    completionThreshold: 140,
    checkForm: (minAngle, maxAngle) => ({ isCorrect: true, issues: [] }),
  },
};

export function getKinematicsConfig(exerciseKey) {
  if (!exerciseKey) return EXERCISE_KINEMATICS.default;
  const key = exerciseKey.toLowerCase().replace(/[\s-]+/g, '_');
  return EXERCISE_KINEMATICS[key] || EXERCISE_KINEMATICS.default;
}
