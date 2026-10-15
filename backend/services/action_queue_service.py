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

            if rec.source_prediction:
                source_pred = rec.source_prediction
            elif rec.category == "BED CAPACITY":
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
                
                # Check if underlying issue changed while acknowledged or monitoring
                if existing.status in [ActionStatus.ACKNOWLEDGED, ActionStatus.MONITORING]:
                    if existing.priority != rec.priority or rec.escalation_detected:
                        existing.condition_changed_since_ack = True
                        existing.condition_change_summary = (
                            f"Operational severity updated from {existing.priority} to {rec.priority} "
                            f"({rec.issue_trend})"
                        )
                        existing.audit_history.append({
                            "timestamp": now_iso,
                            "event": "UNDERLYING_CONDITION_CHANGED",
                            "previous_priority": existing.priority,
                            "new_priority": rec.priority,
                            "issue_trend": rec.issue_trend,
                            "escalation_detected": rec.escalation_detected,
                            "details": existing.condition_change_summary,
                        })

                existing.title = rec.title
                existing.recommendation = rec.recommended_action
                existing.priority = rec.priority
                existing.contributing_factors = factor_strings
                existing.source_prediction = source_pred
                existing.urgency = rec.urgency
                existing.reason = rec.reason
                existing.explanation_detail = rec.explanation_detail.model_dump() if rec.explanation_detail else None
                existing.priority_score = rec.priority_score
                existing.model_confidence = rec.model_confidence
                existing.issue_trend = rec.issue_trend
                existing.escalation_detected = rec.escalation_detected
                existing.requires_human_confirmation_to_resolve = rec.requires_human_confirmation_to_resolve
                existing.historical_occurrence_count = rec.historical_occurrence_count
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
                    priority_score=rec.priority_score,
                    model_confidence=rec.model_confidence,
                    issue_trend=rec.issue_trend,
                    escalation_detected=rec.escalation_detected,
                    requires_human_confirmation_to_resolve=rec.requires_human_confirmation_to_resolve,
                    historical_occurrence_count=rec.historical_occurrence_count,
                    audit_history=[{
                        "timestamp": now_iso,
                        "event": "ACTION_DETECTED",
                        "priority": rec.priority,
                        "details": f"Issue detected with {rec.priority} priority by {source_pred}",
                    }],
                )
                self._actions[action_id] = new_item

        self._save_storage()
        return list(self._actions.values())

    def get_action_queue(
        self,
        hospital_state: Optional[HospitalState] = None,
        filter_status: str = "ALL",
        overview: Optional[Any] = None,
    ) -> ActionQueueResponse:
        """
        Retrieves action queue with status/priority filtering and summary metrics.
        Executes orchestrator sync if state is provided.
        """
        if hospital_state is not None:
            from .orchestrator_service import orchestrator_service
            orch_res = orchestrator_service.analyze_operations(hospital_state, overview=overview)
            self.sync_with_orchestrator(orch_res)
        elif not self._actions:
            # Seed default queue if store is empty
            from .orchestrator_service import orchestrator_service
            default_state = HospitalState()
            orch_res = orchestrator_service.analyze_operations(default_state, overview=overview)
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

    def update_action_status(
        self,
        action_id: str,
        new_status: ActionStatus,
        response_option: Optional[str] = None,
        notes: Optional[str] = None,
        acknowledged_at: Optional[str] = None,
        acknowledged_by: Optional[str] = None,
        resolved_at: Optional[str] = None,
        resolution_notes: Optional[str] = None,
        resolved_by: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> ActionItem:
        """
        Updates an action item's status, acknowledgement, and resolution metadata
        (response_option, notes, acknowledged_at, resolution_notes, resolved_at)
        and persists the state to JSON store with complete auditable history.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        extra_data = extra_data or {}

        if action_id not in self._actions:
            # Fallback search by prefix or slug match
            matched = next((k for k in self._actions.keys() if action_id in k or k in action_id), None)
            if matched:
                action_id = matched
            else:
                # Seed from default orchestrator state if not yet initialized
                from .orchestrator_service import orchestrator_service
                default_state = HospitalState()
                orch_res = orchestrator_service.analyze_operations(default_state)
                self.sync_with_orchestrator(orch_res)
                if action_id not in self._actions:
                    # Create action item populated with extraData or defaults
                    self._actions[action_id] = ActionItem(
                        id=action_id,
                        category=extra_data.get("category", "OPERATIONAL ISSUE"),
                        title=extra_data.get("title", f"Operational Action {action_id}"),
                        recommendation=extra_data.get("recommendation", "Review operational parameters"),
                        priority=extra_data.get("priority", "HIGH"),
                        created_at=now_iso,
                        due_time=extra_data.get("due_time", "In 30 mins"),
                        status=ActionStatus.NEW,
                        contributing_factors=["Telemetry Load"],
                        source_prediction="ED Command Orchestrator",
                        audit_history=[{
                            "timestamp": now_iso,
                            "event": "ACTION_CREATED_ON_DEMAND",
                            "details": f"Created via status update request for '{action_id}'.",
                        }],
                    )

        item = self._actions[action_id]
        prev_status = item.status
        item.status = new_status

        # If extra details provided, update them
        if extra_data.get("title") and not item.title:
            item.title = extra_data["title"]
        if extra_data.get("category") and not item.category:
            item.category = extra_data["category"]
        if extra_data.get("recommendation") and not item.recommendation:
            item.recommendation = extra_data["recommendation"]

        # Handling Acknowledgement
        if new_status == ActionStatus.ACKNOWLEDGED:
            item.response_option = response_option or item.response_option or "Action Planned"
            if notes is not None:
                item.notes = notes
            item.acknowledged_at = acknowledged_at or item.acknowledged_at or now_iso
            if acknowledged_by:
                item.acknowledged_by = acknowledged_by
            # Clear warning on fresh acknowledgement
            item.condition_changed_since_ack = False
            item.condition_change_summary = None

            item.audit_history.append({
                "timestamp": item.acknowledged_at,
                "event": "ACTION_ACKNOWLEDGED",
                "response_option": item.response_option,
                "notes": item.notes,
                "acknowledged_by": item.acknowledged_by,
                "previous_status": prev_status.value if hasattr(prev_status, "value") else str(prev_status),
            })

        # Handling Resolution (Completed)
        elif new_status == ActionStatus.COMPLETED:
            item.resolved_at = resolved_at or now_iso
            item.resolution_notes = resolution_notes or notes or item.resolution_notes or "Marked resolved by command staff."
            if resolved_by:
                item.resolved_by = resolved_by

            item.audit_history.append({
                "timestamp": item.resolved_at,
                "event": "ACTION_RESOLVED",
                "resolution_notes": item.resolution_notes,
                "resolved_by": item.resolved_by,
                "previous_status": prev_status.value if hasattr(prev_status, "value") else str(prev_status),
            })

        # Handling Monitoring or Reopened
        elif new_status == ActionStatus.NEW and prev_status == ActionStatus.COMPLETED:
            item.audit_history.append({
                "timestamp": now_iso,
                "event": "ACTION_REOPENED",
                "details": "Operational action reopened for continued monitoring.",
            })

        self._save_storage()
        logger.info(f"Action '{action_id}' status updated to '{new_status}' (prev: '{prev_status}')")
        return item


action_queue_service = EDActionQueueService()
