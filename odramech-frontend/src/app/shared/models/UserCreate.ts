import { GenderEnum } from "@shared/enums/gender.enum";
import { AddressCreate } from "./AddressCreate";

export interface UserCreate {
  name: string
  gender: GenderEnum
  email?: string
  password?: string
  principalPhone: string
  secondaryPhone?: string
  address?: AddressCreate
}