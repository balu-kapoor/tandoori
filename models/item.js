class Item {
    constructor(id, category, itemName, images, description, isAvailable, price, vegetarian ) {
            this.id = id;
            this.category = category;
            this.itemName = itemName;        
            this.images = images;        
            this.description = description;            
            this.isAvailable = isAvailable;            
            this.price = price;
            this.vegetarian = vegetarian;
    }
}

module.exports = Item;