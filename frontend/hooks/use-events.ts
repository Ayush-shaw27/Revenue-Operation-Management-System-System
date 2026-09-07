import { useEffect, useState } from "react";

export function useEvents(token: string) {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    const es = new EventSource(`/api/events/stream?token=${token}`);
    es.onmessage = (e) => setEvents((prev) => [...prev, JSON.parse(e.data)]);
    es.onerror = () => es.close();
    return () => es.close();
  }, [token]);
  return events;
}
