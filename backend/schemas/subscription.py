from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime

class SubscriptionCreateRequest(BaseModel):
    plan_name: str
    billing_cycle: str = "monthly"  # monthly or yearly

class SubscriptionResponse(BaseModel):
    success: bool
    subscription_id: Optional[str] = None
    customer_id: Optional[str] = None
    payment_url: Optional[str] = None
    message: str

class SubscriptionStatusResponse(BaseModel):
    success: bool
    status: str
    plan: Optional[str] = None
    has_active_subscription: bool
    migration_status: Optional[str] = None
    grace_period_end: Optional[datetime] = None
    days_left: int = 0

class MigrationStatusResponse(BaseModel):
    success: bool
    migration_info: Dict[str, Any]

class SubscriptionPlanResponse(BaseModel):
    id: int
    name: str
    display_name: str
    price_monthly: int
    price_yearly: int
    features: List[str]
    monthly_price_display: str
    yearly_price_display: str

class SubscriptionPlansResponse(BaseModel):
    success: bool
    plans: List[SubscriptionPlanResponse]
