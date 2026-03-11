# fastapi dev main.py
from enum import Enum

from fastapi import FastAPI
from fastapi import HTTPException

from pydantic import BaseModel

app = FastAPI()

class ItemStatus(str, Enum):
    available = "available"
    out_of_stock = "out_of_stock"
    discontinued = "discontinued"

class Item(BaseModel):
    name: str
    stock: int
    status: ItemStatus
    price: float

class ResponseModel(BaseModel):
    message: str
    item: Item | None = None

fake_items_db = {
    0: {"message":"Please input item id between 1 and 3"},
    1: Item(name="Item 1", stock=10, status=ItemStatus.available, price=100),
    2: Item(name="Item 2", stock=0, status=ItemStatus.out_of_stock, price=50),
    3: Item(name="Item 3", stock=5, status=ItemStatus.discontinued, price=75),
}

@app.get("/")
async def root(message: str = "Hello World")-> dict:
    return {"message": message}

@app.post("/item/post")
async def create_item(item: Item):
    fake_items_db[len(fake_items_db)] = item
    return ResponseModel(message="Item created successfully", item=item)

@app.get("/item")
async def read_item(item_id: int = 0, sale: bool | None = None) -> ResponseModel:
    item = fake_items_db.get(item_id)
    if item and sale is not None:
        if sale:
            item.price = item.price * 0.9  # Apply a 10% discount
    if item_id in fake_items_db:
        return ResponseModel(message="Item retrieved successfully", item=item)
    else:
        raise HTTPException(status_code=404, detail="Item not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 

