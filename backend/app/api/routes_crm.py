"""CRM routes: leads, deals, activities, accounts (+ CSV export / import)."""
from __future__ import annotations
import csv
import io
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse

from app.api.deps import AuthUser, get_current_user
from app.ml.artifacts.lead_scoring_model import LeadScoringModel
from app.schemas import (
    LeadCreate, LeadUpdate, LeadResponse,
    DealCreate, DealUpdate, DealResponse,
    ActivityCreate, ActivityResponse, AccountResponse,
)
from app.services import data_store as ds

router = APIRouter(prefix="/api", tags=["crm"])

lead_model = LeadScoringModel()


@router.get("/leads", response_model=List[LeadResponse])
async def list_leads(current_user: AuthUser = Depends(get_current_user)):
    return ds.get_leads()


@router.get("/leads/export")
async def export_leads(current_user: AuthUser = Depends(get_current_user)):
    leads = ds.get_leads()
    buffer = io.StringIO()
    fieldnames = ["id", "name", "email", "phone", "company", "status", "source",
                  "value", "industry", "company_size", "created_at", "ai_score", "ai_label"]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for l in leads:
        writer.writerow({k: l.get(k, "") for k in fieldnames})
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


@router.post("/leads", response_model=LeadResponse)
async def create_lead(lead: LeadCreate, current_user: AuthUser = Depends(get_current_user)):
    data = lead.model_dump()
    try:
        pred = lead_model.predict({
            "name": data.get("name", ""), "company": data.get("company", ""),
            "value": data.get("value", 30000), "source": data.get("source", "Website"),
            "touchpoints": data.get("touchpoints", 3),
            "industry": data.get("industry", "Technology"),
            "company_size": data.get("company_size", "Mid-Market"),
        })
        data["ai_score"] = pred["score"]
        data["ai_label"] = pred["label"]
        data["ai_factors"] = pred["factors"]
    except Exception:
        pass
    return ds.create_lead(data)


@router.post("/leads/import")
async def import_leads(file: UploadFile = File(...), current_user: AuthUser = Depends(get_current_user)):
    content = (await file.read()).decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    created = 0
    errors: List[str] = []
    for i, row in enumerate(reader, start=1):
        if not row.get("name") or not row.get("company"):
            errors.append(f"Row {i}: missing name or company")
            continue
        try:
            ds.create_lead({
                "name": row.get("name", ""), "email": row.get("email", ""),
                "phone": row.get("phone", ""), "company": row.get("company", ""),
                "status": row.get("status", "new"), "source": row.get("source", "Website"),
                "value": float(row.get("value", 0) or 0),
                "industry": row.get("industry", "Technology"),
                "company_size": row.get("company_size", "Mid-Market"),
                "touchpoints": int(row.get("touchpoints", 3) or 3),
            })
            created += 1
        except Exception as e:
            errors.append(f"Row {i}: {str(e)}")
    return {"created": created, "errors": errors, "total": created + len(errors)}
@router.get("/leads/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: str, current_user: AuthUser = Depends(get_current_user)):
    lead = ds.get_lead(lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(lead_id: str, lead: LeadUpdate, current_user: AuthUser = Depends(get_current_user)):
    result = ds.update_lead(lead_id, lead.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Lead not found")
    return result


@router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: str, current_user: AuthUser = Depends(get_current_user)):
    if not ds.delete_lead(lead_id):
        raise HTTPException(status_code=404, detail="Lead not found")
    return {"status": "deleted", "id": lead_id}


# ---------------------------------------------------------------------------
# Deals
# ---------------------------------------------------------------------------
@router.get("/deals", response_model=List[DealResponse])
async def list_deals(current_user: AuthUser = Depends(get_current_user)):
    return ds.get_deals()


@router.get("/deals/export")
async def export_deals(current_user: AuthUser = Depends(get_current_user)):
    deals = ds.get_deals()
    buffer = io.StringIO()
    fieldnames = ["id", "title", "company", "value", "probability", "owner",
                  "close_date", "stage", "days_in_stage", "created_at"]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for d in deals:
        writer.writerow({k: d.get(k, "") for k in fieldnames})
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=deals.csv"},
    )


@router.post("/deals", response_model=DealResponse)
async def create_deal(deal: DealCreate, current_user: AuthUser = Depends(get_current_user)):
    return ds.create_deal(deal.model_dump())


@router.get("/deals/{deal_id}", response_model=DealResponse)
async def get_deal(deal_id: str, current_user: AuthUser = Depends(get_current_user)):
    deal = ds.get_deal(deal_id)
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


@router.put("/deals/{deal_id}", response_model=DealResponse)
async def update_deal(deal_id: str, deal: DealUpdate, current_user: AuthUser = Depends(get_current_user)):
    result = ds.update_deal(deal_id, deal.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="Deal not found")
    return result


@router.delete("/deals/{deal_id}")
async def delete_deal(deal_id: str, current_user: AuthUser = Depends(get_current_user)):
    if not ds.delete_deal(deal_id):
        raise HTTPException(status_code=404, detail="Deal not found")
    return {"status": "deleted", "id": deal_id}
# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------
@router.get("/activities", response_model=List[ActivityResponse])
async def list_activities(deal_id: Optional[str] = None, lead_id: Optional[str] = None,
                          current_user: AuthUser = Depends(get_current_user)):
    return ds.get_activities(deal_id=deal_id, lead_id=lead_id)


@router.post("/activities", response_model=ActivityResponse)
async def create_activity(activity: ActivityCreate, current_user: AuthUser = Depends(get_current_user)):
    return ds.add_activity(
        deal_id=activity.deal_id, lead_id=activity.lead_id,
        type=activity.type, content=activity.content, author=current_user.name,
    )


@router.delete("/activities/{activity_id}")
async def delete_activity(activity_id: str, current_user: AuthUser = Depends(get_current_user)):
    if not ds.delete_activity(activity_id):
        raise HTTPException(status_code=404, detail="Activity not found")
    return {"status": "deleted", "id": activity_id}


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
@router.get("/accounts", response_model=List[AccountResponse])
async def list_accounts(current_user: AuthUser = Depends(get_current_user)):
    return ds.get_accounts()


@router.get("/accounts/export")
async def export_accounts(current_user: AuthUser = Depends(get_current_user)):
    accounts = ds.get_accounts()
    buffer = io.StringIO()
    fieldnames = ["id", "name", "industry", "contract_value", "last_activity_days",
                  "usage_trend", "ticket_count", "renewal_in_days", "health_score"]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for a in accounts:
        writer.writerow({k: a.get(k, "") for k in fieldnames})
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=accounts.csv"},
    )


@router.get("/accounts/{account_id}", response_model=AccountResponse)
async def get_account(account_id: str, current_user: AuthUser = Depends(get_current_user)):
    account = ds.get_account(account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account