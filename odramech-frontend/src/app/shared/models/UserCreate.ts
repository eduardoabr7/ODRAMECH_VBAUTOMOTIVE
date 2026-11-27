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
  /** desmarcado = cadastrado, mas sem acesso ao estabelecimento */
  active?: boolean
  /** estabelecimento onde cadastrar (padrão: o da sessão) */
  establishmentId?: number
}