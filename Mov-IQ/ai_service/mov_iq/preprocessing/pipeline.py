"""Unified preprocessing pipeline composing cleaning, normalization, and temporal windowing."""

import logging
from typing import Any, Dict, List, Optional
import numpy as np

from mov_iq.preprocessing.cleaning import clean_landmarks
from mov_iq.preprocessing.normalization import PoseNormalizer

logger = logging.getLogger(__name__)


class TemporalProcessor:
    """Temporal sequence windowing, padding, truncation, and sliding-window segmentation."""

    def __init__(
        self,
        target_length: int = 64,
        mode: str = "fixed_window",
        stride: int = 32,
        padding_mode: str = "edge",
    ) -> None:
        """Initialize temporal processor.

        Args:
            target_length: Desired frame count (T).
            mode: 'fixed_window', 'sliding_window', or 'none'.
            stride: Stride between windows when mode is 'sliding_window'.
            padding_mode: 'edge' (repeat boundary frame), 'zero', or 'reflect'.
        """
        self.target_length = target_length
        self.mode = mode
        self.stride = stride
        self.padding_mode = padding_mode

    def process(self, landmarks: np.ndarray) -> np.ndarray:
        """Adjust temporal dimension to target_length."""
        if self.mode == "none":
            return landmarks
        return self.pad_or_truncate(landmarks, self.target_length, self.padding_mode)

    @staticmethod
    def pad_or_truncate(
        landmarks: np.ndarray,
        target_length: int,
        padding_mode: str = "edge",
    ) -> np.ndarray:
        """Ensure landmarks array has exactly target_length frames along axis 0.

        Args:
            landmarks: Array of shape [T, N, F].
            target_length: Target frame length.
            padding_mode: 'edge', 'zero', or 'reflect'.

        Returns:
            Adjusted array of shape [target_length, N, F].
        """
        t, n, f = landmarks.shape

        if t == target_length:
            return landmarks.copy()

        if t > target_length:
            # Symmetrically truncate from center or take leading frames
            start = (t - target_length) // 2
            return landmarks[start : start + target_length].copy()

        # Need padding: t < target_length
        pad_len = target_length - t

        if padding_mode == "zero":
            pad = np.zeros((pad_len, n, f), dtype=landmarks.dtype)
            return np.concatenate([landmarks, pad], axis=0)

        elif padding_mode == "edge":
            # Repeat the last frame
            last_frame = landmarks[-1:, :, :]
            pad = np.repeat(last_frame, pad_len, axis=0)
            return np.concatenate([landmarks, pad], axis=0)

        elif padding_mode == "reflect":
            pad = np.pad(landmarks, ((0, pad_len), (0, 0), (0, 0)), mode="reflect")
            return pad[:target_length]

        else:
            pad = np.zeros((pad_len, n, f), dtype=landmarks.dtype)
            return np.concatenate([landmarks, pad], axis=0)

    def generate_sliding_windows(
        self,
        landmarks: np.ndarray,
    ) -> List[np.ndarray]:
        """Generate overlapping fixed-size windows from a continuous sequence."""
        t, n, f = landmarks.shape
        if t < self.target_length:
            return [self.pad_or_truncate(landmarks, self.target_length, self.padding_mode)]

        windows = []
        for start in range(0, t - self.target_length + 1, self.stride):
            windows.append(landmarks[start : start + self.target_length].copy())

        # Include trailing window if remainder exists and windows is empty
        if not windows:
            windows.append(landmarks[-self.target_length :].copy())

        return windows


class PreprocessingPipeline:
    """Configurable preprocessing pipeline executing cleaning, normalization, and temporal windowing."""

    def __init__(
        self,
        cleaning_enabled: bool = True,
        handle_missing: str = "interpolate",
        max_consecutive_missing: int = 5,
        min_visibility: float = 0.1,
        normalization_enabled: bool = True,
        center_joint: Optional[str] = "mid_hip",
        scale_reference: Optional[str] = "torso_length",
        align_orientation: bool = False,
        temporal_enabled: bool = True,
        sequence_length: int = 64,
        target_sequence_length: Optional[int] = None,
        padding_mode: str = "edge",
        sampling_strategy: Optional[str] = None,
    ) -> None:
        self.cleaning_enabled = cleaning_enabled
        self.handle_missing = handle_missing
        self.max_consecutive_missing = max_consecutive_missing
        self.min_visibility = min_visibility

        self.normalization_enabled = normalization_enabled
        self.normalizer = PoseNormalizer(
            center_joint=center_joint,
            scale_reference=scale_reference,
            align_orientation=align_orientation,
        )

        eff_seq_len = target_sequence_length if target_sequence_length is not None else sequence_length
        self.temporal_enabled = temporal_enabled
        self.temporal_processor = TemporalProcessor(
            target_length=eff_seq_len,
            mode="fixed_window" if temporal_enabled else "none",
            padding_mode=padding_mode,
        )

    def __call__(self, landmarks: np.ndarray) -> np.ndarray:
        """Execute full preprocessing pipeline on landmarks array [T, N, F]."""
        processed = landmarks

        # 1. Cleaning
        if self.cleaning_enabled:
            processed, _ = clean_landmarks(
                processed,
                handle_missing=self.handle_missing,
                max_consecutive_missing=self.max_consecutive_missing,
                min_visibility=self.min_visibility,
            )

        # 2. Normalization
        if self.normalization_enabled:
            processed = self.normalizer.normalize(processed)

        # 3. Temporal Windowing
        if self.temporal_enabled:
            processed = self.temporal_processor.process(processed)

        return processed

    @classmethod
    def from_config(cls, cfg: Dict[str, Any]) -> "PreprocessingPipeline":
        """Instantiate pipeline from dataset configuration dictionary."""
        p_cfg = cfg.get("preprocessing", {})
        d_p_cfg = cfg.get("dataset", {}).get("preprocessing", {})
        prep_cfg = {**d_p_cfg, **p_cfg}

        temp_cfg = cfg.get("temporal", {}) or cfg.get("dataset", {}).get("temporal", {})

        cleaning_cfg = prep_cfg.get("cleaning", {})
        norm_cfg = prep_cfg.get("normalization", {})

        seq_len = (
            temp_cfg.get("sequence_length")
            or temp_cfg.get("target_length")
            or prep_cfg.get("target_sequence_length")
            or prep_cfg.get("sequence_length", 64)
        )
        pad_mode = temp_cfg.get("padding_mode") or prep_cfg.get("padding_mode", "edge")

        return cls(
            cleaning_enabled=cleaning_cfg.get("enabled", True),
            handle_missing=cleaning_cfg.get("handle_missing", prep_cfg.get("imputation_strategy", "interpolate")),
            max_consecutive_missing=cleaning_cfg.get("max_consecutive_missing", 5),
            min_visibility=cleaning_cfg.get("min_valid_visibility", 0.1),
            normalization_enabled=norm_cfg.get("enabled", True),
            center_joint=norm_cfg.get("center_joint", prep_cfg.get("center_joint", "mid_hip")),
            scale_reference=norm_cfg.get("scale_reference", prep_cfg.get("scale_strategy", "torso_length")),
            align_orientation=norm_cfg.get("align_orientation", False),
            temporal_enabled=True,
            sequence_length=seq_len,
            padding_mode=pad_mode,
        )
