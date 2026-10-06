import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any

from ..schemas.action_queue import (
    ActionItem,
    ActionStatus,
    ActionSummary,
    ActionQueueResponse,
)
from ..schemas.hospital_state import HospitalState
from ..schemas.orchestrator import OrchestratorResponse, RecommendationAction

logger = logging.getLogger("erflow.action_queue_service")


class EDActionQueueService:
    """
    ED Command Action Queue Service.
    Manages operational task state (NEW -> ACKNOWLEDGED -> MONITORING -> COMPLETED)
    and persists queue items to JSON storage using existing backend architecture.
    """

    def __init__(self, data_dir: Optional[Path] = None) -> None:
        self._root_dir = Path(__file__).resolve().parent.parent
        self._data_dir = data_dir or (self._root_dir / "data")
        self._store_file = self._data_dir / "action_queue_store.json"
        self._actions: Dict[str, ActionItem] = {}
        self._init_storage()

    def _init_storage(self) -> None:
        """Ensures data directory exists and loads persisted action queue items."""
        try:
            self._data_dir.mkdir(parents=True, exist_ok=True)
            if self._store_file.exists():
                with open(self._store_file, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    for item_data in raw_data:
                        item = ActionItem(**item_data)
                        self._actions[item.id] = item
                logger.info(f"Loaded {len(self._actions)} persisted action items from {self._store_file}")
            else:
                logger.info(f"No existing action store found at {self._store_file}. Initializing fresh queue.")
        except Exception as e:
            logger.error(f"Error reading action store from {self._store_file}: {e}", exc_info=True)
            self._actions = {}

    def _save_storage(self) -> None:
        """Persists action queue items to JSON file."""
        try:
            self._data_dir.mkdir(parents=True, exist_ok=True)
            raw_list = [item.model_dump() for item in self._actions.values()]
            with open(self._store_file, "w", encoding="utf-8") as f:
                json.dump(raw_list, f, indent=2)
            logger.info(f"Persisted {len(self._actions)} action items to {self._store_file}")
        except Exception as e:
            logger.error(f"Error persisting action store to {self._store_file}: {e}", exc_info=True)

    def sync_with_orchestrator(self, orch_res: OrchestratorResponse) -> List[ActionItem]:
        """
        Syncs recommended actions from Orchestrator response into the Action Queue.
        Preserves existing task status (ACKNOWLEDGED, MONITORING, COMPLETED) for previously created actions.
        """
        now = datetime.now(timezone.utc)
        now_iso = now.isoformat()

        for rec in orch_res.recommended_actions:
            action_id = rec.id

            # Determine source prediction engine label
            if rec.category == "BED CAPACITY":
                source_pred = "Supervised XGBoost Classifier (Crowding Risk)"
            elif rec.category == "TRIAGE CAPACITY" or rec.category == "WAITING QUEUE":
                source_pred = "Supervised XGBoost Regressor (Wait Time)"
            elif rec.category == "STAFFING":
                source_pred = "HospitalState Staff Ratio Analysis"
            elif rec.category == "ARRIVAL PRESSURE" or rec.category == "SURGE":
                source_pred = "Unsupervised DBSCAN Anomaly Detector"
            elif rec.category == "FLOW":
                source_pred = "2-Layer Keras LSTM Neural Network"
            else:
                source_pred = "Unified Multi-Model Operational Engine"

            # Format contributing factors as string list
            factor_strings = [f"{f.name} (+{f.contribution_score:.0f}%)" if f.contribution_score > 0 else f.name for f in rec.contributing_factors]
            if not factor_strings:
                factor_strings = ["Live Operational Telemetry"]

            # Calculate due time display
            due_delta = timedelta(minutes=rec.due_in_minutes)
            due_iso = (now + due_delta).strftime("%I:%M %p")

            if action_id in self._actions:
                # Update dynamic fields while preserving user workflow state
                existing = self._actions[action_id]
                existing.title = rec.title
                existing.recommendation = rec.recommended_action
                existing.priority = rec.priority
                existing.contributing_factors = factor_strings
                existing.source_prediction = source_pred
                existing.urgency = rec.urgency
                existing.reason = rec.reason
                existing.explanation_detail = rec.explanation_detail.model_dump() if rec.explanation_detail else None
            else:
                # Create new action item with NEW status
                new_item = ActionItem(
                    id=action_id,
                    category=rec.category,
                    title=rec.title,
                    recommendation=rec.recommended_action,
                    priority=rec.priority,
                    created_at=now_iso,
                    due_time=due_iso,
                    status=ActionStatus.NEW,
                    contributing_factors=factor_strings,
                    source_prediction=source_pred,
                    urgency=rec.urgency,
                    reason=rec.reason,
                    explanation_detail=rec.explanation_detail.model_dump() if rec.explanation_detail else None,
                )
                self._actions[action_id] = new_item

        self._save_storage()
        return list(self._actions.values())

    def get_action_queue(
        self,
        hospital_state: Optional[HospitalState] = None,
        filter_status: str = "ALL"
    ) -> ActionQueueResponse:
        """
        Retrieves action queue with status/priority filtering and summary metrics.
        Executes orchestrator sync if state is provided.
        """
        if hospital_state is not None:
            from .orchestrator_service import orchestrator_service
            orch_res = orchestrator_service.analyze_operations(hospital_state)
            self.sync_with_orchestrator(orch_res)
        elif not self._actions:
            # Seed default queue if store is empty
            from .orchestrator_service import orchestrator_service
            default_state = HospitalState()
            orch_res = orchestrator_service.analyze_operations(default_state)
            self.sync_with_orchestrator(orch_res)

        all_items = list(self._actions.values())
        filter_upper = (filter_status or "ALL").upper().strip()

        # Filtering logic
        if filter_upper == "HIGH PRIORITY":
            filtered_items = [item for item in all_items if item.priority in ["HIGH", "CRITICAL"]]
        elif filter_upper == "NEW":
            filtered_items = [item for item in all_items if item.status == ActionStatus.NEW]
        elif filter_upper == "ACKNOWLEDGED":
            filtered_items = [item for item in all_items if item.status == ActionStatus.ACKNOWLEDGED]
        elif filter_upper == "MONITORING":
            filtered_items = [item for item in all_items if item.status == ActionStatus.MONITORING]
        elif filter_upper == "COMPLETED":
            filtered_items = [item for item in all_items if item.status == ActionStatus.COMPLETED]
        else:
            filter_upper = "ALL"
            filtered_items = all_items

        # Operational Summary Metrics
        open_cnt = sum(1 for item in all_items if item.status != ActionStatus.COMPLETED)
        high_cnt = sum(1 for item in all_items if item.priority in ["HIGH", "CRITICAL"])
        completed_cnt = sum(1 for item in all_items if item.status == ActionStatus.COMPLETED)
        total_cnt = len(all_items)

        summary = ActionSummary(
            open_actions=open_cnt,
            high_priority=high_cnt,
            completed=completed_cnt,
            total_actions=total_cnt,
        )

        return ActionQueueResponse(
            summary=summary,
            actions=filtered_items,
            filter_applied=filter_upper,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def update_action_status(self, action_id: str, new_status: ActionStatus) -> ActionItem:
        """
        Updates an action item's status (NEW -> ACKNOWLEDGED -> MONITORING -> COMPLETED)
        and persists the state to JSON store.
        """
        if action_id not in self._actions:
            # Fallback search by prefix or slug match
            matched = next((k for k in self._actions.keys() if action_id in k or k in action_id), None)
            if matched:
                action_id = matched
            else:
                raise KeyError(f"Action ID '{action_id}' not found in action queue.")

        item = self._actions[action_id]
        item.status = new_status
        self._save_storage()
        logger.info(f"Action '{action_id}' status updated to '{new_status.value}'")
        return item


action_queue_service = EDActionQueueService()
