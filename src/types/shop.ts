export interface Shop {
  id: number;
  name: string;
  category: string;
  subcategory: string;
  specialty: string;
  description: string;
  location: string;
  fromKuramae: string;
  price: string;
  lat: number;
  lng: number;
  photoUrl: string;
  photos?: string[];
  slug: string;
  googleName?: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  website?: string;
  googleMapsUrl?: string;
  editorial?: string;
  reviewText?: string;
  hours?: string[];
  tags?: string[];
}
