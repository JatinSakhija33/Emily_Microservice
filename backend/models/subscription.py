from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    display_name = Column(String(100), nullable=False)
    price_monthly = Column(Integer, nullable=False)  # Price in cents
    price_yearly = Column(Integer, nullable=False)   # Price in cents
    features = Column(JSON, nullable=False)
    razorpay_plan_id_monthly = Column(String(255), nullable=True)
    razorpay_plan_id_yearly = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SubscriptionTransaction(Base):
    __tablename__ = "subscription_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False)
    subscription_id = Column(String(255), nullable=False, index=True)
    razorpay_payment_id = Column(String(255), nullable=False)
    amount = Column(Integer, nullable=False)  # Amount in cents
    currency = Column(String(3), default="INR")
    status = Column(String(20), nullable=False)
    payment_method = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class SubscriptionWebhook(Base):
    __tablename__ = "subscription_webhooks"
    
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(255), unique=True, nullable=False, index=True)
    event_type = Column(String(100), nullable=False)
    subscription_id = Column(String(255), nullable=True, index=True)
    payment_id = Column(String(255), nullable=True)
    payload = Column(JSON, nullable=False)
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
