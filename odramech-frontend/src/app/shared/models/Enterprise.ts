import { Address } from "./Address";
import { Establishment } from "./Establishment";

export interface Enterprise {
  id: number;
  logoUrl: string | null;
  name: string;
  establishments: Establishment[];
}