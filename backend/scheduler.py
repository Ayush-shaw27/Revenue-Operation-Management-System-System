from apscheduler.schedulers.asyncio import AsyncIOScheduler
from backend.jobs import rerun_rebuild, snapshot_metrics

def start_scheduler():
    sched = AsyncIOScheduler()
    sched.add_job(rerun_rebuild, 'interval', seconds=60)
    sched.add_job(snapshot_metrics, 'interval', seconds=60)
    sched.start()
    return sched
