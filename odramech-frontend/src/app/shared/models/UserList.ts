import { GenderEnum } from "@shared/enums/gender.enum"
import { RoleEnum } from "@shared/enums/role.enum"
import { AddressCreate } from "./AddressCreate"
import { Vehicle } from "./Vehicle"

export interface UserList {
    id: number
    name: string
    email?: string
    principalPhone: string
}

export interface UserDetail extends UserList {
    gender: GenderEnum
    secondaryPhone?: string | null
    createdAt: string
    address?: (AddressCreate & { id: number }) | null
    role: RoleEnum | null
    vehicles: Vehicle[]
    workOrdersCount: number
}
