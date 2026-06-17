export interface VehicleCreate {
  plate: string;
  name: string;
  make: string;
  color?: string;
  km?: string;
  modelYear?: number;
  manufactureYear?: number;
  userId: number;
}