from .supervised_router import router as supervised_router
from .unsupervised_router import router as unsupervised_router
from .deep_learning_router import router as deep_learning_router
from .overview_router import router as overview_router

__all__ = [
    "supervised_router",
    "unsupervised_router",
    "deep_learning_router",
    "overview_router",
]
