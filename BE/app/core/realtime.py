from collections import defaultdict

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._channels: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._channels[channel].add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        channel_sockets = self._channels.get(channel)
        if channel_sockets is None:
            return
        channel_sockets.discard(websocket)
        if not channel_sockets:
            self._channels.pop(channel, None)

    async def broadcast_json(self, channel: str, payload: dict) -> None:
        channel_sockets = list(self._channels.get(channel, set()))
        if not channel_sockets:
            return

        stale_sockets: list[WebSocket] = []
        for websocket in channel_sockets:
            try:
                await websocket.send_json(payload)
            except Exception:
                stale_sockets.append(websocket)

        for websocket in stale_sockets:
            self.disconnect(channel, websocket)


def chat_room_channel(room_id: int) -> str:
    return f"chat-room:{room_id}"


def project_todo_channel(project_id: int) -> str:
    return f"project-todos:{project_id}"


realtime_hub = RealtimeHub()