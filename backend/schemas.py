from typing import Literal, Optional

from pydantic import BaseModel, Field


class Product(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    price: Optional[float] = Field(None, description="Numeric price only, no currency symbol")
    currency: Optional[str] = Field(None, description="ISO code such as USD or INR")
    availability: Optional[str] = None
    rating: Optional[float] = None
    description: Optional[str] = None


class Event(BaseModel):
    title: Optional[str] = None
    start_date: Optional[str] = Field(None, description="ISO format, YYYY-MM-DD")
    end_date: Optional[str] = Field(None, description="ISO format, YYYY-MM-DD")
    location: Optional[str] = None
    organizer: Optional[str] = None


class Contact(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    organization: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None


class KeyFact(BaseModel):
    label: str
    value: str


class ProductResult(BaseModel):
    products: list[Product] = []


class EventResult(BaseModel):
    events: list[Event] = []


class ContactResult(BaseModel):
    contacts: list[Contact] = []


class AutoResult(BaseModel):
    products: list[Product] = []
    events: list[Event] = []
    contacts: list[Contact] = []
    key_facts: list[KeyFact] = []


Kind = Literal["auto", "product", "event", "contact"]

RESULT_MODELS = {
    "auto": AutoResult,
    "product": ProductResult,
    "event": EventResult,
    "contact": ContactResult,
}