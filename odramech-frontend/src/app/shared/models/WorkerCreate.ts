import { GenderEnum } from "@shared/enums/gender.enum"
import { AddressCreate } from "./AddressCreate"
import { RoleEnum } from "@shared/enums/role.enum"

export interface WorkerCreate {
  name: string
  gender: GenderEnum
  email?: string
  password?: string
  principalPhone: string
  secondaryPhone?: string
  address?: AddressCreate
  role: RoleEnum
}