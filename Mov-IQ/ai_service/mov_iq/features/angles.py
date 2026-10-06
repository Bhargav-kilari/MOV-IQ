"""Biomechanical joint angle computation for pose sequences."""

from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np


def compute_triplet_angle(
    coords: np.ndarray,
    idx_a: int,
    idx_b: int,
    idx_c: int,
    degrees: bool = True,
    in_2d: bool = False,
    eps: float = 1e-7,
) -> np.ndarray:
    """Compute the angle at vertex B formed by rays BA and BC across all frames.

    Args:
        coords: Coordinates array of shape [T, N, F] (F >= 2 for 2D, F >= 3 for 3D).
        idx_a: Landmark index for point A.
        idx_b: Landmark index for vertex B.
        idx_c: Landmark index for point C.
        degrees: If True, returns angle in degrees [0, 180]. If False, in radians [0, pi].
        in_2d: If True, uses only XY dimensions. If False, uses 3D XYZ.
        eps: Epsilon for numerical stability.

    Returns:
        1D array of angles of shape [T].
    """
    dim = 2 if in_2d else 3
    a = coords[:, idx_a, :dim]
    b = coords[:, idx_b, :dim]
    c = coords[:, idx_c, :dim]

    ba = a - b
    bc = c - b

    # Dot product along coordinate dimension
    dot_prod = np.sum(ba * bc, axis=-1)
    norm_ba = np.linalg.norm(ba, axis=-1)
    norm_bc = np.linalg.norm(bc, axis=-1)

    denom = np.maximum(norm_ba * norm_bc, eps)
    cos_angle = dot_prod / denom
    # Clip for floating point safety
    cos_angle = np.clip(cos_angle, -1.0, 1.0)
    rad_angles = np.arccos(cos_angle)

    if degrees:
        return np.degrees(rad_angles)
    return rad_angles


class JointAngleExtractor:
    """Extracts a configurable set of biomechanical joint angles from a pose sequence."""

    DEFAULT_ANGLE_SPECS = [
        {"name": "left_knee", "joints": (23, 25, 27)},      # hip - knee - ankle
        {"name": "right_knee", "joints": (24, 26, 28)},
        {"name": "left_hip", "joints": (11, 23, 25)},       # shoulder - hip - knee
        {"name": "right_hip", "joints": (12, 24, 26)},
        {"name": "left_elbow", "joints": (11, 13, 15)},     # shoulder - elbow - wrist
        {"name": "right_elbow", "joints": (12, 14, 16)},
        {"name": "left_shoulder", "joints": (23, 11, 13)},  # hip - shoulder - elbow
        {"name": "right_shoulder", "joints": (24, 12, 14)},
    ]

    def __init__(
        self,
        angle_specs: Optional[List[Dict[str, Any]]] = None,
        degrees: bool = True,
        in_2d: bool = False,
    ) -> None:
        """Initialize angle extractor.

        Args:
            angle_specs: List of dictionaries, each specifying:
                - 'name': str
                - 'joints': Tuple or List of 3 ints (A, B, C) where B is vertex
            degrees: Whether to compute angles in degrees (default True).
            in_2d: Whether to compute in 2D plane (default False, uses 3D).
        """
        self.angle_specs = angle_specs if angle_specs is not None else self.DEFAULT_ANGLE_SPECS
        self.degrees = degrees
        self.in_2d = in_2d

    @property
    def num_angles(self) -> int:
        return len(self.angle_specs)

    @property
    def feature_names(self) -> List[str]:
        return [spec["name"] for spec in self.angle_specs]

    def extract(self, landmarks: np.ndarray) -> np.ndarray:
        """Compute all specified joint angles for the landmark sequence.

        Args:
            landmarks: Array of shape [T, N, F].

        Returns:
            Angle feature array of shape [T, num_angles].
        """
        t, n, _ = landmarks.shape
        angles = np.zeros((t, len(self.angle_specs)), dtype=np.float32)

        for col_idx, spec in enumerate(self.angle_specs):
            if "joints" in spec:
                a_idx, b_idx, c_idx = spec["joints"]
            elif "joint_a" in spec and "joint_b" in spec and "joint_c" in spec:
                a_idx, b_idx, c_idx = spec["joint_a"], spec["joint_b"], spec["joint_c"]
            else:
                raise ValueError(f"Invalid angle spec: {spec}")

            # Check bounds
            if a_idx < n and b_idx < n and c_idx < n:
                angles[:, col_idx] = compute_triplet_angle(
                    landmarks,
                    a_idx,
                    b_idx,
                    c_idx,
                    degrees=self.degrees,
                    in_2d=self.in_2d,
                )
            else:
                angles[:, col_idx] = 0.0

        return angles
