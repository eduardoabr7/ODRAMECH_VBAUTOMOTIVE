import { Address } from "./Address";
import { Establishment } from "./Establishment";

export interface Enterprise {
  id: number;
  logoUrl: string | null;
  /** nome do tema (Tema e marca), quando definido */
  displayName?: string | null;
  name: string;
  establishments: Establishment[];
}