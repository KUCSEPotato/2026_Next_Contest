from __future__ import annotations

from collections import defaultdict
from typing import DefaultDict, Set

from fastapi import WebSocket


def chat_room_channel(room_id: int) -> str:
    return f"chat.room.{room_id}"


class RealtimeHub:
    def __init__(self) -> None:
        self._channels: DefaultDict[str, Set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._channels[channel].add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        sockets = self._channels.get(channel)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            self._channels.pop(channel, None)

    async def broadcast_json(self, channel: str, payload: dict) -> None:
        sockets = list(self._channels.get(channel, set()))
        stale_sockets: list[WebSocket] = []

        for websocket in sockets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale_sockets.append(websocket)

        for websocket in stale_sockets:
            self.disconnect(channel, websocket)


realtime_hub = RealtimeHub()