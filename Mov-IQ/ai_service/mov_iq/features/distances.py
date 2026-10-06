"""Relative joint distance features for pose sequences."""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np


def compute_joint_distance(
    coords: np.ndarray,
    idx_a: int,
    idx_b: int,
    in_2d: bool = False,
) -> np.ndarray:
    """Compute Euclidean distance between two joints across all frames.

    Args:
        coords: Coordinates array of shape [T, N, F] (F >= 2).
        idx_a: First landmark index.
        idx_b: Second landmark index.
        in_2d: If True, uses only XY dimensions.

    Returns:
        1D array of distances of shape [T].
    """
    dim = 2 if in_2d else 3
    a = coords[:, idx_a, :dim]
    b = coords[:, idx_b, :dim]
    return np.linalg.norm(a - b, axis=-1)


class JointDistanceExtractor:
    """Extracts a configurable set of Euclidean distance features between joint pairs."""

    DEFAULT_DISTANCE_SPECS = [
        {"name": "feet_distance", "joints": (27, 28)},       # left ankle to right ankle
        {"name": "hands_distance", "joints": (15, 16)},      # left wrist to right wrist
        {"name": "knees_distance", "joints": (25, 26)},      # left knee to right knee
        {"name": "left_hand_to_hip", "joints": (15, 23)},    # left wrist to left hip
        {"name": "right_hand_to_hip", "joints": (16, 24)},   # right wrist to right hip
        {"name": "torso_diagonal_1", "joints": (11, 24)},    # left shoulder to right hip
        {"name": "torso_diagonal_2", "joints": (12, 23)},    # right shoulder to left hip
    ]

    def __init__(
        self,
        distance_specs: Optional[List[Dict[str, Any]]] = None,
        in_2d: bool = False,
    ) -> None:
        """Initialize distance extractor.

        Args:
            distance_specs: List of dictionaries with 'name' and 'joints' (A, B).
            in_2d: Whether to compute distance in XY plane only.
        """
        self.distance_specs = (
            distance_specs if distance_specs is not None else self.DEFAULT_DISTANCE_SPECS
        )
        self.in_2d = in_2d

    @property
    def num_distances(self) -> int:
        return len(self.distance_specs)

    @property
    def feature_names(self) -> List[str]:
        return [spec["name"] for spec in self.distance_specs]

    def extract(self, landmarks: np.ndarray) -> np.ndarray:
        """Compute all specified joint distances for the landmark sequence.

        Args:
            landmarks: Array of shape [T, N, F].

        Returns:
            Distance feature array of shape [T, num_distances].
        """
        t, n, _ = landmarks.shape
        distances = np.zeros((t, len(self.distance_specs)), dtype=np.float32)

        for col_idx, spec in enumerate(self.distance_specs):
            if "joints" in spec:
                a_idx, b_idx = spec["joints"]
            elif "joint_a" in spec and "joint_b" in spec:
                a_idx, b_idx = spec["joint_a"], spec["joint_b"]
            else:
                raise ValueError(f"Invalid distance spec: {spec}")

            if a_idx < n and b_idx < n:
                distances[:, col_idx] = compute_joint_distance(
                    landmarks,
                    a_idx,
                    b_idx,
                    in_2d=self.in_2d,
                )
            else:
                distances[:, col_idx] = 0.0

        return distances
