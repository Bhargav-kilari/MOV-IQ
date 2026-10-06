"""Lightweight modular sequence model for temporal pose landmark sequences."""

from typing import Any, Dict, List, Optional, Union
import torch
import torch.nn as nn
from mov_iq.models.base import BaseSequenceModel


class TemporalPooling(nn.Module):
    """Pools temporal sequence embeddings [B, T, H] into fixed-size sequence vectors [B, H]."""

    def __init__(self, mode: str = "mean", hidden_dim: Optional[int] = None) -> None:
        super().__init__()
        self.mode = mode.lower()
        if self.mode == "attention":
            if hidden_dim is None:
                raise ValueError("hidden_dim required when mode is 'attention'")
            self.attn = nn.Sequential(
                nn.Linear(hidden_dim, hidden_dim // 2),
                nn.Tanh(),
                nn.Linear(hidden_dim // 2, 1),
            )

    def forward(
        self,
        x: torch.Tensor,
        lengths: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """Args:
            x: Temporal embeddings tensor of shape [B, T, H].
            lengths: Optional tensor of valid sequence lengths [B].

        Returns:
            Pooled tensor of shape [B, H].
        """
        b, t, h = x.shape

        if self.mode == "mean":
            if lengths is not None:
                mask = torch.arange(t, device=x.device).unsqueeze(0) < lengths.unsqueeze(1)  # [B, T]
                mask = mask.unsqueeze(-1).float()  # [B, T, 1]
                summed = torch.sum(x * mask, dim=1)
                safe_len = torch.clamp(lengths.unsqueeze(1).float(), min=1.0)
                return summed / safe_len
            return torch.mean(x, dim=1)

        elif self.mode == "max":
            if lengths is not None:
                mask = torch.arange(t, device=x.device).unsqueeze(0) >= lengths.unsqueeze(1)
                x_masked = x.clone()
                x_masked[mask.unsqueeze(-1).expand_as(x)] = -1e9
                return torch.max(x_masked, dim=1)[0]
            return torch.max(x, dim=1)[0]

        elif self.mode == "last":
            if lengths is not None:
                last_idx = torch.clamp(lengths - 1, min=0)
                return x[torch.arange(b, device=x.device), last_idx]
            return x[:, -1, :]

        elif self.mode == "attention":
            # Attention weights [B, T, 1]
            attn_scores = self.attn(x)
            if lengths is not None:
                mask = torch.arange(t, device=x.device).unsqueeze(0) >= lengths.unsqueeze(1)
                attn_scores[mask.unsqueeze(-1)] = -1e9
            weights = torch.softmax(attn_scores, dim=1)
            return torch.sum(x * weights, dim=1)

        else:
            raise ValueError(f"Unsupported pooling mode: '{self.mode}'")


class TemporalSequenceModel(BaseSequenceModel):
    """Lightweight modular sequence model for exercise classification and movement analysis.

    Pipeline:
        Input [B, T, D]
            ↓
        Linear Feature Projection + LayerNorm + Dropout
            ↓
        Recurrent Temporal Encoder (BiLSTM or GRU)
            ↓
        Temporal Pooling (Mean, Max, Last, or Attention)
            ↓
        Multi-Task Classification Heads
    """

    def __init__(
        self,
        input_dim: int,
        num_classes: int = 5,
        projection_dim: int = 128,
        hidden_dim: int = 128,
        num_layers: int = 2,
        bidirectional: bool = True,
        dropout: float = 0.3,
        pooling: str = "mean",
        rnn_type: str = "bilstm",
        tasks: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize the model.

        Args:
            input_dim: Dimension of input feature vector per frame (D).
            num_classes: Number of target exercise classes.
            projection_dim: Latent dimension for initial linear projection.
            hidden_dim: Hidden dimension of the recurrent temporal encoder.
            num_layers: Number of recurrent layers.
            bidirectional: If True, uses bidirectional RNN.
            dropout: Dropout probability between layers.
            pooling: Temporal pooling strategy ('mean', 'max', 'last', 'attention').
            rnn_type: Recurrent cell type ('bilstm' or 'gru').
            tasks: Optional configuration dictionary defining active task heads.
        """
        super().__init__()

        if isinstance(num_classes, dict):
            num_classes_int = int(num_classes.get("exercise_classification", 5))
            if tasks is None:
                tasks = {}
                for t_name, t_val in num_classes.items():
                    if t_name != "exercise_classification":
                        tasks[t_name] = {"enabled": True, "type": "classification", "num_classes": t_val}
        else:
            num_classes_int = int(num_classes)

        self.input_dim = input_dim
        self.num_classes = num_classes_int
        self.projection_dim = projection_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.dropout_rate = dropout
        self.pooling_mode = pooling
        self.rnn_type = rnn_type.lower()

        # 1. Feature Projection Block
        self.feature_projection = nn.Sequential(
            nn.Linear(input_dim, projection_dim),
            nn.LayerNorm(projection_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
        )

        # 2. Temporal Encoder (BiLSTM or GRU)
        rnn_dropout = dropout if num_layers > 1 else 0.0
        if "lstm" in self.rnn_type:
            self.temporal_encoder = nn.LSTM(
                input_size=projection_dim,
                hidden_size=hidden_dim,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=bidirectional,
                dropout=rnn_dropout,
            )
        elif "gru" in self.rnn_type:
            self.temporal_encoder = nn.GRU(
                input_size=projection_dim,
                hidden_size=hidden_dim,
                num_layers=num_layers,
                batch_first=True,
                bidirectional=bidirectional,
                dropout=rnn_dropout,
            )
        else:
            raise ValueError(f"Unsupported rnn_type: '{rnn_type}'")

        # Temporal representation dimension after RNN
        self.encoded_dim = hidden_dim * 2 if bidirectional else hidden_dim

        # 3. Temporal Pooling
        self.pooling = TemporalPooling(mode=pooling, hidden_dim=self.encoded_dim)

        # 4. Multi-Task Heads
        # Primary Head: Exercise Classification
        self.register_head(
            "exercise_classification",
            nn.Sequential(
                nn.Linear(self.encoded_dim, hidden_dim // 2),
                nn.ReLU(),
                nn.Dropout(dropout),
                nn.Linear(hidden_dim // 2, num_classes_int),
            ),
        )

        # Multi-task readiness: prepare optional heads if specified in config
        if tasks:
            for task_name, task_spec in tasks.items():
                if task_name == "exercise_classification":
                    continue  # already registered above
                if task_spec.get("enabled", False):
                    head_type = task_spec.get("type", "classification")
                    if head_type == "classification":
                        c = task_spec.get("num_classes", 2)
                        self.register_head(
                            task_name,
                            nn.Sequential(
                                nn.Linear(self.encoded_dim, hidden_dim // 2),
                                nn.ReLU(),
                                nn.Dropout(dropout),
                                nn.Linear(hidden_dim // 2, c),
                            ),
                        )
                    elif head_type == "regression":
                        out_dim = task_spec.get("output_dim", 1)
                        self.register_head(
                            task_name,
                            nn.Sequential(
                                nn.Linear(self.encoded_dim, hidden_dim // 2),
                                nn.ReLU(),
                                nn.Dropout(dropout),
                                nn.Linear(hidden_dim // 2, out_dim),
                            ),
                        )

    def extract_features(
        self,
        x: torch.Tensor,
        lengths: Optional[torch.Tensor] = None,
    ) -> torch.Tensor:
        """Pass input through projection, RNN, and pooling to get pooled representations [B, H]."""
        # x: [B, T, D]
        proj = self.feature_projection(x)  # [B, T, projection_dim]
        encoded, _ = self.temporal_encoder(proj)  # [B, T, encoded_dim]
        pooled = self.pooling(encoded, lengths=lengths)  # [B, encoded_dim]
        return pooled

    def forward(
        self,
        x: torch.Tensor,
        lengths: Optional[torch.Tensor] = None,
        mask: Optional[torch.Tensor] = None,
        **kwargs: Any,
    ) -> Dict[str, torch.Tensor]:
        """Execute forward pass for all active task heads with strict input dimension validation.

        Args:
            x: Input tensor [B, T, D].
            lengths: Optional valid lengths tensor [B].
            mask: Optional boolean attention mask [B, T].

        Returns:
            Dictionary mapping task names to predictions:
                - 'exercise_logits': raw output logits [B, C]
                - 'exercise_probabilities': softmax normalized probabilities [B, C]
                - 'exercise_classification': alias for exercise_logits (backward compatibility)
                - other optional active heads (movement_phase, rep_state, form_quality)
        """
        if x.dim() != 3:
            raise ValueError(
                f"Model expects 3D input tensor [Batch, Time, Dimension], got shape {list(x.shape)}"
            )

        actual_d = x.shape[-1]
        if actual_d != self.input_dim:
            raise ValueError(
                f"Input feature dimension mismatch: expected feature dimension D={self.input_dim}, "
                f"but received tensor with D={actual_d} (shape {list(x.shape)}). "
                f"Check that active feature extraction pipeline matches model input_dim."
            )

        # Convert boolean mask to lengths if lengths not provided
        if lengths is None and mask is not None:
            lengths = mask.sum(dim=1).long()

        pooled = self.extract_features(x, lengths=lengths)

        outputs: Dict[str, torch.Tensor] = {}
        for head_name, head_module in self._heads.items():
            head_out = head_module(pooled)
            outputs[head_name] = head_out
            if head_name == "exercise_classification":
                outputs["exercise_logits"] = head_out
                outputs["exercise_probabilities"] = torch.softmax(head_out, dim=-1)

        return outputs

    def get_config(self) -> Dict[str, Any]:
        """Return constructor hyperparameters."""
        return {
            "input_dim": self.input_dim,
            "num_classes": self.num_classes,
            "projection_dim": self.projection_dim,
            "hidden_dim": self.hidden_dim,
            "num_layers": self.num_layers,
            "bidirectional": self.bidirectional,
            "dropout": self.dropout_rate,
            "pooling": self.pooling_mode,
            "rnn_type": self.rnn_type,
        }


# Canonical baseline model alias
BaselineTemporalSequenceModel = TemporalSequenceModel
baseline_temporal_sequence_model = TemporalSequenceModel
