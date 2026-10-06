"""Temporal dynamics: velocities, accelerations, and temporal difference features."""

from typing import Optional
import numpy as np


def compute_temporal_difference(
    features: np.ndarray,
    order: int = 1,
    fps: Optional[float] = None,
) -> np.ndarray:
    """Compute temporal difference derivative (velocity or acceleration) along axis 0.

    Maintains identical temporal dimension T by causal zero-padding at the boundary.

    Args:
        features: Array of shape [T, ...] (e.g. [T, D] or [T, N, F]).
        order: Derivative order (1 = first difference / velocity, 2 = acceleration).
        fps: Recording frame rate. If provided, scales differences into physical units / sec.

    Returns:
        Temporal derivative array matching the input shape [T, ...].
    """
    t = features.shape[0]
    dt = 1.0 / fps if (fps is not None and fps > 0) else 1.0

    if order == 1:
        diff = np.diff(features, n=1, axis=0) / dt
        # Causal zero-padding at initial frame t=0
        pad = np.zeros((1, *features.shape[1:]), dtype=features.dtype)
        return np.concatenate([pad, diff], axis=0)

    elif order == 2:
        diff1 = np.diff(features, n=1, axis=0) / dt
        diff2 = np.diff(diff1, n=1, axis=0) / dt
        # Causal zero-padding for t=0 and t=1
        pad = np.zeros((2, *features.shape[1:]), dtype=features.dtype)
        return np.concatenate([pad, diff2], axis=0)

    else:
        raise ValueError(f"Derivative order must be 1 or 2, got {order}")


class TemporalDynamicsExtractor:
    """Extracts instantaneous velocities and accelerations for landmark sequences."""

    def __init__(
        self,
        fps: Optional[float] = 30.0,
        include_velocity: bool = True,
        include_acceleration: bool = True,
        channels: Optional[tuple] = (0, 1, 2),  # x, y, z
        velocity_clip: Optional[tuple] = None,
        acceleration_clip: Optional[tuple] = None,
    ) -> None:
        """Initialize temporal dynamics extractor.

        Args:
            fps: Video recording frame rate.
            include_velocity: If True, computes 1st derivative (velocity).
            include_acceleration: If True, computes 2nd derivative (acceleration).
            channels: Coordinate channels to compute dynamics over.
            velocity_clip: Optional (v_min, v_max) clipping bounds.
            acceleration_clip: Optional (a_min, a_max) clipping bounds.
        """
        self.fps = fps
        self.include_velocity = include_velocity
        self.include_acceleration = include_acceleration
        self.channels = channels
        self.velocity_clip = velocity_clip
        self.acceleration_clip = acceleration_clip

    def extract(self, landmarks: np.ndarray) -> np.ndarray:
        """Compute velocity and/or acceleration features.

        Args:
            landmarks: Array of shape [T, N, F].

        Returns:
            Concatenated dynamics features of shape [T, D_dynamics].
        """
        t, n, f = landmarks.shape

        coords = landmarks
        if self.channels is not None:
            coords = coords[:, :, self.channels]

        # Flatten [T, N, F_sub] -> [T, N * F_sub]
        flattened = coords.reshape(t, -1)

        dynamics = []
        if self.include_velocity:
            vel = compute_temporal_difference(flattened, order=1, fps=self.fps)
            if self.velocity_clip is not None:
                vel = np.clip(vel, self.velocity_clip[0], self.velocity_clip[1])
            dynamics.append(vel)

        if self.include_acceleration:
            acc = compute_temporal_difference(flattened, order=2, fps=self.fps)
            if self.acceleration_clip is not None:
                acc = np.clip(acc, self.acceleration_clip[0], self.acceleration_clip[1])
            dynamics.append(acc)

        if not dynamics:
            return np.zeros((t, 0), dtype=np.float32)

        return np.concatenate(dynamics, axis=-1)
