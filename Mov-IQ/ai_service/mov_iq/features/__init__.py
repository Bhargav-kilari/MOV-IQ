"""Feature engineering modules for human pose landmarks.

Provides modular extractors for:
- Raw flattened or filtered landmark coordinates
- Biomechanical joint angles (3D and 2D)
- Relative joint-to-joint distances
- Temporal dynamics (velocities and accelerations)
- Unified FeaturePipeline for composing active feature sets
"""

from typing import Any, Dict, List, Optional, Union
import numpy as np

from mov_iq.features.angles import JointAngleExtractor, compute_triplet_angle
from mov_iq.features.distances import JointDistanceExtractor, compute_joint_distance
from mov_iq.features.landmarks import extract_raw_landmarks
from mov_iq.features.temporal import (
    TemporalDynamicsExtractor,
    compute_temporal_difference,
)


class FeaturePipeline:
    """Configurable pipeline composing multiple pose feature extractors into a single feature vector."""

    def __init__(
        self,
        use_raw_landmarks: Union[bool, Dict[str, Any]] = True,
        use_joint_angles: bool = True,
        use_joint_distances: bool = True,
        use_temporal_dynamics: bool = True,
        raw_channels: tuple = (0, 1, 2),  # x, y, z
        angle_specs: Optional[List[Dict[str, Any]]] = None,
        distance_specs: Optional[List[Dict[str, Any]]] = None,
        fps: float = 30.0,
        **kwargs: Any,
    ) -> None:
        if "use_normalized_landmarks" in kwargs:
            use_raw_landmarks = kwargs["use_normalized_landmarks"]
        if "use_pairwise_distances" in kwargs:
            use_joint_distances = kwargs["use_pairwise_distances"]
        if "use_temporal_derivatives" in kwargs:
            use_temporal_dynamics = kwargs["use_temporal_derivatives"]

        if isinstance(use_raw_landmarks, dict):
            # Delegated instantiation from a config dictionary
            configured = self.from_config(use_raw_landmarks)
            self.use_raw_landmarks = configured.use_raw_landmarks
            self.use_joint_angles = configured.use_joint_angles
            self.use_joint_distances = configured.use_joint_distances
            self.use_temporal_dynamics = configured.use_temporal_dynamics
            self.raw_channels = configured.raw_channels
            self.angle_extractor = configured.angle_extractor
            self.distance_extractor = configured.distance_extractor
            self.dynamics_extractor = configured.dynamics_extractor
            return

        self.use_raw_landmarks = use_raw_landmarks
        self.use_joint_angles = use_joint_angles
        self.use_joint_distances = use_joint_distances
        self.use_temporal_dynamics = use_temporal_dynamics

        self.raw_channels = raw_channels
        self.angle_extractor = JointAngleExtractor(angle_specs=angle_specs)
        self.distance_extractor = JointDistanceExtractor(distance_specs=distance_specs)
        self.velocity_clip = kwargs.get("velocity_clip", None)
        self.acceleration_clip = kwargs.get("acceleration_clip", None)
        self.dynamics_extractor = TemporalDynamicsExtractor(
            fps=fps,
            include_velocity=True,
            include_acceleration=True,
            channels=raw_channels,
            velocity_clip=self.velocity_clip,
            acceleration_clip=self.acceleration_clip,
        )

    def __call__(self, landmarks: np.ndarray) -> np.ndarray:
        """Extract and concatenate all active feature groups for a sequence.

        Args:
            landmarks: Array of shape [T, N, F].

        Returns:
            Concatenated features array of shape [T, Total_D].
        """
        feature_blocks = []
        t = landmarks.shape[0]

        # 1. Raw coordinates
        if self.use_raw_landmarks:
            raw = extract_raw_landmarks(landmarks, channels=self.raw_channels, flatten=True)
            feature_blocks.append(raw)

        # 2. Joint angles
        if self.use_joint_angles:
            angles = self.angle_extractor.extract(landmarks)
            feature_blocks.append(angles)

        # 3. Joint distances
        if self.use_joint_distances:
            distances = self.distance_extractor.extract(landmarks)
            feature_blocks.append(distances)

        # 4. Temporal dynamics
        if self.use_temporal_dynamics:
            dynamics = self.dynamics_extractor.extract(landmarks)
            feature_blocks.append(dynamics)

        if not feature_blocks:
            # Fallback: flatten all landmarks
            return landmarks.reshape(t, -1).astype(np.float32)

        return np.concatenate(feature_blocks, axis=-1).astype(np.float32)

    def compute_feature_dim(self, num_landmarks: int = 33, num_channels: int = 4) -> int:
        """Compute the total output feature dimension D for a given topology N."""
        dummy = np.zeros((2, num_landmarks, num_channels), dtype=np.float32)
        out = self(dummy)
        return out.shape[1]

    @property
    def feature_dim(self) -> int:
        """Convenience property for feature dimension with default 33 landmarks."""
        return self.compute_feature_dim(33, 4)

    def get_active_feature_groups(self) -> Dict[str, bool]:
        """Return status of individual feature groups."""
        return {
            "raw_landmarks": self.use_raw_landmarks,
            "joint_angles": self.use_joint_angles,
            "joint_distances": self.use_joint_distances,
            "temporal_dynamics": self.use_temporal_dynamics,
        }

    def get_feature_breakdown(self, num_landmarks: int = 33, num_channels: int = 4) -> Dict[str, int]:
        """Return dimension count per feature group."""
        breakdown = {}
        if self.use_raw_landmarks:
            ch_count = len(self.raw_channels) if self.raw_channels else num_channels
            breakdown["raw_landmarks"] = num_landmarks * ch_count
        else:
            breakdown["raw_landmarks"] = 0

        breakdown["joint_angles"] = self.angle_extractor.num_angles if self.use_joint_angles else 0
        breakdown["joint_distances"] = self.distance_extractor.num_distances if self.use_joint_distances else 0

        if self.use_temporal_dynamics:
            ch_count = len(self.raw_channels) if self.raw_channels else num_channels
            dyn_dim = 0
            if self.dynamics_extractor.include_velocity:
                dyn_dim += num_landmarks * ch_count
            if self.dynamics_extractor.include_acceleration:
                dyn_dim += num_landmarks * ch_count
            breakdown["temporal_dynamics"] = dyn_dim
        else:
            breakdown["temporal_dynamics"] = 0

        breakdown["total"] = sum(breakdown.values())
        return breakdown

    def get_feature_names(self, num_landmarks: int = 33) -> List[str]:
        """Generate human-readable names for all D feature dimensions."""
        names = []
        ch_names = ["x", "y", "z", "vis"]
        if self.use_raw_landmarks:
            for i in range(num_landmarks):
                for ch in self.raw_channels:
                    ch_str = ch_names[ch] if ch < len(ch_names) else f"ch{ch}"
                    names.append(f"lm_{i}_{ch_str}")

        if self.use_joint_angles:
            names.extend([f"angle_{name}" for name in self.angle_extractor.feature_names])

        if self.use_joint_distances:
            names.extend([f"dist_{name}" for name in self.distance_extractor.feature_names])

        if self.use_temporal_dynamics:
            if self.dynamics_extractor.include_velocity:
                for i in range(num_landmarks):
                    for ch in self.raw_channels:
                        ch_str = ch_names[ch] if ch < len(ch_names) else f"ch{ch}"
                        names.append(f"vel_{i}_{ch_str}")
            if self.dynamics_extractor.include_acceleration:
                for i in range(num_landmarks):
                    for ch in self.raw_channels:
                        ch_str = ch_names[ch] if ch < len(ch_names) else f"ch{ch}"
                        names.append(f"acc_{i}_{ch_str}")

        return names

    @classmethod
    def from_config(cls, cfg: Dict[str, Any]) -> "FeaturePipeline":
        """Instantiate pipeline from dataset configuration supporting flexible group keys and enabled flags."""
        if "features" in cfg:
            feat_cfg = cfg["features"]
            temp_cfg = cfg.get("temporal") or cfg.get("dataset", {}).get("temporal", {})
        elif "dataset" in cfg and "features" in cfg["dataset"]:
            feat_cfg = cfg["dataset"]["features"]
            temp_cfg = cfg["dataset"].get("temporal", {})
        else:
            feat_cfg = cfg
            temp_cfg = {}

        raw_val = feat_cfg.get("use_raw_landmarks", feat_cfg.get("raw_landmarks", True))
        use_raw = raw_val.get("enabled", True) if isinstance(raw_val, dict) else bool(raw_val)

        angles_val = feat_cfg.get("use_joint_angles", feat_cfg.get("joint_angles", True))
        use_angles = angles_val.get("enabled", True) if isinstance(angles_val, dict) else bool(angles_val)
        angle_specs = angles_val.get("angles", None) if isinstance(angles_val, dict) else feat_cfg.get("angles", None)

        dist_val = feat_cfg.get("use_joint_distances", feat_cfg.get("joint_distances", True))
        use_distances = dist_val.get("enabled", True) if isinstance(dist_val, dict) else bool(dist_val)
        dist_specs = dist_val.get("pairs", None) if isinstance(dist_val, dict) else feat_cfg.get("distances", None)

        dyn_val = feat_cfg.get("use_temporal_dynamics", feat_cfg.get("temporal_dynamics", True))
        use_dynamics = dyn_val.get("enabled", True) if isinstance(dyn_val, dict) else bool(dyn_val)

        return cls(
            use_raw_landmarks=use_raw,
            use_joint_angles=use_angles,
            use_joint_distances=use_distances,
            use_temporal_dynamics=use_dynamics,
            angle_specs=angle_specs,
            distance_specs=dist_specs,
            fps=float(temp_cfg.get("target_fps", 30.0)),
        )


__all__ = [
    "extract_raw_landmarks",
    "compute_triplet_angle",
    "JointAngleExtractor",
    "compute_joint_distance",
    "JointDistanceExtractor",
    "compute_temporal_difference",
    "TemporalDynamicsExtractor",
    "FeaturePipeline",
]
