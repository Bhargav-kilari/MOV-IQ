"""Data cleaning and landmark integrity handling for pose sequences."""

import logging
from typing import Optional, Tuple
import numpy as np

logger = logging.getLogger(__name__)


def detect_missing_landmarks(
    landmarks: np.ndarray,
    min_visibility: float = 0.1,
) -> np.ndarray:
    """Identify invalid or missing landmark entries across temporal sequence.

    Args:
        landmarks: Array of shape [T, N, F].
        min_visibility: Visibility channel threshold below which a joint is considered occluded.

    Returns:
        Boolean mask of shape [T, N] where True indicates a missing or invalid landmark.
    """
    t, n, f = landmarks.shape

    # Check for NaN / Inf in coordinates
    nan_mask = np.isnan(landmarks).any(axis=-1) | np.isinf(landmarks).any(axis=-1)

    # Check if visibility channel exists and is below threshold
    if f >= 4:
        vis_mask = landmarks[:, :, 3] < min_visibility
        missing_mask = nan_mask | vis_mask
    else:
        # If no visibility channel, check if all coordinates are identically zero
        zero_mask = np.all(np.isclose(landmarks[:, :, :3], 0.0), axis=-1)
        missing_mask = nan_mask | zero_mask

    return missing_mask


def interpolate_missing_landmarks(
    landmarks: np.ndarray,
    missing_mask: np.ndarray,
    max_consecutive: int = 5,
) -> np.ndarray:
    """Linearly interpolate missing landmark coordinates along the temporal axis.

    Args:
        landmarks: Array of shape [T, N, F].
        missing_mask: Boolean mask of shape [T, N].
        max_consecutive: Maximum consecutive missing frames to linearly interpolate.
            Gaps larger than this are filled with the nearest boundary value.

    Returns:
        Cleaned landmarks array of shape [T, N, F].
    """
    cleaned = landmarks.copy()
    t, n, f = cleaned.shape

    for joint_idx in range(n):
        missing = missing_mask[:, joint_idx]
        if not np.any(missing):
            continue

        valid_indices = np.where(~missing)[0]
        if len(valid_indices) == 0:
            # Entire joint sequence is missing: replace NaNs with zeros
            cleaned[:, joint_idx, :] = np.nan_to_num(cleaned[:, joint_idx, :], nan=0.0)
            continue

        for ch in range(f):
            channel_vals = cleaned[:, joint_idx, ch]
            # Interpolate valid points
            interpolated = np.interp(
                np.arange(t),
                valid_indices,
                channel_vals[valid_indices],
            )
            cleaned[:, joint_idx, ch] = interpolated

    return cleaned


def clean_landmarks(
    landmarks: np.ndarray,
    handle_missing: str = "interpolate",
    max_consecutive_missing: int = 5,
    min_visibility: float = 0.1,
) -> Tuple[np.ndarray, bool]:
    """Clean raw landmark sequences according to configurable strategies.

    Args:
        landmarks: Raw landmark array of shape [T, N, F].
        handle_missing: Strategy: 'interpolate', 'forward_fill', 'zero', or 'none'.
        max_consecutive_missing: Threshold for consecutive missing frames.
        min_visibility: Minimum visibility threshold.

    Returns:
        Tuple of (cleaned_landmarks, sequence_integrity_valid).
    """
    missing_mask = detect_missing_landmarks(landmarks, min_visibility=min_visibility)

    # Check maximum consecutive missing frames
    integrity_valid = True
    for joint_idx in range(landmarks.shape[1]):
        miss = missing_mask[:, joint_idx]
        max_streak = 0
        current_streak = 0
        for m in miss:
            if m:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 0

        if max_streak > max_consecutive_missing:
            integrity_valid = False

    if handle_missing == "interpolate":
        cleaned = interpolate_missing_landmarks(
            landmarks,
            missing_mask,
            max_consecutive=max_consecutive_missing,
        )
    elif handle_missing == "zero":
        cleaned = np.nan_to_num(landmarks, nan=0.0)
    elif handle_missing == "none":
        cleaned = landmarks.copy()
    else:
        logger.warning("Unknown missing handling strategy '%s', skipping", handle_missing)
        cleaned = landmarks.copy()

    return cleaned, integrity_valid
