"""Pose normalization components for spatial translation, scale, and orientation."""

import logging
from typing import Optional, Tuple, Union
import numpy as np

logger = logging.getLogger(__name__)


class PoseNormalizer:
    """Configurable spatial normalization for human pose landmark sequences.

    Decouples raw sensor camera distance, body subject height, and frame positioning
    from the invariant movement dynamics.
    """

    def __init__(
        self,
        center_joint: Optional[str] = "mid_hip",
        scale_reference: Optional[str] = "torso_length",
        align_orientation: bool = False,
        left_hip_idx: int = 23,
        right_hip_idx: int = 24,
        left_shoulder_idx: int = 11,
        right_shoulder_idx: int = 12,
        eps: float = 1e-6,
    ) -> None:
        """Initialize normalization configuration.

        Args:
            center_joint: 'mid_hip', 'mid_shoulder', 'origin', or None.
            scale_reference: 'torso_length', 'shoulder_width', 'bbox_diagonal', or None.
            align_orientation: Whether to rotate the torso to face the coronal camera plane.
            left_hip_idx: Landmark index for left hip (default MediaPipe 23).
            right_hip_idx: Landmark index for right hip (default MediaPipe 24).
            left_shoulder_idx: Landmark index for left shoulder (default MediaPipe 11).
            right_shoulder_idx: Landmark index for right shoulder (default MediaPipe 12).
            eps: Epsilon to prevent division by zero during scaling.
        """
        self.center_joint = center_joint
        self.scale_reference = scale_reference
        self.align_orientation = align_orientation
        self.left_hip_idx = left_hip_idx
        self.right_hip_idx = right_hip_idx
        self.left_shoulder_idx = left_shoulder_idx
        self.right_shoulder_idx = right_shoulder_idx
        self.eps = eps

    def normalize(self, landmarks: np.ndarray) -> np.ndarray:
        """Apply configured spatial normalization to landmark sequence.

        Args:
            landmarks: Array of shape [T, N, F] where F >= 3 (x, y, z, ...).

        Returns:
            Normalized landmarks array of identical shape [T, N, F].
        """
        norm_landmarks = landmarks.copy()
        t, n, f = norm_landmarks.shape

        if f < 3:
            raise ValueError(f"Normalization requires at least 3 spatial channels (x, y, z), got {f}")

        # Extract 3D coordinates [T, N, 3]
        coords = norm_landmarks[:, :, :3]

        # 1. Translation Normalization (Centering)
        if self.center_joint is not None and self.center_joint != "origin":
            center_coords = self._compute_center(coords)  # Shape [T, 1, 3]
            coords = coords - center_coords

        # 2. Scale Normalization
        if self.scale_reference is not None:
            scale_factor = self._compute_scale(coords)  # Shape [T, 1, 1]
            coords = coords / np.maximum(scale_factor, self.eps)

        # 3. Optional Orientation / Rotation Normalization
        if self.align_orientation:
            coords = self._align_coronal_plane(coords)

        # Re-attach normalized spatial coordinates preserving extra channels (e.g. visibility)
        norm_landmarks[:, :, :3] = coords
        return norm_landmarks

    def _compute_center(self, coords: np.ndarray) -> np.ndarray:
        """Compute translation origin per frame [T, 1, 3]."""
        t, n, _ = coords.shape

        if self.center_joint == "mid_hip":
            if self.left_hip_idx < n and self.right_hip_idx < n:
                mid_hip = (coords[:, self.left_hip_idx, :] + coords[:, self.right_hip_idx, :]) / 2.0
                return mid_hip[:, np.newaxis, :]
            # Fallback to mean of all points if indices out of bounds
            return np.mean(coords, axis=1, keepdims=True)

        elif self.center_joint == "mid_shoulder":
            if self.left_shoulder_idx < n and self.right_shoulder_idx < n:
                mid_sh = (coords[:, self.left_shoulder_idx, :] + coords[:, self.right_shoulder_idx, :]) / 2.0
                return mid_sh[:, np.newaxis, :]
            return np.mean(coords, axis=1, keepdims=True)

        else:
            return np.zeros((t, 1, 3), dtype=coords.dtype)

    def _compute_scale(self, coords: np.ndarray) -> np.ndarray:
        """Compute reference scale factor per frame [T, 1, 1]."""
        t, n, _ = coords.shape

        if self.scale_reference == "torso_length":
            if (
                self.left_hip_idx < n
                and self.right_hip_idx < n
                and self.left_shoulder_idx < n
                and self.right_shoulder_idx < n
            ):
                mid_hip = (coords[:, self.left_hip_idx, :] + coords[:, self.right_hip_idx, :]) / 2.0
                mid_sh = (coords[:, self.left_shoulder_idx, :] + coords[:, self.right_shoulder_idx, :]) / 2.0
                torso_len = np.linalg.norm(mid_sh - mid_hip, axis=-1, keepdims=True)  # [T, 1]
                return torso_len[:, :, np.newaxis]

            # Fallback to bbox diagonal
            return self._compute_bbox_scale(coords)

        elif self.scale_reference == "shoulder_width":
            if self.left_shoulder_idx < n and self.right_shoulder_idx < n:
                sh_width = np.linalg.norm(
                    coords[:, self.left_shoulder_idx, :] - coords[:, self.right_shoulder_idx, :],
                    axis=-1,
                    keepdims=True,
                )
                return sh_width[:, :, np.newaxis]
            return self._compute_bbox_scale(coords)

        elif self.scale_reference == "bbox_diagonal":
            return self._compute_bbox_scale(coords)

        return np.ones((t, 1, 1), dtype=coords.dtype)

    def _compute_bbox_scale(self, coords: np.ndarray) -> np.ndarray:
        """Compute bounding-box diagonal scale per frame [T, 1, 1]."""
        min_vals = np.min(coords, axis=1)  # [T, 3]
        max_vals = np.max(coords, axis=1)  # [T, 3]
        diag = np.linalg.norm(max_vals - min_vals, axis=-1, keepdims=True)  # [T, 1]
        return diag[:, :, np.newaxis]

    def _align_coronal_plane(self, coords: np.ndarray) -> np.ndarray:
        """Rotate coordinates around vertical axis so shoulder axis aligns with X-axis."""
        t, n, _ = coords.shape
        if self.left_shoulder_idx >= n or self.right_shoulder_idx >= n:
            return coords

        # Vector from right shoulder to left shoulder in XY plane
        sh_vec = coords[:, self.left_shoulder_idx, :2] - coords[:, self.right_shoulder_idx, :2]
        angles = np.arctan2(sh_vec[:, 1], sh_vec[:, 0])  # [T]

        rotated = coords.copy()
        for i in range(t):
            theta = -angles[i]
            cos_t, sin_t = np.cos(theta), np.sin(theta)
            rot_matrix = np.array([
                [cos_t, -sin_t],
                [sin_t, cos_t]
            ])
            rotated[i, :, :2] = coords[i, :, :2] @ rot_matrix.T

        return rotated
