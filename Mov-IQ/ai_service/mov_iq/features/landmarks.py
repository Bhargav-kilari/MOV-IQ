"""Raw landmark feature extraction and selection."""

from typing import List, Optional, Tuple, Union
import numpy as np


def extract_raw_landmarks(
    landmarks: np.ndarray,
    channels: Optional[Union[List[int], Tuple[int, ...]]] = (0, 1, 2),  # default x, y, z
    joint_indices: Optional[List[int]] = None,
    flatten: bool = True,
) -> np.ndarray:
    """Extract and selectively flatten raw landmark coordinate channels.

    Args:
        landmarks: Array of shape [T, N, F].
        channels: Channel indices to keep (e.g. (0, 1, 2) for x, y, z). If None, keeps all F.
        joint_indices: Specific joint indices to select. If None, selects all N joints.
        flatten: If True, flattens spatial dimensions into [T, selected_joints * selected_channels].
            If False, returns [T, len(joint_indices), len(channels)].

    Returns:
        Extracted raw feature array.
    """
    t, n, f = landmarks.shape

    # Select joints
    selected = landmarks
    if joint_indices is not None:
        selected = selected[:, joint_indices, :]

    # Select channels
    if channels is not None:
        selected = selected[:, :, channels]

    if flatten:
        t_cur = selected.shape[0]
        return selected.reshape(t_cur, -1)

    return selected
