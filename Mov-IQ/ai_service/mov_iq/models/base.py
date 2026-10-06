"""Base model abstractions and multi-task interfaces for MOV-IQ sequence models."""

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional, Tuple, Union
import torch
import torch.nn as nn


class BaseSequenceModel(nn.Module, ABC):
    """Abstract base class for all temporal sequence models in MOV-IQ.

    Establishes standard interfaces for:
    - Feature encoding (temporal representation extraction)
    - Multi-task head dispatching
    - Checkpointing and configuration serialization
    """

    def __init__(self) -> None:
        super().__init__()
        self._heads: nn.ModuleDict = nn.ModuleDict()

    @abstractmethod
    def forward(
        self,
        x: torch.Tensor,
        lengths: Optional[torch.Tensor] = None,
        **kwargs: Any,
    ) -> Dict[str, torch.Tensor]:
        """Execute forward pass returning dictionary of predictions for all active tasks.

        Args:
            x: Input tensor of shape [Batch, Time, Dimension] [B, T, D].
            lengths: Optional tensor of sequence lengths [B] for packed sequences.

        Returns:
            Dictionary mapping task names to their respective output tensors
            (e.g. {'exercise_classification': logits [B, C], ...}).
        """
        pass

    @abstractmethod
    def extract_features(
        self,
        x: torch.Tensor,
        lengths: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """Extract high-level pooled temporal embeddings before head projections.

        Args:
            x: Input tensor [B, T, D].
            lengths: Optional tensor of sequence lengths [B].

        Returns:
            Latent embedding tensor of shape [B, Embedding_Dim].
        """
        pass

    def register_head(self, task_name: str, head_module: nn.Module) -> None:
        """Register a multi-task head (e.g. exercise_classification, movement_phase, etc.)."""
        self._heads[task_name] = head_module

    def get_head(self, task_name: str) -> Optional[nn.Module]:
        """Retrieve registered head module by task name."""
        if task_name in self._heads:
            return self._heads[task_name]
        return None

    @abstractmethod
    def get_config(self) -> Dict[str, Any]:
        """Return model architectural hyperparameters dictionary for serialization."""
        pass

    def save(self, filepath: str) -> None:
        """Serialize model weights and architectural configuration to disk."""
        payload = {
            "model_class": self.__class__.__name__,
            "config": self.get_config(),
            "state_dict": self.state_dict(),
        }
        torch.save(payload, filepath)

    @classmethod
    def load(
        cls,
        filepath: str,
        device: Union[str, torch.device] = "cpu",
    ) -> "BaseSequenceModel":
        """Instantiate and restore model from saved checkpoint."""
        payload = torch.load(filepath, map_location=device)
        model = cls(**payload["config"])
        model.load_state_dict(payload["state_dict"])
        model.to(device)
        model.eval()
        return model
