from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response

from helpers.get_current_user import get_current_user
from models.errors.Errors import AppError

import analytics_service

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

class MetricNotFoundError(AppError):
    def __init__(self):
        super().__init__(
            message="Unknown analytics metric",
            error_code="errors.analytics_metric_not_found",
            status_code=404,
        )

@router.get("/overview")
def get_overview(
    refresh: bool = Query(default=False),
    user=Depends(get_current_user),
):
    """Summary numbers + every chart series for the admin dashboard."""
    return analytics_service.get_overview(force=refresh)

@router.get("/metrics")
def list_metrics(user=Depends(get_current_user)):
    """Available metrics with their human readable labels."""
    return analytics_service.METRICS

@router.get("/download/{metric}")
def download_metric(metric: str, user=Depends(get_current_user)):
    """Download a single metric's data as a CSV file."""
    try:
        csv = analytics_service.get_metric_csv(metric)
    except KeyError:
        raise MetricNotFoundError()

    return Response(
        content=csv,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{metric}.csv"',
        },
    )
