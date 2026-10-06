"""Canonical data contracts, landmark metadata, dataset adapters, and manifest schemas for MOV-IQ.

The canonical representation defines a standardized schema for human pose landmark
sequences independent of the acquisition pipeline (MediaPipe, OpenPose, Kinect, etc.)
or source dataset (KiMoRe, UI-PRMD, custom recordings).
"""

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple, Union
import numpy as np

from enum import Enum

logger = logging.getLogger(__name__)

# Canonical schema version for dataset versioning and experiment audits
CANONICAL_SCHEMA_VERSION = "1.0.0"

# Standard default landmark feature channel indices
CANONICAL_FEATURE_CHANNELS = ("x", "y", "z", "visibility")


class BodyRegion(str, Enum):
    """Anatomical region categorization for human body landmarks."""

    HEAD = "head"
    TORSO = "torso"
    UPPER_BODY = "upper_body"
    LOWER_BODY = "lower_body"
    LEFT_ARM = "left_arm"
    RIGHT_ARM = "right_arm"
    LEFT_LEG = "left_leg"
    RIGHT_LEG = "right_leg"
    EXTREMITY = "extremity"


class CoordinateConvention(str, Enum):
    """Coordinate reference frame conventions supported by adapters."""

    NORMALIZED = "normalized"
    METRIC_METERS = "metric_meters"
    METRIC_MILLIMETERS = "metric_millimeters"
    PIXEL = "pixel"


@dataclass
class LandmarkMetadata:
    """Metadata definition for an individual anatomical landmark.

    Attributes:
        name: Standardized anatomical landmark name (e.g. 'left_knee', 'right_hip').
        index: Zero-based landmark index in the landmark array [T, N, F].
        body_region: Body segment grouping ('head', 'torso', 'upper_body', 'lower_body', 'extremity').
        required: Whether this landmark is mandatory for canonical validation.
    """

    name: str
    index: int
    body_region: Union[BodyRegion, str] = BodyRegion.TORSO
    required: bool = True
    parent: Optional[int] = None

    @property
    def region(self) -> Union[BodyRegion, str]:
        """Alias for body_region."""
        return self.body_region

    def to_dict(self) -> Dict[str, Any]:
        region_str = self.body_region.value if isinstance(self.body_region, BodyRegion) else str(self.body_region)
        return {
            "name": self.name,
            "index": self.index,
            "body_region": region_str,
            "required": self.required,
            "parent": self.parent,
        }


@dataclass
class LandmarkTopology:
    """Defines the landmark ordering, naming, and channel structure for a pose model.

    Decouples model definitions and feature extraction from hardcoded landmark index assumptions.
    """

    name: str
    num_landmarks: int
    landmarks: Dict[str, LandmarkMetadata]
    channel_names: Tuple[str, ...] = CANONICAL_FEATURE_CHANNELS

    def get_by_name(self, name: str) -> Optional[LandmarkMetadata]:
        """Look up landmark metadata by anatomical name."""
        return self.landmarks.get(name)

    def get_index(self, name: str) -> Optional[int]:
        """Look up zero-based index for a named landmark."""
        meta = self.landmarks.get(name)
        return meta.index if meta else None

    def get_name(self, index: int) -> Optional[str]:
        """Look up anatomical name for a landmark index."""
        for name, meta in self.landmarks.items():
            if meta.index == index:
                return name
        return None

    def has_landmark(self, name: str) -> bool:
        return name in self.landmarks

    def get_required_indices(self) -> List[int]:
        return [meta.index for meta in self.landmarks.values() if meta.required]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "num_landmarks": self.num_landmarks,
            "channel_names": list(self.channel_names),
            "landmarks": {k: v.to_dict() for k, v in self.landmarks.items()},
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "LandmarkTopology":
        landmarks = {
            k: LandmarkMetadata(**v) for k, v in data.get("landmarks", {}).items()
        }
        return cls(
            name=data["name"],
            num_landmarks=int(data["num_landmarks"]),
            landmarks=landmarks,
            channel_names=tuple(data.get("channel_names", CANONICAL_FEATURE_CHANNELS)),
        )


def create_mediapipe_topology() -> LandmarkTopology:
    """Construct standard MediaPipe Pose (33 keypoints) topology."""
    names = [
        "nose", "left_eye_inner", "left_eye", "left_eye_outer",
        "right_eye_inner", "right_eye", "right_eye_outer",
        "left_ear", "right_ear", "mouth_left", "mouth_right",
        "left_shoulder", "right_shoulder",
        "left_elbow", "right_elbow",
        "left_wrist", "right_wrist",
        "left_pinky", "right_pinky",
        "left_index", "right_index",
        "left_thumb", "right_thumb",
        "left_hip", "right_hip",
        "left_knee", "right_knee",
        "left_ankle", "right_ankle",
        "left_heel", "right_heel",
        "left_foot_index", "right_foot_index",
    ]
    landmarks = {}
    for idx, name in enumerate(names):
        if idx <= 10:
            region = BodyRegion.HEAD
        elif idx in (11, 12, 23, 24):
            region = BodyRegion.TORSO
        elif idx in (13, 15, 17, 19, 21):
            region = BodyRegion.LEFT_ARM
        elif idx in (14, 16, 18, 20, 22):
            region = BodyRegion.RIGHT_ARM
        elif idx in (25, 27, 29, 31):
            region = BodyRegion.LEFT_LEG
        elif idx in (26, 28, 30, 32):
            region = BodyRegion.RIGHT_LEG
        else:
            region = BodyRegion.LOWER_BODY

        landmarks[name] = LandmarkMetadata(name=name, index=idx, body_region=region, required=True)

    return LandmarkTopology(
        name="mediapipe_pose_33",
        num_landmarks=33,
        landmarks=landmarks,
        channel_names=CANONICAL_FEATURE_CHANNELS,
    )


# Standard default topology instance
MEDIAPIPE_POSE_33 = create_mediapipe_topology()


def create_kimore_topology() -> LandmarkTopology:
    """Construct standard Kinect v2 (25 keypoints) topology for KiMoRe."""
    joint_specs = [
        # (name, region, parent_index)
        ("spinebase", BodyRegion.TORSO, None),
        ("spinemid", BodyRegion.TORSO, 0),
        ("neck", BodyRegion.HEAD, 20),
        ("head", BodyRegion.HEAD, 2),
        ("shoulderleft", BodyRegion.LEFT_ARM, 20),
        ("elbowleft", BodyRegion.LEFT_ARM, 4),
        ("wristleft", BodyRegion.LEFT_ARM, 5),
        ("handleft", BodyRegion.LEFT_ARM, 6),
        ("shoulderright", BodyRegion.RIGHT_ARM, 20),
        ("elbowright", BodyRegion.RIGHT_ARM, 8),
        ("wristright", BodyRegion.RIGHT_ARM, 9),
        ("handright", BodyRegion.RIGHT_ARM, 10),
        ("hipleft", BodyRegion.LEFT_LEG, 0),
        ("kneeleft", BodyRegion.LEFT_LEG, 12),
        ("ankleleft", BodyRegion.LEFT_LEG, 13),
        ("footleft", BodyRegion.LEFT_LEG, 14),
        ("hipright", BodyRegion.RIGHT_LEG, 0),
        ("kneeright", BodyRegion.RIGHT_LEG, 16),
        ("ankleright", BodyRegion.RIGHT_LEG, 17),
        ("footright", BodyRegion.RIGHT_LEG, 18),
        ("spineshoulder", BodyRegion.TORSO, 1),
        ("handtipleft", BodyRegion.LEFT_ARM, 7),
        ("thumbleft", BodyRegion.LEFT_ARM, 6),
        ("handtipright", BodyRegion.RIGHT_ARM, 11),
        ("thumbright", BodyRegion.RIGHT_ARM, 10),
    ]
    landmarks = {}
    for idx, (name, region, parent) in enumerate(joint_specs):
        landmarks[name] = LandmarkMetadata(
            name=name, index=idx, body_region=region, required=True, parent=parent
        )
    return LandmarkTopology(
        name="kinect_v2_25",
        num_landmarks=25,
        landmarks=landmarks,
        channel_names=CANONICAL_FEATURE_CHANNELS,
    )


KIMORE_KINECT_25 = create_kimore_topology()


def create_ui_prmd_kinect_topology() -> LandmarkTopology:
    """Construct standard Kinect 22-joint topology for UI-PRMD."""
    joint_specs = [
        # (name, region, parent_index)
        ("waist", BodyRegion.TORSO, None),
        ("spine", BodyRegion.TORSO, 0),
        ("chest", BodyRegion.TORSO, 1),
        ("neck", BodyRegion.HEAD, 2),
        ("head", BodyRegion.HEAD, 3),
        ("head_tip", BodyRegion.HEAD, 4),
        ("left_collar", BodyRegion.LEFT_ARM, 2),
        ("left_upper_arm", BodyRegion.LEFT_ARM, 6),
        ("left_forearm", BodyRegion.LEFT_ARM, 7),
        ("left_hand", BodyRegion.LEFT_ARM, 8),
        ("right_collar", BodyRegion.RIGHT_ARM, 2),
        ("right_upper_arm", BodyRegion.RIGHT_ARM, 10),
        ("right_forearm", BodyRegion.RIGHT_ARM, 11),
        ("right_hand", BodyRegion.RIGHT_ARM, 12),
        ("left_upper_leg", BodyRegion.LEFT_LEG, 0),
        ("left_lower_leg", BodyRegion.LEFT_LEG, 14),
        ("left_foot", BodyRegion.LEFT_LEG, 15),
        ("left_leg_toes", BodyRegion.LEFT_LEG, 16),
        ("right_upper_leg", BodyRegion.RIGHT_LEG, 0),
        ("right_lower_leg", BodyRegion.RIGHT_LEG, 18),
        ("right_foot", BodyRegion.RIGHT_LEG, 19),
        ("right_leg_toes", BodyRegion.RIGHT_LEG, 20),
    ]
    landmarks = {}
    for idx, (name, region, parent) in enumerate(joint_specs):
        landmarks[name] = LandmarkMetadata(
            name=name, index=idx, body_region=region, required=True, parent=parent
        )
    return LandmarkTopology(
        name="ui_prmd_kinect_22",
        num_landmarks=22,
        landmarks=landmarks,
        channel_names=CANONICAL_FEATURE_CHANNELS,
    )


UI_PRMD_KINECT_22 = create_ui_prmd_kinect_topology()


def create_ui_prmd_vicon_topology() -> LandmarkTopology:
    """Construct standard Vicon 39-marker topology for UI-PRMD."""
    vicon_marker_names = [
        "LFHD", "RFHD", "LBHD", "RBHD", "C7", "T10", "CLAV", "STRN", "RBAK",
        "LSHO", "LUPA", "LELB", "LFRM", "LWRA", "LWRB", "LFIN",
        "RSHO", "RUPA", "RELB", "RFRM", "RWRA", "RWRB", "RFIN",
        "LASI", "RASI", "LPSI", "RPSI", "LTHI", "LKNE", "LTIB", "LANK", "LHEE", "LTOE",
        "RTHI", "RKNE", "RTIB", "RANK", "RHEE", "RTOE",
    ]
    landmarks = {}
    for idx, name in enumerate(vicon_marker_names):
        if idx <= 3:
            region = BodyRegion.HEAD
        elif idx in (4, 5, 6, 7, 8, 23, 24, 25, 26):
            region = BodyRegion.TORSO
        elif idx in range(9, 16):
            region = BodyRegion.LEFT_ARM
        elif idx in range(16, 23):
            region = BodyRegion.RIGHT_ARM
        elif idx in range(27, 33):
            region = BodyRegion.LEFT_LEG
        else:
            region = BodyRegion.RIGHT_LEG
        landmarks[name] = LandmarkMetadata(
            name=name, index=idx, body_region=region, required=True
        )
    return LandmarkTopology(
        name="ui_prmd_vicon_39",
        num_landmarks=39,
        landmarks=landmarks,
        channel_names=("x", "y", "z"),
    )


UI_PRMD_VICON_39 = create_ui_prmd_vicon_topology()


@dataclass
class DatasetVersionInfo:
    """Provenance and version metadata for datasets and transformation pipelines."""

    dataset_name: str
    dataset_version: str = "v1.0"
    adapter_version: str = "v1.0"
    preprocessing_version: str = "v1.0"
    schema_version: str = CANONICAL_SCHEMA_VERSION

    def to_dict(self) -> Dict[str, str]:
        return {
            "dataset_name": self.dataset_name,
            "dataset_version": self.dataset_version,
            "adapter_version": self.adapter_version,
            "preprocessing_version": self.preprocessing_version,
            "schema_version": self.schema_version,
        }


@dataclass
class ManifestRecord:
    """Individual sequence entry in the canonical dataset manifest."""

    sample_id: str
    subject_id: Optional[str]
    dataset: str
    exercise: str
    sequence_length: int
    fps: float
    source_path: Optional[str] = None
    split: Optional[str] = None  # 'train', 'val', 'test', or None
    label_availability: Dict[str, bool] = field(default_factory=lambda: {
        "exercise": True,
        "movement_phase": False,
        "rep_state": False,
        "form_quality": False,
    })
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ManifestRecord":
        return cls(**data)


@dataclass
class DatasetManifest:
    """Canonical dataset manifest for inventory, auditing, and split verification."""

    manifest_id: Optional[str] = None
    dataset_name: Optional[str] = None
    records: List[ManifestRecord] = field(default_factory=list)
    schema_version: str = CANONICAL_SCHEMA_VERSION
    dataset_version: Optional[str] = "v1.0"

    def add_record(self, record: ManifestRecord) -> None:
        self.records.append(record)

    def __len__(self) -> int:
        return len(self.records)

    def get_subjects(self, split: Optional[str] = None) -> Set[str]:
        """Return the set of unique subject IDs across records, optionally filtered by split."""
        subjects = set()
        for r in self.records:
            if r.subject_id and (split is None or r.split == split):
                subjects.add(r.subject_id)
        return subjects

    def to_dict(self) -> Dict[str, Any]:
        return {
            "manifest_id": self.manifest_id,
            "dataset_name": self.dataset_name,
            "schema_version": self.schema_version,
            "dataset_version": self.dataset_version,
            "total_records": len(self.records),
            "records": [r.to_dict() for r in self.records],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "DatasetManifest":
        records = [ManifestRecord.from_dict(r) for r in data.get("records", [])]
        return cls(
            manifest_id=data.get("manifest_id"),
            dataset_name=data.get("dataset_name"),
            records=records,
            schema_version=data.get("schema_version", CANONICAL_SCHEMA_VERSION),
            dataset_version=data.get("dataset_version", "v1.0"),
        )

    def save_json(self, filepath: Union[str, Path]) -> Path:
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)
        return path

    def save(self, filepath: Union[str, Path]) -> Path:
        """Alias for save_json."""
        return self.save_json(filepath)

    @classmethod
    def load_json(cls, filepath: Union[str, Path]) -> "DatasetManifest":
        path = Path(filepath)
        if not path.is_file():
            raise FileNotFoundError(f"Manifest file not found: {path}")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return cls.from_dict(data)

    @classmethod
    def load(cls, filepath: Union[str, Path]) -> "DatasetManifest":
        """Alias for load_json."""
        return cls.load_json(filepath)

    def summary(self) -> Dict[str, Any]:
        """Aggregate statistical summary of manifest contents."""
        exercises: Dict[str, int] = {}
        splits: Dict[str, int] = {}
        subjects: Set[str] = set()

        for r in self.records:
            exercises[r.exercise] = exercises.get(r.exercise, 0) + 1
            split_key = r.split or "unassigned"
            splits[split_key] = splits.get(split_key, 0) + 1
            if r.subject_id:
                subjects.add(r.subject_id)

        return {
            "total_samples": len(self.records),
            "unique_subjects": len(subjects),
            "exercise_distribution": exercises,
            "split_distribution": splits,
        }


@dataclass
class PoseSequenceSample:
    """Canonical internal representation for a single human movement pose sequence.

    Attributes:
        sample_id: Unique string identifier for the sequence sample.
        subject_id: Identifier for the human subject/participant (critical for
            preventing subject leakage across data splits). If unknown, defaults to None.
        exercise: Name of the exercise performed (e.g. 'squat', 'bicep_curl', 'lunge').
        label: Target class label or index for classification.
        source_dataset: Origin dataset identifier (e.g. 'kimore', 'uiprmd', 'custom').
        fps: Recording frame rate in frames per second.
        sequence_length: Temporal length (T) of the sequence.
        landmarks: Array of shape [T, N, F] where:
            - T: number of temporal frames
            - N: number of pose landmarks (topology-agnostic, e.g. 33 for MediaPipe, 17 for COCO)
            - F: landmark feature channels (x, y, z, visibility, ...)
        metadata: Optional dictionary for domain-specific annotations (e.g. repetition
            boundaries, form quality rating, camera viewpoint).
    """

    sample_id: str
    exercise: str
    label: Union[int, str, float]
    source_dataset: str
    fps: float
    sequence_length: int
    landmarks: np.ndarray  # Shape: [T, N, F]
    subject_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    source_modality: Optional[str] = None
    form_quality: Optional[Union[int, float, str]] = None
    clinical_scores: Optional[Dict[str, float]] = None
    orientations: Optional[np.ndarray] = None  # Shape: [T, N, 4] float32 quaternion

    def __post_init__(self) -> None:
        """Validate shapes and types upon instantiation."""
        if not isinstance(self.landmarks, np.ndarray):
            self.landmarks = np.asarray(self.landmarks, dtype=np.float32)
        else:
            self.landmarks = self.landmarks.astype(np.float32, copy=False)

        if self.landmarks.ndim != 3:
            raise ValueError(
                f"Landmarks must be 3-dimensional [T, N, F], got shape {self.landmarks.shape} "
                f"for sample '{self.sample_id}'"
            )

        actual_t = self.landmarks.shape[0]
        if self.sequence_length != actual_t:
            self.sequence_length = actual_t

        if self.orientations is not None:
            if not isinstance(self.orientations, np.ndarray):
                self.orientations = np.asarray(self.orientations, dtype=np.float32)
            else:
                self.orientations = self.orientations.astype(np.float32, copy=False)

    @property
    def num_landmarks(self) -> int:
        """Number of tracked pose landmarks (N)."""
        return self.landmarks.shape[1]

    @property
    def num_features(self) -> int:
        """Number of feature channels per landmark (F)."""
        return self.landmarks.shape[2]

    @property
    def feature_dim(self) -> int:
        """Alias for num_features."""
        return self.landmarks.shape[2]

    @property
    def has_depth(self) -> bool:
        """Whether landmark channels contain depth (z)."""
        return self.landmarks.shape[2] >= 3

    @property
    def has_visibility(self) -> bool:
        """Whether landmark channels contain visibility."""
        return self.landmarks.shape[2] >= 4

    def to_dict(self) -> Dict[str, Any]:
        """Convert sample metadata and attributes to a serializable dictionary."""
        d = {
            "sample_id": self.sample_id,
            "subject_id": self.subject_id,
            "exercise": self.exercise,
            "label": self.label,
            "source_dataset": self.source_dataset,
            "fps": float(self.fps),
            "sequence_length": int(self.sequence_length),
            "num_landmarks": self.num_landmarks,
            "num_features": self.num_features,
            "metadata": self.metadata,
        }
        if self.source_modality is not None:
            d["source_modality"] = self.source_modality
        if self.form_quality is not None:
            d["form_quality"] = self.form_quality
        if self.clinical_scores is not None:
            d["clinical_scores"] = self.clinical_scores
        return d

    def save_npz(self, filepath: Union[str, Path]) -> Path:
        """Save sample landmarks and metadata into a compressed .npz archive."""
        path = Path(filepath)
        path.parent.mkdir(parents=True, exist_ok=True)
        meta_json = json.dumps(self.to_dict())
        save_kwargs = {
            "landmarks": self.landmarks,
            "meta_json": np.array(meta_json),
        }
        if self.orientations is not None:
            save_kwargs["orientations"] = self.orientations
        np.savez_compressed(path, **save_kwargs)
        return path

    @classmethod
    def load_npz(cls, filepath: Union[str, Path]) -> "PoseSequenceSample":
        """Load sample from a compressed .npz archive."""
        path = Path(filepath)
        if not path.is_file():
            raise FileNotFoundError(f"Sample archive not found: {path}")

        data = np.load(path, allow_pickle=False)
        landmarks = data["landmarks"]
        meta_dict = json.loads(str(data["meta_json"]))
        orientations = data["orientations"] if "orientations" in data else None

        return cls(
            sample_id=meta_dict["sample_id"],
            subject_id=meta_dict.get("subject_id"),
            exercise=meta_dict["exercise"],
            label=meta_dict["label"],
            source_dataset=meta_dict["source_dataset"],
            fps=float(meta_dict["fps"]),
            sequence_length=int(meta_dict["sequence_length"]),
            landmarks=landmarks,
            metadata=meta_dict.get("metadata", {}),
            source_modality=meta_dict.get("source_modality"),
            form_quality=meta_dict.get("form_quality"),
            clinical_scores=meta_dict.get("clinical_scores"),
            orientations=orientations,
        )


class BaseDatasetAdapter(ABC):
    """Abstract base class for converting external datasets into canonical MOV-IQ format.

    External datasets (e.g. KiMoRe, UI-PRMD, custom sensor recordings) differ widely
    in file formats, directory hierarchies, landmark ordering, and coordinate conventions.
    Adapters ingest raw external files and standardize them into canonical PoseSequenceSamples.
    """

    @property
    @abstractmethod
    def dataset_name(self) -> str:
        """Identifier of the source dataset handled by this adapter."""
        pass

    @property
    def dataset_version(self) -> str:
        """Dataset release or source version."""
        return "v1.0"

    @property
    def adapter_version(self) -> str:
        """Version of this adapter implementation."""
        return "1.0.0"

    @property
    def coordinate_convention(self) -> str:
        """Coordinate reference frame: 'normalized', 'metric_meters', or 'pixel'."""
        return "normalized"

    @property
    def source_fps(self) -> float:
        """Source recording frame rate."""
        return 30.0

    @property
    def landmark_topology(self) -> Optional[LandmarkTopology]:
        """Optional LandmarkTopology instance describing source joints."""
        return None

    def get_version_info(self) -> DatasetVersionInfo:
        return DatasetVersionInfo(
            dataset_name=self.dataset_name,
            dataset_version=self.dataset_version,
            adapter_version=self.adapter_version,
            schema_version=CANONICAL_SCHEMA_VERSION,
        )

    @abstractmethod
    def convert_to_canonical(
        self,
        source_dir: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
    ) -> List[PoseSequenceSample]:
        """Convert external dataset files into canonical PoseSequenceSample instances.

        Args:
            source_dir: Directory containing raw external dataset files.
            output_dir: Optional destination directory to persist converted .npz archives.

        Returns:
            List of converted PoseSequenceSample instances.
        """
        pass


class KiMoReAdapter(BaseDatasetAdapter):
    """Adapter interface for the KiMoRe (Kinect Motion Recovery) dataset.

    Note:
        KiMoRe provides motion data recorded from Kinect v2 for rehabilitation exercises.
        This adapter serves as the production integration interface once raw data is provided.
    """

    @property
    def dataset_name(self) -> str:
        return "KiMoRe"

    @property
    def coordinate_convention(self) -> str:
        return "metric_meters"

    def convert_to_canonical(
        self,
        source_dir: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
    ) -> List[PoseSequenceSample]:
        source_path = Path(source_dir)
        if not source_path.exists() or not any(source_path.iterdir()):
            return []
        raise NotImplementedError(
            "KiMoRe raw dataset parsing will be implemented when real data files are supplied."
        )


class UIPRMDMAdapter(BaseDatasetAdapter):
    """Adapter interface for the UI-PRMD (University of Idaho PRMD) dataset.

    Note:
        UI-PRMD contains physical rehabilitation movements captured with Vicon and Kinect.
        This adapter serves as the integration interface once raw data is provided.
    """

    @property
    def dataset_name(self) -> str:
        return "UI-PRMD"

    @property
    def coordinate_convention(self) -> str:
        return "metric_meters"

    def convert_to_canonical(
        self,
        source_dir: Union[str, Path],
        output_dir: Optional[Union[str, Path]] = None,
    ) -> List[PoseSequenceSample]:
        source_path = Path(source_dir)
        if not source_path.exists() or not any(source_path.iterdir()):
            return []
        raise NotImplementedError(
            "UI-PRMD raw dataset parsing will be implemented when real data files are supplied."
        )
