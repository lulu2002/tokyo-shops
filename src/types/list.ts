export interface List {
  id: string;
  userId: string;
  name: string;
  color: string;
  isPublic: boolean;
  sortOrder: number;
  createdAt: string;
  itemCount?: number;
}
