// Monopoly property data with authentic values
export type PropertyType = 'street' | 'railroad' | 'utility';
export type PropertyColor = 
  | 'brown' | 'light-blue' | 'pink' | 'orange' 
  | 'red' | 'yellow' | 'green' | 'dark-blue'
  | 'railroad' | 'utility';

export interface MonopolyProperty {
  id: string;
  name: string;
  type: PropertyType;
  color: PropertyColor;
  price: number;
  mortgageValue: number;
  rent: number;
  rentWithColorSet?: number;
  rent1House?: number;
  rent2House?: number;
  rent3House?: number;
  rent4House?: number;
  rentHotel?: number;
  houseCost?: number;
  hotelCost?: number;
  position: number; // board position
}

export const MONOPOLY_PROPERTIES: MonopolyProperty[] = [
  // Brown Properties
  {
    id: 'mediterranean-ave',
    name: 'Mediterranean Avenue',
    type: 'street',
    color: 'brown',
    price: 60,
    mortgageValue: 30,
    rent: 2,
    rentWithColorSet: 4,
    rent1House: 10,
    rent2House: 30,
    rent3House: 90,
    rent4House: 160,
    rentHotel: 250,
    houseCost: 50,
    hotelCost: 50,
    position: 1
  },
  {
    id: 'baltic-ave',
    name: 'Baltic Avenue',
    type: 'street',
    color: 'brown',
    price: 60,
    mortgageValue: 30,
    rent: 4,
    rentWithColorSet: 8,
    rent1House: 20,
    rent2House: 60,
    rent3House: 180,
    rent4House: 320,
    rentHotel: 450,
    houseCost: 50,
    hotelCost: 50,
    position: 3
  },
  
  // Light Blue Properties
  {
    id: 'oriental-ave',
    name: 'Oriental Avenue',
    type: 'street',
    color: 'light-blue',
    price: 100,
    mortgageValue: 50,
    rent: 6,
    rentWithColorSet: 12,
    rent1House: 30,
    rent2House: 90,
    rent3House: 270,
    rent4House: 400,
    rentHotel: 550,
    houseCost: 50,
    hotelCost: 50,
    position: 6
  },
  {
    id: 'vermont-ave',
    name: 'Vermont Avenue',
    type: 'street',
    color: 'light-blue',
    price: 100,
    mortgageValue: 50,
    rent: 6,
    rentWithColorSet: 12,
    rent1House: 30,
    rent2House: 90,
    rent3House: 270,
    rent4House: 400,
    rentHotel: 550,
    houseCost: 50,
    hotelCost: 50,
    position: 8
  },
  {
    id: 'connecticut-ave',
    name: 'Connecticut Avenue',
    type: 'street',
    color: 'light-blue',
    price: 120,
    mortgageValue: 60,
    rent: 8,
    rentWithColorSet: 16,
    rent1House: 40,
    rent2House: 100,
    rent3House: 300,
    rent4House: 450,
    rentHotel: 600,
    houseCost: 50,
    hotelCost: 50,
    position: 9
  },
  
  // Pink Properties
  {
    id: 'st-charles-place',
    name: 'St. Charles Place',
    type: 'street',
    color: 'pink',
    price: 140,
    mortgageValue: 70,
    rent: 10,
    rentWithColorSet: 20,
    rent1House: 50,
    rent2House: 150,
    rent3House: 450,
    rent4House: 625,
    rentHotel: 750,
    houseCost: 100,
    hotelCost: 100,
    position: 11
  },
  {
    id: 'states-ave',
    name: 'States Avenue',
    type: 'street',
    color: 'pink',
    price: 140,
    mortgageValue: 70,
    rent: 10,
    rentWithColorSet: 20,
    rent1House: 50,
    rent2House: 150,
    rent3House: 450,
    rent4House: 625,
    rentHotel: 750,
    houseCost: 100,
    hotelCost: 100,
    position: 13
  },
  {
    id: 'virginia-ave',
    name: 'Virginia Avenue',
    type: 'street',
    color: 'pink',
    price: 160,
    mortgageValue: 80,
    rent: 12,
    rentWithColorSet: 24,
    rent1House: 60,
    rent2House: 180,
    rent3House: 500,
    rent4House: 700,
    rentHotel: 900,
    houseCost: 100,
    hotelCost: 100,
    position: 14
  },
  
  // Orange Properties
  {
    id: 'st-james-place',
    name: 'St. James Place',
    type: 'street',
    color: 'orange',
    price: 180,
    mortgageValue: 90,
    rent: 14,
    rentWithColorSet: 28,
    rent1House: 70,
    rent2House: 200,
    rent3House: 550,
    rent4House: 750,
    rentHotel: 950,
    houseCost: 100,
    hotelCost: 100,
    position: 16
  },
  {
    id: 'tennessee-ave',
    name: 'Tennessee Avenue',
    type: 'street',
    color: 'orange',
    price: 180,
    mortgageValue: 90,
    rent: 14,
    rentWithColorSet: 28,
    rent1House: 70,
    rent2House: 200,
    rent3House: 550,
    rent4House: 750,
    rentHotel: 950,
    houseCost: 100,
    hotelCost: 100,
    position: 18
  },
  {
    id: 'new-york-ave',
    name: 'New York Avenue',
    type: 'street',
    color: 'orange',
    price: 200,
    mortgageValue: 100,
    rent: 16,
    rentWithColorSet: 32,
    rent1House: 80,
    rent2House: 220,
    rent3House: 600,
    rent4House: 800,
    rentHotel: 1000,
    houseCost: 100,
    hotelCost: 100,
    position: 19
  },
  
  // Red Properties
  {
    id: 'kentucky-ave',
    name: 'Kentucky Avenue',
    type: 'street',
    color: 'red',
    price: 220,
    mortgageValue: 110,
    rent: 18,
    rentWithColorSet: 36,
    rent1House: 90,
    rent2House: 250,
    rent3House: 700,
    rent4House: 875,
    rentHotel: 1050,
    houseCost: 150,
    hotelCost: 150,
    position: 21
  },
  {
    id: 'indiana-ave',
    name: 'Indiana Avenue',
    type: 'street',
    color: 'red',
    price: 220,
    mortgageValue: 110,
    rent: 18,
    rentWithColorSet: 36,
    rent1House: 90,
    rent2House: 250,
    rent3House: 700,
    rent4House: 875,
    rentHotel: 1050,
    houseCost: 150,
    hotelCost: 150,
    position: 23
  },
  {
    id: 'illinois-ave',
    name: 'Illinois Avenue',
    type: 'street',
    color: 'red',
    price: 240,
    mortgageValue: 120,
    rent: 20,
    rentWithColorSet: 40,
    rent1House: 100,
    rent2House: 300,
    rent3House: 750,
    rent4House: 925,
    rentHotel: 1100,
    houseCost: 150,
    hotelCost: 150,
    position: 24
  },
  
  // Yellow Properties
  {
    id: 'atlantic-ave',
    name: 'Atlantic Avenue',
    type: 'street',
    color: 'yellow',
    price: 260,
    mortgageValue: 130,
    rent: 22,
    rentWithColorSet: 44,
    rent1House: 110,
    rent2House: 330,
    rent3House: 800,
    rent4House: 975,
    rentHotel: 1150,
    houseCost: 150,
    hotelCost: 150,
    position: 26
  },
  {
    id: 'ventnor-ave',
    name: 'Ventnor Avenue',
    type: 'street',
    color: 'yellow',
    price: 260,
    mortgageValue: 130,
    rent: 22,
    rentWithColorSet: 44,
    rent1House: 110,
    rent2House: 330,
    rent3House: 800,
    rent4House: 975,
    rentHotel: 1150,
    houseCost: 150,
    hotelCost: 150,
    position: 27
  },
  {
    id: 'marvin-gardens',
    name: 'Marvin Gardens',
    type: 'street',
    color: 'yellow',
    price: 280,
    mortgageValue: 140,
    rent: 24,
    rentWithColorSet: 48,
    rent1House: 120,
    rent2House: 360,
    rent3House: 850,
    rent4House: 1025,
    rentHotel: 1200,
    houseCost: 150,
    hotelCost: 150,
    position: 29
  },
  
  // Green Properties
  {
    id: 'pacific-ave',
    name: 'Pacific Avenue',
    type: 'street',
    color: 'green',
    price: 300,
    mortgageValue: 150,
    rent: 26,
    rentWithColorSet: 52,
    rent1House: 130,
    rent2House: 390,
    rent3House: 900,
    rent4House: 1100,
    rentHotel: 1275,
    houseCost: 200,
    hotelCost: 200,
    position: 31
  },
  {
    id: 'north-carolina-ave',
    name: 'North Carolina Avenue',
    type: 'street',
    color: 'green',
    price: 300,
    mortgageValue: 150,
    rent: 26,
    rentWithColorSet: 52,
    rent1House: 130,
    rent2House: 390,
    rent3House: 900,
    rent4House: 1100,
    rentHotel: 1275,
    houseCost: 200,
    hotelCost: 200,
    position: 32
  },
  {
    id: 'pennsylvania-ave',
    name: 'Pennsylvania Avenue',
    type: 'street',
    color: 'green',
    price: 320,
    mortgageValue: 160,
    rent: 28,
    rentWithColorSet: 56,
    rent1House: 150,
    rent2House: 450,
    rent3House: 1000,
    rent4House: 1200,
    rentHotel: 1400,
    houseCost: 200,
    hotelCost: 200,
    position: 34
  },
  
  // Dark Blue Properties
  {
    id: 'park-place',
    name: 'Park Place',
    type: 'street',
    color: 'dark-blue',
    price: 350,
    mortgageValue: 175,
    rent: 35,
    rentWithColorSet: 70,
    rent1House: 175,
    rent2House: 500,
    rent3House: 1100,
    rent4House: 1300,
    rentHotel: 1500,
    houseCost: 200,
    hotelCost: 200,
    position: 37
  },
  {
    id: 'boardwalk',
    name: 'Boardwalk',
    type: 'street',
    color: 'dark-blue',
    price: 400,
    mortgageValue: 200,
    rent: 50,
    rentWithColorSet: 100,
    rent1House: 200,
    rent2House: 600,
    rent3House: 1400,
    rent4House: 1700,
    rentHotel: 2000,
    houseCost: 200,
    hotelCost: 200,
    position: 39
  },
  
  // Railroads
  {
    id: 'reading-railroad',
    name: 'Reading Railroad',
    type: 'railroad',
    color: 'railroad',
    price: 200,
    mortgageValue: 100,
    rent: 25,
    rentWithColorSet: 50, // 2 railroads
    rent1House: 100, // 3 railroads (reusing these fields)
    rent2House: 200, // 4 railroads
    position: 5
  },
  {
    id: 'pennsylvania-railroad',
    name: 'Pennsylvania Railroad',
    type: 'railroad',
    color: 'railroad',
    price: 200,
    mortgageValue: 100,
    rent: 25,
    rentWithColorSet: 50,
    rent1House: 100,
    rent2House: 200,
    position: 15
  },
  {
    id: 'bo-railroad',
    name: 'B. & O. Railroad',
    type: 'railroad',
    color: 'railroad',
    price: 200,
    mortgageValue: 100,
    rent: 25,
    rentWithColorSet: 50,
    rent1House: 100,
    rent2House: 200,
    position: 25
  },
  {
    id: 'short-line',
    name: 'Short Line',
    type: 'railroad',
    color: 'railroad',
    price: 200,
    mortgageValue: 100,
    rent: 25,
    rentWithColorSet: 50,
    rent1House: 100,
    rent2House: 200,
    position: 35
  },
  
  // Utilities
  {
    id: 'electric-company',
    name: 'Electric Company',
    type: 'utility',
    color: 'utility',
    price: 150,
    mortgageValue: 75,
    rent: 4, // multiplier with one utility
    rentWithColorSet: 10, // multiplier with both utilities
    position: 12
  },
  {
    id: 'water-works',
    name: 'Water Works',
    type: 'utility',
    color: 'utility',
    price: 150,
    mortgageValue: 75,
    rent: 4,
    rentWithColorSet: 10,
    position: 28
  }
];

// Color mappings for UI
export const PROPERTY_COLORS: Record<PropertyColor, { bg: string; text: string; border: string }> = {
  'brown': { bg: '#8B4513', text: '#FFFFFF', border: '#654321' },
  'light-blue': { bg: '#87CEEB', text: '#000000', border: '#4682B4' },
  'pink': { bg: '#FF1493', text: '#FFFFFF', border: '#C71585' },
  'orange': { bg: '#FFA500', text: '#000000', border: '#FF8C00' },
  'red': { bg: '#DC143C', text: '#FFFFFF', border: '#B22222' },
  'yellow': { bg: '#FFD700', text: '#000000', border: '#DAA520' },
  'green': { bg: '#228B22', text: '#FFFFFF', border: '#006400' },
  'dark-blue': { bg: '#0000CD', text: '#FFFFFF', border: '#00008B' },
  // Use a dark gray (not pure black) so railroads are visible on black backgrounds
  'railroad': { bg: '#2d2d2d', text: '#FFFFFF', border: '#444444' },
  'utility': { bg: '#FFFFFF', text: '#000000', border: '#CCCCCC' }
};

// Get properties grouped by color
export const getPropertiesByColor = () => {
  const grouped: Record<PropertyColor, MonopolyProperty[]> = {
    'brown': [],
    'light-blue': [],
    'pink': [],
    'orange': [],
    'red': [],
    'yellow': [],
    'green': [],
    'dark-blue': [],
    'railroad': [],
    'utility': []
  };
  
  MONOPOLY_PROPERTIES.forEach(prop => {
    grouped[prop.color].push(prop);
  });
  
  return grouped;
};

// Calculate property value (includes improvements)
export const calculatePropertyValue = (property: MonopolyProperty, houses: number): number => {
  const houseCost = property.houseCost || 0;
  return property.price + (houses * houseCost);
};
