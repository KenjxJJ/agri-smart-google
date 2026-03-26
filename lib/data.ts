export interface Disease {
  name: string;
  symptoms: string;
  prevention: string;
}

export interface Crop {
  id: string;
  name: string;
  image: string;
  description: string;
  plantingSeason: string;
  harvestTime: string;
  suitableZones: ('Tropical' | 'Temperate' | 'Arid')[];
  diseases: Disease[];
  climateOutlook: {
    idealTemp: string;
    rainfall: string;
    favorability: 'High' | 'Medium' | 'Low';
    impact: string;
  };
  isOnlineResult?: boolean;
}

export const crops: Crop[] = [
  {
    id: 'maize',
    name: 'Maize (Corn)',
    image: 'https://picsum.photos/seed/maize/400/300',
    description: 'A staple cereal grain grown widely throughout the world.',
    plantingSeason: 'Spring / Early Summer',
    harvestTime: '90-120 days after planting',
    suitableZones: ['Tropical', 'Temperate'],
    diseases: [
      {
        name: 'Maize Lethal Necrosis (MLN)',
        symptoms: 'Yellowing of leaves, stunting, and eventual death of the plant.',
        prevention: 'Crop rotation, use of certified seeds, and controlling insect vectors.',
      },
      {
        name: 'Grey Leaf Spot',
        symptoms: 'Rectangular, grey lesions on leaves.',
        prevention: 'Resistant varieties and fungicide application.',
      },
    ],
    climateOutlook: {
      idealTemp: '20°C - 30°C',
      rainfall: '500mm - 800mm',
      favorability: 'High',
      impact: 'Current seasonal rains are favorable for maize growth in most regions.',
    },
  },
  {
    id: 'wheat',
    name: 'Wheat',
    image: 'https://picsum.photos/seed/wheat/400/300',
    description: 'A cereal grain that is a worldwide staple food.',
    plantingSeason: 'Autumn / Winter',
    harvestTime: '120-150 days after planting',
    suitableZones: ['Temperate', 'Arid'],
    diseases: [
      {
        name: 'Wheat Rust',
        symptoms: 'Orange-brown pustules on leaves and stems.',
        prevention: 'Planting resistant varieties and early monitoring.',
      },
    ],
    climateOutlook: {
      idealTemp: '15°C - 25°C',
      rainfall: '300mm - 600mm',
      favorability: 'Medium',
      impact: 'Drier conditions expected; irrigation might be necessary.',
    },
  },
  {
    id: 'rice',
    name: 'Rice',
    image: 'https://picsum.photos/seed/rice/400/300',
    description: 'The seed of the grass species Oryza sativa.',
    plantingSeason: 'Monsoon / Rainy Season',
    harvestTime: '105-150 days after planting',
    suitableZones: ['Tropical'],
    diseases: [
      {
        name: 'Rice Blast',
        symptoms: 'Diamond-shaped lesions on leaves.',
        prevention: 'Water management and resistant cultivars.',
      },
    ],
    climateOutlook: {
      idealTemp: '20°C - 35°C',
      rainfall: '1200mm - 2500mm',
      favorability: 'High',
      impact: 'Heavy rains forecasted, ideal for paddy fields.',
    },
  },
  {
    id: 'potato',
    name: 'Potato',
    image: 'https://picsum.photos/seed/potato/400/300',
    description: 'A root vegetable native to the Americas.',
    plantingSeason: 'Early Spring',
    suitableZones: ['Temperate'],
    harvestTime: '70-120 days after planting',
    diseases: [
      {
        name: 'Late Blight',
        symptoms: 'Dark, water-soaked spots on leaves and stems.',
        prevention: 'Certified seed tubers and proper spacing.',
      },
    ],
    climateOutlook: {
      idealTemp: '15°C - 20°C',
      rainfall: '500mm - 750mm',
      favorability: 'Medium',
      impact: 'High humidity may increase blight risk.',
    },
  },
];

const USER_CROPS_KEY = 'agri-user-crops';

export function getSavedCrops(): Crop[] {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem(USER_CROPS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (e) {
    console.error('Error parsing saved crops:', e);
    return [];
  }
}

export function saveCrop(crop: Crop): void {
  const current = getSavedCrops();
  if (current.some(c => c.id === crop.id)) return;
  const updated = [...current, { ...crop, isOnlineResult: false }];
  localStorage.setItem(USER_CROPS_KEY, JSON.stringify(updated));
}

export function removeCrop(cropId: string): void {
  const current = getSavedCrops();
  const updated = current.filter(c => c.id !== cropId);
  localStorage.setItem(USER_CROPS_KEY, JSON.stringify(updated));
}

export async function fetchCropById(id: string): Promise<Crop | null> {
  try {
    const response = await fetch(`https://openfarm.cc/api/v1/crops/${id}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || !data.data) return null;
    
    const item = data.data;
    const attrs = item.attributes;
    return {
      id: item.id,
      name: attrs.name,
      image: attrs.main_image_path || `https://picsum.photos/seed/${item.id}/400/300`,
      description: attrs.description || 'No description available.',
      plantingSeason: attrs.sowing_method || 'Consult local guides',
      harvestTime: 'Varies by region',
      suitableZones: ['Tropical', 'Temperate'],
      diseases: [],
      climateOutlook: {
        idealTemp: attrs.growing_degree_days ? `${attrs.growing_degree_days} GDD` : 'Varies',
        rainfall: 'Varies',
        favorability: 'Medium',
        impact: 'Data from OpenFarm.cc.',
      },
      isOnlineResult: false,
    };
  } catch (error) {
    console.error('Error fetching crop by id:', error);
    return null;
  }
}

export async function fetchOnlineCrops(query: string): Promise<Crop[]> {
  if (!query) return [];
  try {
    // OpenFarm API can be finicky with CORS in some environments.
    // We'll use a timeout to prevent long hangs.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://openfarm.cc/api/v1/crops?filter=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`OpenFarm API responded with status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!data || !data.data) return [];

    return data.data.map((item: any) => {
      const attrs = item.attributes;
      return {
        id: item.id,
        name: attrs.name,
        image: attrs.main_image_path || `https://picsum.photos/seed/${item.id}/400/300`,
        description: attrs.description || 'No description available from online database.',
        plantingSeason: attrs.sowing_method || 'Consult local guides',
        harvestTime: 'Varies by region',
        suitableZones: ['Tropical', 'Temperate'], 
        diseases: [], 
        climateOutlook: {
          idealTemp: attrs.growing_degree_days ? `${attrs.growing_degree_days} GDD` : 'Varies',
          rainfall: 'Varies',
          favorability: 'Medium',
          impact: 'Data from OpenFarm.cc. Please consult local agricultural extension for specific regional favorability.',
        },
        isOnlineResult: true,
      };
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('OpenFarm fetch timed out');
    } else {
      console.error('Error fetching from OpenFarm:', error);
    }
    return [];
  }
}
