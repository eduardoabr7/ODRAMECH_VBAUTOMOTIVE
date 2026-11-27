import { StatusOS } from "@shared/enums/status-os.enum";

export interface Vehicle {
  id: number;
  plate: string;
  name: string;
  make: string;
  color?: string;
  km?: string;
  modelYear?: number;
  manufactureYear?: number;
  clientId?: number;
}

export interface VehicleListItem extends Vehicle {
  owners: { id: number; name: string; principalPhone: string }[];
  lastWorkOrder: { id: number; numberOs: number; status: StatusOS; dateTimeCreation: string } | null;
  workOrdersCount: number;
}
