"""Fold-specific preprocessing fitting and strict isolation enforcement for MOV-IQ.

Guarantees zero data leakage between cross-validation evaluation folds and
data-derived preprocessing parameters (such as velocity/acceleration clipping
thresholds and standardization scalers).
"""

from dataclasses import asdict, dataclass, field
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple, Union
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Documented baseline reference thresholds from holdout partition
HOLDOUT_REFERENCE_THRESHOLDS = {
    "velocity_component_clip": [-35.0, 35.0],
    "velocity_unit": "TL/s",
    "acceleration_component_clip": [-2500.0, 2500.0],
    "acceleration_unit": "TL/s^2",
    "notes": "Holdout partition baseline reference values. Must not be used as fold-fitted thresholds."
}


@dataclass
class FoldPreprocessingConfig:
    """Holds fitted preprocessing parameters for a single cross-validation fold."""

    fold_id: str
    train_source_groups: List[str]
    test_source_groups: List[str]
    train_clips: List[str]
    test_clips: List[str]
    train_transitions_count: int
    train_frames_count: int
    velocity_clip: Tuple[float, float]
    velocity_percentile: float
    acceleration_clip: Tuple[float, float]
    acceleration_percentile: float
    training_velocity_fraction_clipped: float
    training_acceleration_fraction_clipped: float
    velocity_percentiles_dict: Dict[str, float] = field(default_factory=dict)
    acceleration_percentiles_dict: Dict[str, float] = field(default_factory=dict)
    coordinate_mean: Optional[List[List[float]]] = None  # [33, 3]
    coordinate_std: Optional[List[List[float]]] = None   # [33, 3]
    reference_thresholds: Dict[str, Any] = field(default_factory=lambda: dict(HOLDOUT_REFERENCE_THRESHOLDS))
    leakage_assertion_passed: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "FoldPreprocessingConfig":
        data = dict(d)
        data["velocity_clip"] = tuple(data["velocity_clip"])
        data["acceleration_clip"] = tuple(data["acceleration_clip"])
        return cls(**data)


class FoldPreprocessingFitter:
    """Fits data-derived preprocessing parameters strictly on each fold's training source groups."""

    def __init__(
        self,
        velocity_percentile: float = 99.9,
        acceleration_percentile: float = 99.7,
    ) -> None:
        self.velocity_percentile = velocity_percentile
        self.acceleration_percentile = acceleration_percentile

    def fit_fold(
        self,
        fold_id: str,
        split_df: pd.DataFrame,
        pose_dir: Union[str, Path],
    ) -> FoldPreprocessingConfig:
        """Fit parameters strictly using training source groups of fold_id.

        Args:
            fold_id: Target fold identifier (e.g. 'fold_0').
            split_df: DataFrame containing at least 'clip_id', 'source_group_id', and 'groupkfold_5fold'.
            pose_dir: Path to directory containing 'normalized/' and 'temporal/' subdirectories.

        Returns:
            FoldPreprocessingConfig containing fitted parameters.

        Raises:
            AssertionError: If any test source group contributed to the training set.
        """
        pose_path = Path(pose_dir)
        train_rows = split_df[split_df["groupkfold_5fold"] != fold_id]
        test_rows = split_df[split_df["groupkfold_5fold"] == fold_id]

        train_sgs: Set[str] = set(train_rows["source_group_id"].unique())
        test_sgs: Set[str] = set(test_rows["source_group_id"].unique())

        # Strict Programmatic Assertion: Zero Group Overlap
        leakage = train_sgs.intersection(test_sgs)
        if len(leakage) > 0:
            raise AssertionError(
                f"LEAKAGE DETECTED in {fold_id}! Test source groups present in train: {sorted(list(leakage))}"
            )

        train_clips = train_rows["clip_id"].tolist()
        test_clips = test_rows["clip_id"].tolist()

        logger.info(
            "Fitting fold %s on %d training source groups (%d clips). Test source groups: %d (%d clips).",
            fold_id,
            len(train_sgs),
            len(train_clips),
            len(test_sgs),
            len(test_clips),
        )

        v_components: List[np.ndarray] = []
        a_components: List[np.ndarray] = []
        train_transitions = 0
        train_frames = 0
        coord_sums = np.zeros((33, 3), dtype=np.float64)
        coord_sq_sums = np.zeros((33, 3), dtype=np.float64)
        coord_counts = np.zeros((33, 3), dtype=np.int64)

        for cid in train_clips:
            t_file = pose_path / "temporal" / f"{cid}.npz"
            n_file = pose_path / "normalized" / f"{cid}.npz"

            if not t_file.is_file() or not n_file.is_file():
                logger.warning("Missing pose artifact for training clip %s", cid)
                continue

            with np.load(t_file) as t_npz, np.load(n_file) as n_npz:
                vel = t_npz["velocities"]  # [T, 33, 3]
                acc = t_npz["accelerations"]  # [T, 33, 3]
                landmarks = n_npz["landmarks"][:, :, :3]  # [T, 33, 3]
                detected = n_npz["pose_detected"]
                interpolated = n_npz["interpolated_mask"]

                valid = detected | interpolated
                t_len = len(valid)
                train_frames += t_len

                # Spatial landmark moments for valid frames
                valid_lms = landmarks[valid]
                if len(valid_lms) > 0:
                    coord_sums += valid_lms.sum(axis=0)
                    coord_sq_sums += (valid_lms ** 2).sum(axis=0)
                    coord_counts += len(valid_lms)

                # Velocity contiguous transitions: valid[t] & valid[t-1]
                if t_len > 1:
                    v_trans = valid[1:] & valid[:-1]
                    train_transitions += int(np.sum(v_trans))
                    v_valid = vel[1:][v_trans]
                    if len(v_valid) > 0:
                        v_c = np.abs(v_valid).reshape(-1)
                        v_components.append(v_c[~np.isnan(v_c)])

                # Acceleration contiguous transitions: valid[t] & valid[t-1] & valid[t-2]
                if t_len > 2:
                    a_trans = valid[2:] & valid[1:-1] & valid[:-2]
                    a_valid = acc[2:][a_trans]
                    if len(a_valid) > 0:
                        a_c = np.abs(a_valid).reshape(-1)
                        a_components.append(a_c[~np.isnan(a_c)])

        if not v_components or not a_components:
            raise ValueError(f"Insufficient training data collected for fold {fold_id}")

        all_v = np.concatenate(v_components)
        all_a = np.concatenate(a_components)

        # Percentiles
        v_pcts = {str(p): float(np.percentile(all_v, p)) for p in [50, 90, 95, 99, 99.5, 99.9, 100]}
        a_pcts = {str(p): float(np.percentile(all_a, p)) for p in [50, 90, 95, 99, 99.5, 99.7, 99.9, 100]}

        v_thresh = float(np.round(v_pcts.get(str(self.velocity_percentile), 35.0), 1))
        a_raw = a_pcts.get(str(self.acceleration_percentile), 2500.0)
        a_thresh = float(np.round(a_raw / 10.0) * 10.0)

        v_clip_rate = float(np.mean(all_v > v_thresh) * 100)
        a_clip_rate = float(np.mean(all_a > a_thresh) * 100)

        # Spatial coordinate standardization
        mean_coords = (coord_sums / np.maximum(coord_counts, 1)).tolist()
        var_coords = np.maximum((coord_sq_sums / np.maximum(coord_counts, 1)) - (np.array(mean_coords) ** 2), 1e-6)
        std_coords = np.sqrt(var_coords).tolist()

        return FoldPreprocessingConfig(
            fold_id=fold_id,
            train_source_groups=sorted(list(train_sgs)),
            test_source_groups=sorted(list(test_sgs)),
            train_clips=train_clips,
            test_clips=test_clips,
            train_transitions_count=train_transitions,
            train_frames_count=train_frames,
            velocity_clip=(-v_thresh, v_thresh),
            velocity_percentile=self.velocity_percentile,
            acceleration_clip=(-a_thresh, a_thresh),
            acceleration_percentile=self.acceleration_percentile,
            training_velocity_fraction_clipped=v_clip_rate,
            training_acceleration_fraction_clipped=a_clip_rate,
            velocity_percentiles_dict=v_pcts,
            acceleration_percentiles_dict=a_pcts,
            coordinate_mean=mean_coords,
            coordinate_std=std_coords,
            leakage_assertion_passed=True,
        )

    def fit_all_folds(
        self,
        split_csv_path: Union[str, Path],
        pose_dir: Union[str, Path],
        output_json_path: Optional[Union[str, Path]] = None,
    ) -> Dict[str, FoldPreprocessingConfig]:
        """Fit preprocessing parameters for all cross-validation folds."""
        split_df = pd.read_csv(split_csv_path)
        folds = sorted(split_df["groupkfold_5fold"].unique())

        results: Dict[str, FoldPreprocessingConfig] = {}
        for f in folds:
            cfg = self.fit_fold(f, split_df, pose_dir)
            results[f] = cfg

        if output_json_path is not None:
            out_file = Path(output_json_path)
            out_file.parent.mkdir(parents=True, exist_ok=True)
            serializable = {
                "metadata": {
                    "description": "Fold-specific fitted preprocessing parameters for MOV-IQ 5-Fold GroupKFold CV.",
                    "leakage_safety": "Each fold fitted strictly on training source groups with zero test group exposure.",
                    "reference_baseline": HOLDOUT_REFERENCE_THRESHOLDS,
                },
                "folds": {k: v.to_dict() for k, v in results.items()},
            }
            with open(out_file, "w", encoding="utf-8") as fp:
                json.dump(serializable, fp, indent=2)
            logger.info("Saved fold-specific preprocessing configuration to %s", out_file)

        return results


class FoldPreprocessingTransformer:
    """Applies fold-specific clipping and scaling transformations without modifying source files."""

    def __init__(self, fold_config: FoldPreprocessingConfig) -> None:
        self.config = fold_config
        self.v_min, self.v_max = fold_config.velocity_clip
        self.a_min, self.a_max = fold_config.acceleration_clip
        if fold_config.coordinate_mean is not None:
            self.mean = np.array(fold_config.coordinate_mean, dtype=np.float32)
            self.std = np.array(fold_config.coordinate_std, dtype=np.float32)
        else:
            self.mean = None
            self.std = None

    @classmethod
    def from_config_file(
        cls,
        config_path: Union[str, Path],
        fold_id: str,
    ) -> "FoldPreprocessingTransformer":
        """Instantiate transformer directly from persisted fold config JSON."""
        with open(config_path, "r", encoding="utf-8") as fp:
            data = json.load(fp)
        folds = data.get("folds", {})
        if fold_id not in folds:
            raise KeyError(f"Fold '{fold_id}' not found in {config_path}. Available: {list(folds.keys())}")
        fold_cfg = FoldPreprocessingConfig.from_dict(folds[fold_id])
        return cls(fold_cfg)

    def clip_velocities(self, vel: Union[np.ndarray, Any]) -> Any:
        """Clip velocity components to fold training-fitted bounds."""
        if isinstance(vel, np.ndarray):
            return np.clip(vel, self.v_min, self.v_max)
        # Handle PyTorch tensors
        import torch
        if isinstance(vel, torch.Tensor):
            return torch.clamp(vel, self.v_min, self.v_max)
        return vel

    def clip_accelerations(self, acc: Union[np.ndarray, Any]) -> Any:
        """Clip acceleration components to fold training-fitted bounds."""
        if isinstance(acc, np.ndarray):
            return np.clip(acc, self.a_min, self.a_max)
        import torch
        if isinstance(acc, torch.Tensor):
            return torch.clamp(acc, self.a_min, self.a_max)
        return acc

    def standardize_landmarks(self, landmarks: np.ndarray) -> np.ndarray:
        """Standardize spatial landmarks using fold training mean and std."""
        if self.mean is None or self.std is None:
            return landmarks
        out = landmarks.copy()
        out[:, :, :3] = (out[:, :, :3] - self.mean) / self.std
        return out


def verify_fold_isolation(
    config_json_path: Union[str, Path],
    split_csv_path: Union[str, Path],
) -> bool:
    """Audit saved fold configuration to confirm zero test source-group leakage.

    Returns:
        True if all folds are certified isolated.
    Raises:
        AssertionError if any fold exhibits leakage.
    """
    with open(config_json_path, "r", encoding="utf-8") as fp:
        data = json.load(fp)

    split_df = pd.read_csv(split_csv_path)
    folds_data = data.get("folds", {})

    for fold_id, f_cfg in folds_data.items():
        train_sgs = set(f_cfg["train_source_groups"])
        test_sgs = set(f_cfg["test_source_groups"])

        # Check disjointness
        overlap = train_sgs.intersection(test_sgs)
        if len(overlap) > 0:
            raise AssertionError(f"Fold {fold_id} has leakage: {overlap}")

        # Cross-reference with split dataframe
        df_test_sgs = set(split_df[split_df["groupkfold_5fold"] == fold_id]["source_group_id"].unique())
        if df_test_sgs != test_sgs:
            raise AssertionError(f"Fold {fold_id} test groups mismatch split proposal CSV!")

    return True
